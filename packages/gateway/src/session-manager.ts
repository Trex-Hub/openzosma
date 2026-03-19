import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import type { AgentProvider, AgentSession } from "@openzosma/agents"
import { PiAgentProvider } from "@openzosma/agents"
import type { Pool } from "@openzosma/db"
import { agentConfigQueries } from "@openzosma/db"
import type { GatewayEvent, Session, SessionMessage } from "./types.js"

/**
 * Per-session state holding the agent session and gateway-level metadata.
 */
interface SessionState {
	agentSession: AgentSession
	session: Session
}

export class SessionManager {
	private sessions = new Map<string, SessionState>()
	private provider: AgentProvider
	private pool: Pool | undefined

	constructor(provider?: AgentProvider, pool?: Pool) {
		this.provider = provider ?? new PiAgentProvider()
		this.pool = pool
	}

	async createSession(id?: string, agentConfigId?: string): Promise<Session> {
		// If the caller supplies an ID that already exists, return the existing session.
		if (id) {
			const existing = this.sessions.get(id)
			if (existing) return existing.session
		}

		const session: Session = {
			id: id ?? randomUUID(),
			agentConfigId,
			createdAt: new Date().toISOString(),
			messages: [],
		}

		const workspaceRoot = resolve(process.env.OPENZOSMA_WORKSPACE ?? join(process.cwd(), "workspace"))
		const sessionDir = join(workspaceRoot, "sessions", session.id)
		mkdirSync(sessionDir, { recursive: true })

		// Resolve agent config from DB when an ID is provided and pool is available.
		// Falls back to env-based defaults (model, system prompt, all tools) when not.
		let agentConfig: { provider?: string; model?: string; systemPrompt?: string | null; toolsEnabled?: string[] } = {}
		if (agentConfigId && this.pool) {
			const config = await agentConfigQueries.getAgentConfig(this.pool, agentConfigId)
			if (config) {
				agentConfig = {
					provider: config.provider,
					model: config.model,
					systemPrompt: config.systemPrompt ?? undefined,
					toolsEnabled: config.toolsEnabled,
				}
			}
		}

		const agentSession = this.provider.createSession({
			sessionId: session.id,
			workspaceDir: sessionDir,
			...agentConfig,
		})

		this.sessions.set(session.id, { agentSession, session })
		return session
	}

	getSession(id: string): Session | undefined {
		return this.sessions.get(id)?.session
	}

	/**
	 * Send a user message and stream back gateway events.
	 *
	 * Delegates to the configured AgentProvider's session, mapping
	 * AgentStreamEvents to GatewayEvents.
	 */
	async *sendMessage(sessionId: string, content: string, signal?: AbortSignal): AsyncGenerator<GatewayEvent> {
		// Auto-create session on first message if it doesn't exist yet.
		// This allows the web app to use its own conversation IDs directly.
		if (!this.sessions.has(sessionId)) {
			await this.createSession(sessionId)
		}

		const state = this.sessions.get(sessionId)
		if (!state) {
			yield { type: "error", error: `Session ${sessionId} could not be initialized` }
			return
		}
		const { agentSession, session } = state

		// Store user message
		const userMsg: SessionMessage = {
			id: randomUUID(),
			role: "user",
			content,
			createdAt: new Date().toISOString(),
		}
		session.messages.push(userMsg)

		let lastAssistantText = ""
		let lastMessageId: string | undefined

		for await (const event of agentSession.sendMessage(content, signal)) {
			// AgentStreamEvent and GatewayEvent have the same shape --
			// pass through directly, tracking text for session history.
			const gatewayEvent: GatewayEvent = event as GatewayEvent

			if (event.type === "message_start") {
				lastMessageId = event.id
				lastAssistantText = ""
			} else if (event.type === "message_update" && event.text) {
				lastAssistantText += event.text
			}

			yield gatewayEvent
		}

		// Store assistant message for session history
		if (lastAssistantText) {
			const assistantMsg: SessionMessage = {
				id: lastMessageId ?? randomUUID(),
				role: "assistant",
				content: lastAssistantText,
				createdAt: new Date().toISOString(),
			}
			session.messages.push(assistantMsg)
		}
	}
}
