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
 *   One card for the whole instance. Skills are the union of skills[] tags
 *   across all agent_configs rows. Display names come from SKILL_METADATA for
 *   the three documented skills (coding, database, reports); unknown tags pass
 *   through with an empty description. When a dedicated skills table is added
 *   to the DB, SKILL_METADATA should be replaced by a query against it.
 *
 * Skill-based routing:
 *   Callers may pass `skillId` (e.g. "coding", "database") in task params to
 *   route to the first agent config that advertises that skill. Omitting it
 *   routes to the default agent (env-configured model, all tools).
 *
 * Delegation (stub):
 *   TaskState carries a `parentTaskId` field for future agent-to-agent
 *   delegation. Not yet exposed as a public RPC param. See the delegation
 *   stub comment in createA2ARouter for the intended pattern.
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
	/** Resolved internally from skillId — never set directly from RPC params. */
	agentConfigId: string | undefined
	/**
	 * Delegation stub — set when this task is spawned by another task.
	 * Not yet exposed as a public RPC param. When the delegation pattern is
	 * implemented, a parent agent will call spawnSubTask() which sets this
	 * field so the sub-task is traceable. To hide sub-tasks from A2A callers
	 * later, remove parentTaskId from taskView() without touching this field.
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
// Agent Card
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
 * Known skill metadata keyed by skill ID.
 *
 * These are the three skills documented in Phase 3 and Phase 6. The
 * agent_configs.skills column stores these as capability tags. Unknown IDs
 * pass through with an empty description.
 *
 * Replace this map with a DB query when a dedicated skills table is added.
 */
const SKILL_METADATA: Record<string, Omit<AgentCardSkill, "id">> = {
	coding: {
		name: "Coding Assistant",
		description: "Read, write, and edit code. Execute commands. Debug issues.",
	},
	database: {
		name: "Database Querying",
		description: "Query PostgreSQL, MySQL, MongoDB, ClickHouse, BigQuery, and SQLite databases.",
	},
	reports: {
		name: "Report Generation",
		description: "Generate PDF reports, PPTX presentations, and data visualizations.",
	},
}

/**
 * Build the Agent Card by unioning the skills[] tags across all agent_configs
 * rows. Each unique tag becomes one skill entry on the card.
 */
export async function buildAgentCard(pool: Pool): Promise<AgentCard> {
	const [configs, publicUrl, instanceName] = await Promise.all([
		agentConfigQueries.listAgentConfigs(pool),
		settingQueries.getSettingValue<string>(pool, "public_url"),
		settingQueries.getSettingValue<string>(pool, "instance_name"),
	])

	const skillIds = Array.from(new Set(configs.flatMap((c) => c.skills)))
	const skills: AgentCardSkill[] = skillIds.map((id) => ({
		id,
		...(SKILL_METADATA[id] ?? { name: id, description: "" }),
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
// Skill routing
// ---------------------------------------------------------------------------

interface ResolvedAgentConfig {
	id: string
	provider: string
	model: string
	systemPrompt: string | null
	toolsEnabled: string[]
}

/**
 * Resolve a skill ID (e.g. "coding") to the first agent config that
 * advertises that skill. Returns the full config so callers can pass it
 * directly to createSession without a second DB fetch.
 * Returns undefined when no match — session falls back to the default agent.
 */
async function resolveConfig(pool: Pool, skillId: string): Promise<ResolvedAgentConfig | undefined> {
	const configs = await agentConfigQueries.listAgentConfigs(pool)
	const match = configs.find((c) => c.skills.includes(skillId))
	if (!match) return undefined
	return {
		id: match.id,
		provider: match.provider,
		model: match.model,
		systemPrompt: match.systemPrompt,
		toolsEnabled: match.toolsEnabled,
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
		// parentTaskId included for debugging visibility.
		// Remove this line to hide delegated sub-tasks from A2A callers.
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

function extractSkillId(params: unknown): string | undefined {
	if (typeof params !== "object" || params === null) return undefined
	const v = (params as Record<string, unknown>)["skillId"]
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
): TaskState {
	const existing = tasks.get(taskId)
	if (existing) return existing
	const task: TaskState = {
		id: taskId,
		sessionId: taskId,
		agentConfigId,
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
	pool: Pool,
	rpcId: string | number | null,
	params: unknown,
	sessionManager: SessionManager,
	c: Context,
): Promise<Response> {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const userText = extractUserText(params)
	if (!userText) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.message must have at least one text part"))

	// Resolve skillId -> config in one DB query. The resolved config is passed
	// directly to createSession so it does not re-fetch by ID.
	const skillId = extractSkillId(params)
	const resolved = skillId ? await resolveConfig(pool, skillId) : undefined

	const task = getOrCreateTask(tasks, taskId, userText, resolved?.id)
	task.status = "working"

	const abort = new AbortController()
	task.abort = abort

	await sessionManager.createSession(task.sessionId, task.agentConfigId, resolved)

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
	pool: Pool,
	rpcId: string | number | null,
	params: unknown,
	sessionManager: SessionManager,
	c: Context,
): Promise<Response> {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const userText = extractUserText(params)
	if (!userText) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.message must have at least one text part"))

	const skillId = extractSkillId(params)
	const resolved = skillId ? await resolveConfig(pool, skillId) : undefined

	const task = getOrCreateTask(tasks, taskId, userText, resolved?.id)
	task.status = "working"

	const abort = new AbortController()
	task.abort = abort

	await sessionManager.createSession(task.sessionId, task.agentConfigId, resolved)

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

function handleTasksGet(
	tasks: Map<string, TaskState>,
	rpcId: string | number | null,
	params: unknown,
	c: Context,
): Response {
	const taskId = extractId(params)
	if (!taskId) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, "params.id is required"))

	const task = tasks.get(taskId)
	if (!task) return c.json(rpcErr(rpcId, RPC_INVALID_PARAMS, `Task ${taskId} not found`))

	return c.json(rpcOk(rpcId, taskView(task)))
}

// ---------------------------------------------------------------------------
// Method: tasks/cancel
// ---------------------------------------------------------------------------

function handleTasksCancel(
	tasks: Map<string, TaskState>,
	rpcId: string | number | null,
	params: unknown,
	c: Context,
): Response {
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

function handlePushNotificationSet(
	tasks: Map<string, TaskState>,
	rpcId: string | number | null,
	params: unknown,
	c: Context,
): Response {
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

	// ---------------------------------------------------------------------------
	// Delegation stub
	//
	// When an orchestrating agent needs a capability it doesn't have, it spawns
	// a new task targeting a different skill rather than switching agents mid-task
	// (A2A has no mid-task rerouting). The spawned task gets parentTaskId set so
	// it is traceable by the caller.
	//
	// Future implementation:
	//
	//   async function spawnSubTask(
	//     parentTaskId: string,
	//     skillId: string,
	//     message: string,
	//   ): Promise<TaskState> {
	//     const resolved = await resolveConfig(pool, skillId)
	//     const childId = randomUUID()
	//     const task = getOrCreateTask(tasks, childId, message, resolved?.id)
	//     task.parentTaskId = parentTaskId
	//     await sessionManager.createSession(task.sessionId, task.agentConfigId)
	//     // ... run turn, return task
	//   }
	//
	// To hide sub-tasks from A2A callers once delegation is stable, remove
	// parentTaskId from taskView() — TaskState itself stays unchanged.
	// ---------------------------------------------------------------------------

	const router = new Hono()

	// Agent Card — served under /a2a/agent.json as well as /.well-known/agent.json
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
				return handleTasksSend(tasks, pool, rpcId, req.params, sessionManager, c)
			case "tasks/sendSubscribe":
				return handleTasksSendSubscribe(tasks, pool, rpcId, req.params, sessionManager, c)
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
