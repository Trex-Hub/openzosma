/**
 * A2A Protocol implementation using the a2a-js SDK.
 *
 * Each agent_configs row is exposed as a separate A2A agent with its own
 * Agent Card and JSON-RPC endpoint. External A2A callers discover agents
 * via the card listing and address them directly by config ID.
 *
 * URL structure:
 *   GET  /a2a/agents                         — list all agent cards
 *   GET  /a2a/agents/:configId/agent.json    — card for one agent
 *   POST /a2a/agents/:configId               — JSON-RPC 2.0 endpoint
 *   GET  /.well-known/agent.json             — default (first) agent card
 */

import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import type { Pool } from "@openzosma/db"
import type { AgentConfig } from "@openzosma/db"
import { agentConfigQueries, settingQueries } from "@openzosma/db"
import type { SessionManager } from "./session-manager.js"
import type {
	AgentCard,
	AgentSkill,
	Task,
	SendMessageRequest,
	SendMessageResponse,
	SendMessageStreamingRequest,
	SendMessageStreamingResponse,
	CancelTaskRequest,
	CancelTaskResponse,
	TaskResubscriptionRequest,
	JSONRPCRequest,
} from "a2a-js"
import {
	Role,
	TaskState,
	DefaultA2ARequestHandler,
	OperationNotSupportedError,
	JSONRPCErrorCode,
} from "a2a-js"
import type { AgentExecutor } from "a2a-js"

// ---------------------------------------------------------------------------
// Skill metadata
// ---------------------------------------------------------------------------

const SKILL_METADATA: Record<string, Omit<AgentSkill, "id">> = {
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

// ---------------------------------------------------------------------------
// Agent Card builder — one card per agent config
// ---------------------------------------------------------------------------

export async function buildAgentCardForConfig(
	pool: Pool,
	config: AgentConfig,
): Promise<AgentCard> {
	const publicUrl = await settingQueries.getSettingValue<string>(pool, "public_url")
	const base = publicUrl ?? process.env["PUBLIC_URL"] ?? "http://localhost:4000"

	const skills: AgentSkill[] = config.skills.map((id) => ({
		id,
		name: SKILL_METADATA[id]?.name ?? id,
		description: SKILL_METADATA[id]?.description ?? null,
	}))

	return {
		name: config.name,
		description: config.description ?? `Agent: ${config.name}`,
		url: `${base}/a2a/agents/${config.id}`,
		version: "1.0.0",
		capabilities: {
			streaming: true,
			pushNotifications: false,
			stateTransitionHistory: true,
		},
		skills,
		authentication: { schemes: ["bearer"] },
	}
}

export async function buildAllAgentCards(pool: Pool): Promise<AgentCard[]> {
	const configs = await agentConfigQueries.listAgentConfigs(pool)
	return Promise.all(configs.map((c) => buildAgentCardForConfig(pool, c)))
}

export async function buildDefaultAgentCard(pool: Pool): Promise<AgentCard | null> {
	const configs = await agentConfigQueries.listAgentConfigs(pool)
	if (configs.length === 0) return null
	return buildAgentCardForConfig(pool, configs[0])
}

// ---------------------------------------------------------------------------
// AgentExecutor — bridges a2a-js to SessionManager
// ---------------------------------------------------------------------------

function extractUserText(parts: Array<{ type: string; text?: string }>): string | null {
	const text = parts
		.filter((p) => p.type === "text" && typeof p.text === "string")
		.map((p) => p.text)
		.join("")
	return text || null
}

class OpenZosmaAgentExecutor implements AgentExecutor {
	private sessionManager: SessionManager
	private agentConfigId: string
	private resolvedConfig: {
		provider: string
		model: string
		systemPrompt: string | null
		toolsEnabled: string[]
	}
	private abortControllers = new Map<string, AbortController>()

	constructor(
		sessionManager: SessionManager,
		agentConfigId: string,
		resolvedConfig: {
			provider: string
			model: string
			systemPrompt: string | null
			toolsEnabled: string[]
		},
	) {
		this.sessionManager = sessionManager
		this.agentConfigId = agentConfigId
		this.resolvedConfig = resolvedConfig
	}

	cancelTask(taskId: string): void {
		const ctrl = this.abortControllers.get(taskId)
		if (ctrl) {
			ctrl.abort()
			this.abortControllers.delete(taskId)
		}
	}

	async onMessageSend(
		request: SendMessageRequest,
		task?: Task,
	): Promise<SendMessageResponse> {
		const params = request.params as unknown as Record<string, unknown>
		const taskId = (params["id"] as string | undefined) ?? task?.id
		if (!taskId) {
			return {
				jsonrpc: "2.0",
				id: request.id,
				error: { code: JSONRPCErrorCode.InvalidParams, message: "Task ID is required" },
			}
		}

		const message = params["message"] as { parts?: Array<{ type: string; text?: string }> } | undefined
		const userText = message?.parts ? extractUserText(message.parts) : null
		if (!userText) {
			return {
				jsonrpc: "2.0",
				id: request.id,
				error: { code: JSONRPCErrorCode.InvalidParams, message: "Message must have at least one text part" },
			}
		}

		await this.sessionManager.createSession(taskId, this.agentConfigId, this.resolvedConfig)

		const abort = new AbortController()
		this.abortControllers.set(taskId, abort)

		let assistantText = ""

		try {
			for await (const event of this.sessionManager.sendMessage(taskId, userText, abort.signal)) {
				if (event.type === "message_update" && event.text) {
					assistantText += event.text
				}
			}
		} catch (e) {
			this.abortControllers.delete(taskId)
			const resultTask: Task = {
				id: taskId,
				sessionId: taskId,
				status: {
					state: abort.signal.aborted ? TaskState.Canceled : TaskState.Failed,
					message: {
						role: Role.Agent,
						parts: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
					},
				},
			}
			return { jsonrpc: "2.0", id: request.id, result: resultTask }
		}

		this.abortControllers.delete(taskId)

		const resultTask: Task = {
			id: taskId,
			sessionId: taskId,
			status: { state: TaskState.Completed },
			history: [
				{ role: Role.User, parts: [{ type: "text", text: userText }] },
				{ role: Role.Agent, parts: [{ type: "text", text: assistantText }] },
			],
		}

		return { jsonrpc: "2.0", id: request.id, result: resultTask }
	}

	async *onMessageStream(
		request: SendMessageStreamingRequest,
		task?: Task,
	): AsyncGenerator<SendMessageStreamingResponse, void, unknown> {
		const params = request.params as unknown as Record<string, unknown>
		const taskId = (params["id"] as string | undefined) ?? task?.id
		if (!taskId) {
			yield {
				jsonrpc: "2.0",
				id: request.id,
				error: { code: JSONRPCErrorCode.InvalidParams, message: "Task ID is required" },
			}
			return
		}

		const message = params["message"] as { parts?: Array<{ type: string; text?: string }> } | undefined
		const userText = message?.parts ? extractUserText(message.parts) : null
		if (!userText) {
			yield {
				jsonrpc: "2.0",
				id: request.id,
				error: { code: JSONRPCErrorCode.InvalidParams, message: "Message must have at least one text part" },
			}
			return
		}

		await this.sessionManager.createSession(taskId, this.agentConfigId, this.resolvedConfig)

		const abort = new AbortController()
		this.abortControllers.set(taskId, abort)

		yield {
			jsonrpc: "2.0",
			id: request.id,
			result: {
				role: Role.Agent,
				parts: [{ type: "text", text: "" }],
				metadata: { taskId, state: TaskState.Working },
			},
		}

		let assistantText = ""

		try {
			for await (const event of this.sessionManager.sendMessage(taskId, userText, abort.signal)) {
				if (event.type === "message_update" && event.text) {
					assistantText += event.text
					yield {
						jsonrpc: "2.0",
						id: request.id,
						result: {
							role: Role.Agent,
							parts: [{ type: "text", text: event.text }],
							metadata: { taskId, state: TaskState.Working },
						},
					}
				}
			}

			yield {
				jsonrpc: "2.0",
				id: request.id,
				result: {
					role: Role.Agent,
					parts: [{ type: "text", text: assistantText }],
					metadata: { taskId, state: TaskState.Completed, final: true },
				},
			}
		} catch (e) {
			const state = abort.signal.aborted ? TaskState.Canceled : TaskState.Failed
			yield {
				jsonrpc: "2.0",
				id: request.id,
				result: {
					role: Role.Agent,
					parts: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
					metadata: { taskId, state, final: true },
				},
			}
		} finally {
			this.abortControllers.delete(taskId)
		}
	}

	async onCancel(
		request: CancelTaskRequest,
		task: Task,
	): Promise<CancelTaskResponse> {
		this.cancelTask(task.id)
		const updated: Task = {
			...task,
			status: { state: TaskState.Canceled },
		}
		return { jsonrpc: "2.0", id: request.id, result: updated }
	}

	async *onResubscribe(
		_request: TaskResubscriptionRequest,
		_task: Task,
	): AsyncGenerator<SendMessageStreamingResponse, void, unknown> {
		yield {
			jsonrpc: "2.0",
			id: _request.id,
			error: new OperationNotSupportedError(),
		}
	}
}

// ---------------------------------------------------------------------------
// Per-agent handler cache
// ---------------------------------------------------------------------------

interface AgentHandler {
	requestHandler: DefaultA2ARequestHandler
	executor: OpenZosmaAgentExecutor
}

function getOrCreateHandler(
	handlers: Map<string, AgentHandler>,
	configId: string,
	config: AgentConfig,
	sessionManager: SessionManager,
): AgentHandler {
	const existing = handlers.get(configId)
	if (existing) return existing

	const executor = new OpenZosmaAgentExecutor(sessionManager, configId, {
		provider: config.provider,
		model: config.model,
		systemPrompt: config.systemPrompt,
		toolsEnabled: config.toolsEnabled,
	})
	const requestHandler = new DefaultA2ARequestHandler(executor)
	const handler: AgentHandler = { requestHandler, executor }
	handlers.set(configId, handler)
	return handler
}

// ---------------------------------------------------------------------------
// Hono Router
// ---------------------------------------------------------------------------

export function createPerAgentRouter(sessionManager: SessionManager, pool: Pool): Hono {
	const handlers = new Map<string, AgentHandler>()
	const router = new Hono()

	// List all agent cards
	router.get("/agents", async (c) => {
		const cards = await buildAllAgentCards(pool)
		return c.json(cards)
	})

	// Per-agent card
	router.get("/agents/:configId/agent.json", async (c) => {
		const configId = c.req.param("configId")
		const config = await agentConfigQueries.getAgentConfig(pool, configId)
		if (!config) {
			return c.json({ error: "Agent not found" }, 404)
		}
		const card = await buildAgentCardForConfig(pool, config)
		return c.json(card)
	})

	// Per-agent JSON-RPC endpoint
	router.post("/agents/:configId", async (c) => {
		const configId = c.req.param("configId")
		const config = await agentConfigQueries.getAgentConfig(pool, configId)
		if (!config) {
			return c.json(
				{ jsonrpc: "2.0", id: null, error: { code: JSONRPCErrorCode.InvalidParams, message: "Agent not found" } },
				404,
			)
		}

		let body: unknown
		try {
			body = await c.req.json()
		} catch {
			return c.json(
				{ jsonrpc: "2.0", id: null, error: { code: JSONRPCErrorCode.ParseError, message: "Parse error" } },
				400,
			)
		}

		if (typeof body !== "object" || body === null) {
			return c.json(
				{ jsonrpc: "2.0", id: null, error: { code: JSONRPCErrorCode.InvalidRequest, message: "Request must be a JSON object" } },
				400,
			)
		}

		const req = body as Partial<JSONRPCRequest>
		if (req.jsonrpc !== "2.0") {
			return c.json(
				{ jsonrpc: "2.0", id: req.id ?? null, error: { code: JSONRPCErrorCode.InvalidRequest, message: 'jsonrpc must be "2.0"' } },
				400,
			)
		}

		const rpcId = req.id ?? null

		if (typeof req.method !== "string") {
			return c.json(
				{ jsonrpc: "2.0", id: rpcId, error: { code: JSONRPCErrorCode.InvalidRequest, message: "method must be a string" } },
				400,
			)
		}

		const { requestHandler } = getOrCreateHandler(handlers, configId, config, sessionManager)
		const rpcRequest = body as JSONRPCRequest

		switch (req.method) {
			case "tasks/send":
			case "message/send": {
				const response = await requestHandler.onMessageSend(rpcRequest as unknown as SendMessageRequest)
				return c.json(response)
			}

			case "tasks/sendSubscribe":
			case "message/sendStream": {
				return streamSSE(c, async (stream) => {
					const gen = requestHandler.onMessageSendStream(rpcRequest as unknown as SendMessageStreamingRequest)
					for await (const chunk of gen) {
						if (stream.aborted) break
						await stream.writeSSE({ data: JSON.stringify(chunk) })
					}
				})
			}

			case "tasks/get": {
				const response = await requestHandler.onGetTask(rpcRequest as Parameters<typeof requestHandler.onGetTask>[0])
				return c.json(response)
			}

			case "tasks/cancel": {
				const response = await requestHandler.onCancelTask(rpcRequest as unknown as CancelTaskRequest)
				return c.json(response)
			}

			default:
				return c.json(
					{ jsonrpc: "2.0", id: rpcId, error: { code: JSONRPCErrorCode.MethodNotFound, message: `Method not found: ${req.method}` } },
					404,
				)
		}
	})

	return router
}
