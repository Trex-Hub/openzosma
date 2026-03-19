/**
 * A2A Protocol implementation — Agent Card + JSON-RPC 2.0 endpoint.
 *
 * Spec: https://google.github.io/A2A/
 *
 * Task <-> Session mapping:
 *   - A2A Task ID  = OpenZosma Session ID
 *   - submitted    = session created, message queued
 *   - working      = agent is processing
 *   - completed    = agent finished successfully
 *   - failed       = agent error
 *   - canceled     = user canceled via tasks/cancel
 *
 * Agent Card:
 *   Each agent_configs row is one skill on the card. The row's `name` and
 *   `description` fields are used directly — no hardcoded metadata map.
 *
 * Agent targeting:
 *   Callers may pass `agentConfigId` in task params to route the task to a
 *   specific agent config. Omitting it routes to the default agent.
 */

import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import type { Context } from "hono"
import type { Pool } from "@openzosma/db"
import { agentConfigQueries, settingQueries } from "@openzosma/db"
import type { SessionManager } from "./session-manager.js"

// ---------------------------------------------------------------------------
// A2A types
// ---------------------------------------------------------------------------

type TaskStatus = "submitted" | "working" | "completed" | "failed" | "canceled"

interface TextPart {
	type: "text"
	text: string
}

interface A2AMessage {
	role: "user" | "agent"
	parts: TextPart[]
}

interface TaskState {
	id: string
	sessionId: string
	agentConfigId: string | undefined
	/**
	 * Set when this task was spawned by another task (delegation).
	 * Kept on the state so taskView can surface it to the A2A caller for
	 * debugging. To hide sub-tasks from callers later, remove this field
	 * from taskView() — the state itself stays intact for internal tracking.
	 */
	parentTaskId?: string
	status: TaskStatus
	messages: A2AMessage[]
	abort?: AbortController
	pushNotificationUrl?: string
	pushNotificationCredentials?: string
}

interface JsonRpcRequest {
	jsonrpc: "2.0"
	id: string | number | null
	method: string
	params?: unknown
}

// JSON-RPC 2.0 error codes
const RPC_PARSE_ERROR = -32700
const RPC_INVALID_REQUEST = -32600
const RPC_METHOD_NOT_FOUND = -32601
const RPC_INVALID_PARAMS = -32602
const RPC_INTERNAL_ERROR = -32603

// ---------------------------------------------------------------------------
// Dynamic Agent Card
// ---------------------------------------------------------------------------

export interface AgentCardSkill {
	id: string
	name: string
	description: string
}

export interface AgentCard {
	name: string
	description: string
	url: string
	version: string
	capabilities: {
		streaming: boolean
		pushNotifications: boolean
		stateTransitionHistory: boolean
	}
	skills: AgentCardSkill[]
	authentication: { schemes: string[] }
}

/**
 * Build the Agent Card from the agent_configs table.
 * Each row becomes one skill entry: id = config.id, name and description
 * come directly from the row. No hardcoded metadata.
 */
export async function buildAgentCard(pool: Pool): Promise<AgentCard> {
	const [configs, publicUrl, instanceName] = await Promise.all([
		agentConfigQueries.listAgentConfigs(pool),
		settingQueries.getSettingValue<string>(pool, "public_url"),
		settingQueries.getSettingValue<string>(pool, "instance_name"),
	])

	const skills: AgentCardSkill[] = configs.map((c) => ({
		id: c.id,
		name: c.name,
		description: c.description ?? "",
	}))

	return {
		name: instanceName ?? "OpenZosma Agent",
		description: "Self-hosted AI agent platform",
		url: `${publicUrl ?? process.env["PUBLIC_URL"] ?? "http://localhost:4000"}/a2a`,
		version: "1.0.0",
		capabilities: {
			streaming: true,
			pushNotifications: true,
			stateTransitionHistory: true,
		},
		skills,
		authentication: { schemes: ["bearer"] },
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpcOk(id: string | number | null, result: unknown) {
	return { jsonrpc: "2.0" as const, id, result }
}

function rpcErr(id: string | number | null, code: number, message: string, data?: unknown) {
	return {
		jsonrpc: "2.0" as const,
		id,
		error: { code, message, ...(data !== undefined ? { data } : {}) },
	}
}

function taskView(task: TaskState) {
	return {
		id: task.id,
		// parentTaskId is included for caller visibility / debugging.
		// To hide delegated sub-tasks from A2A callers later, remove this line.
		...(task.parentTaskId !== undefined ? { parentTaskId: task.parentTaskId } : {}),
		status: { state: task.status },
		messages: task.messages,
	}
}

function extractId(params: unknown): string | null {
	if (typeof params !== "object" || params === null) return null
	const id = (params as Record<string, unknown>)["id"]
	return typeof id === "string" ? id : null
}

function extractAgentConfigId(params: unknown): string | undefined {
	if (typeof params !== "object" || params === null) return undefined
	const v = (params as Record<string, unknown>)["agentConfigId"]
	return typeof v === "string" ? v : undefined
}

function extractParentTaskId(params: unknown): string | undefined {
	if (typeof params !== "object" || params === null) return undefined
	const v = (params as Record<string, unknown>)["parentTaskId"]
	return typeof v === "string" ? v : undefined
}

function extractUserText(params: unknown): string | null {
	if (typeof params !== "object" || params === null) return null
	const msg = (params as Record<string, unknown>)["message"]
	if (typeof msg !== "object" || msg === null) return null
	const parts = (msg as Record<string, unknown>)["parts"]
	if (!Array.isArray(parts)) return null
	return (
		parts
			.filter(
				(p): p is TextPart =>
					typeof p === "object" &&
					p !== null &&
					(p as Record<string, unknown>)["type"] === "text",
			)
			.map((p) => p.text)
			.join("") || null
	)
}

function getOrCreateTask(
	tasks: Map<string, TaskState>,
	taskId: string,
	userText: string,
	agentConfigId: string | undefined,
	parentTaskId?: string,
): TaskState {
	const existing = tasks.get(taskId)
	if (existing) return existing
	const task: TaskState = {
		id: taskId,
		sessionId: taskId,
		agentConfigId,
		...(parentTaskId !== undefined ? { parentTaskId } : {}),
		status: "submitted",
		messages: [{ role: "user", parts: [{ type: "text", text: userText }] }],
	}
	tasks.set(taskId, task)
	return task
}

// ---------------------------------------------------------------------------
// Method: tasks/send — blocking, returns final result
// ---------------------------------------------------------------------------

async function handleTasksSend(
	tasks: Map<string, TaskState>,
	rpcId: string | number | null,
	params: unknown,
	sessionManager: SessionManager,
	c: Context,
): Promise<Response> {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const userText = extractUserText(params)
	if (!userText) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.message must have at least one text part"))

	const agentConfigId = extractAgentConfigId(params)
	const parentTaskId = extractParentTaskId(params)
	const task = getOrCreateTask(tasks, taskId, userText, agentConfigId, parentTaskId)
	task.status = "working"

	const abort = new AbortController()
	task.abort = abort

	// Ensure session exists and is bound to the right agent config.
	// createSession fetches the AgentConfig from DB when agentConfigId is set.
	await sessionManager.createSession(task.sessionId, task.agentConfigId)

	let assistantText = ""

	try {
		for await (const event of sessionManager.sendMessage(task.sessionId, userText, abort.signal)) {
			if (event.type === "message_update" && event.text) {
				assistantText += event.text
			}
		}

		task.status = "completed"
		task.messages.push({ role: "agent", parts: [{ type: "text", text: assistantText }] })
		task.abort = undefined

		return c.json(rpcOk(rpcId, taskView(task)))
	} catch (e) {
		task.status = abort.signal.aborted ? "canceled" : "failed"
		task.abort = undefined
		return c.json(rpcErr(rpcId, RPC_INTERNAL_ERROR, e instanceof Error ? e.message : String(e)))
	}
}

// ---------------------------------------------------------------------------
// Method: tasks/sendSubscribe — SSE stream of task updates
// ---------------------------------------------------------------------------

async function handleTasksSendSubscribe(
	tasks: Map<string, TaskState>,
	rpcId: string | number | null,
	params: unknown,
	sessionManager: SessionManager,
	c: Context,
): Promise<Response> {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const userText = extractUserText(params)
	if (!userText) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.message must have at least one text part"))

	const agentConfigId = extractAgentConfigId(params)
	const parentTaskId = extractParentTaskId(params)
	const task = getOrCreateTask(tasks, taskId, userText, agentConfigId, parentTaskId)
	task.status = "working"

	const abort = new AbortController()
	task.abort = abort

	await sessionManager.createSession(task.sessionId, task.agentConfigId)

	return streamSSE(c, async (stream) => {
		stream.onAbort(() => abort.abort())

		await stream.writeSSE({ data: JSON.stringify({ id: taskId, status: { state: "working" } }) })

		let assistantText = ""

		try {
			for await (const event of sessionManager.sendMessage(task.sessionId, userText, abort.signal)) {
				if (event.type === "message_update" && event.text) {
					assistantText += event.text
					await stream.writeSSE({
						data: JSON.stringify({
							id: taskId,
							status: { state: "working" },
							delta: { type: "text", text: event.text },
						}),
					})
				}
			}

			task.status = "completed"
			task.messages.push({ role: "agent", parts: [{ type: "text", text: assistantText }] })
			task.abort = undefined

			await stream.writeSSE({
				data: JSON.stringify({ id: taskId, status: { state: "completed" }, messages: task.messages }),
			})
		} catch (e) {
			task.status = abort.signal.aborted ? "canceled" : "failed"
			task.abort = undefined
			await stream.writeSSE({
				data: JSON.stringify({
					id: taskId,
					status: { state: task.status },
					error: e instanceof Error ? e.message : String(e),
				}),
			})
		}
	})
}

// ---------------------------------------------------------------------------
// Method: tasks/get
// ---------------------------------------------------------------------------

function handleTasksGet(tasks: Map<string, TaskState>, rpcId: string | number | null, params: unknown, c: Context): Response {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const task = tasks.get(taskId)
	if (!task) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, `Task ${taskId} not found`))

	return c.json(rpcOk(rpcId, taskView(task)))
}

// ---------------------------------------------------------------------------
// Method: tasks/cancel
// ---------------------------------------------------------------------------

function handleTasksCancel(tasks: Map<string, TaskState>, rpcId: string | number | null, params: unknown, c: Context): Response {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const task = tasks.get(taskId)
	if (!task) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, `Task ${taskId} not found`))

	task.abort?.abort()
	task.abort = undefined
	task.status = "canceled"

	return c.json(rpcOk(rpcId, taskView(task)))
}

// ---------------------------------------------------------------------------
// Method: tasks/pushNotification/set
// ---------------------------------------------------------------------------

function handlePushNotificationSet(tasks: Map<string, TaskState>, rpcId: string | number | null, params: unknown, c: Context): Response {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	if (typeof params !== "object" || params === null) {
		return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params must be an object"))
	}

	const cfg = (params as Record<string, unknown>)["pushNotificationConfig"]
	if (typeof cfg !== "object" || cfg === null) {
		return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.pushNotificationConfig is required"))
	}

	const url = (cfg as Record<string, unknown>)["url"]
	if (typeof url !== "string") {
		return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "pushNotificationConfig.url must be a string"))
	}

	let task = tasks.get(taskId)
	if (!task) {
		task = {
			id: taskId,
			sessionId: taskId,
			agentConfigId: undefined,
			status: "submitted",
			messages: [],
		}
		tasks.set(taskId, task)
	}

	task.pushNotificationUrl = url

	const auth = (cfg as Record<string, unknown>)["authentication"]
	if (typeof auth === "object" && auth !== null) {
		const credentials = (auth as Record<string, unknown>)["credentials"]
		if (typeof credentials === "string") task.pushNotificationCredentials = credentials
	}

	return c.json(rpcOk(rpcId, { id: taskId, pushNotificationConfig: { url } }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createA2ARouter(sessionManager: SessionManager, pool: Pool): Hono {
	// Task registry scoped to this router instance — no module-level state.
	const tasks = new Map<string, TaskState>()

	// Delegation hook — future agent tool for spawning sub-tasks:
	//
	//   async function spawnSubTask(parentTaskId: string, agentConfigId: string, message: string): Promise<TaskState>
	//
	// The spawned task is created with `parentTaskId` set so it appears in
	// taskView. To hide sub-tasks from A2A callers later, remove parentTaskId
	// from taskView() without touching this spawn path.

	const router = new Hono()

	// Agent Card — served here too so /a2a and /.well-known/agent.json both work
	router.get("/agent.json", async (c) => {
		const card = await buildAgentCard(pool)
		return c.json(card)
	})

	router.post("/", async (c) => {
		let body: unknown
		try {
			body = await c.req.json()
		} catch {
			return c.json(rpcErr(null, RPC_PARSE_ERROR, "Parse error"), 400)
		}

		if (typeof body !== "object" || body === null) {
			return c.json(rpcErr(null, RPC_INVALID_REQUEST, "Request must be a JSON object"), 400)
		}

		const req = body as Partial<JsonRpcRequest>

		if (req.jsonrpc !== "2.0") {
			return c.json(rpcErr(req.id ?? null, RPC_INVALID_REQUEST, 'jsonrpc must be "2.0"'), 400)
		}

		const rpcId = req.id ?? null

		if (typeof req.method !== "string") {
			return c.json(rpcErr(rpcId, RPC_INVALID_REQUEST, "method must be a string"), 400)
		}

		switch (req.method) {
			case "tasks/send":
				return handleTasksSend(tasks, rpcId, req.params, sessionManager, c)
			case "tasks/sendSubscribe":
				return handleTasksSendSubscribe(tasks, rpcId, req.params, sessionManager, c)
			case "tasks/get":
				return handleTasksGet(tasks, rpcId, req.params, c)
			case "tasks/cancel":
				return handleTasksCancel(tasks, rpcId, req.params, c)
			case "tasks/pushNotification/set":
				return handlePushNotificationSet(tasks, rpcId, req.params, c)
			default:
				return c.json(rpcErr(rpcId, RPC_METHOD_NOT_FOUND, `Method not found: ${req.method}`), 404)
		}
	})

	return router
}
