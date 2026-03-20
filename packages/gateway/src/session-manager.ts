import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import type { AgentProvider, AgentSession, AgentSessionOpts } from "@openzosma/agents"
import { PiAgentProvider } from "@openzosma/agents"
import { agentConfigQueries, agentSkillQueries } from "@openzosma/db"
import type pg from "pg"
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

	constructor(
		provider?: AgentProvider,
		private db?: pg.Pool,
	) {
		this.provider = provider ?? new PiAgentProvider()
	}

	/**
	 * Ensure a session exists, creating it with the given agentConfigId if not.
	 * Used by the WS handler before streaming to guarantee the session is ready.
	 */
	async ensureSession(id: string, agentConfigId?: string): Promise<Session> {
		const existing = this.sessions.get(id)
		if (existing) return existing.session
		return this.createSession(id, agentConfigId)
	}

	async createSession(id?: string, agentConfigId?: string): Promise<Session> {
		// If the caller supplies an ID that already exists, return the existing session.
		if (id) {
			const existing = this.sessions.get(id)
			if (existing) return existing.session
		}

		const session: Session = {
			id: id ?? randomUUID(),
			createdAt: new Date().toISOString(),
			messages: [],
		}

		const workspaceRoot = resolve(process.env.OPENZOSMA_WORKSPACE ?? join(process.cwd(), "workspace"))
		const sessionDir = join(workspaceRoot, "sessions", session.id)
		mkdirSync(sessionDir, { recursive: true })

		let agentOpts: AgentSessionOpts = { sessionId: session.id, workspaceDir: sessionDir }

		if (agentConfigId && this.db) {
			const config = await agentConfigQueries.getAgentConfig(this.db, agentConfigId)
			if (config) {
				const skills = await agentSkillQueries.getSkillsForConfig(this.db, agentConfigId)
				const piCfg = config.config as Record<string, unknown>
				agentOpts = {
					...agentOpts,
					provider: typeof piCfg.provider === "string" ? piCfg.provider : undefined,
					model: typeof piCfg.model === "string" ? piCfg.model : undefined,
					toolsEnabled: Array.isArray(piCfg.tools_enabled) ? (piCfg.tools_enabled as string[]) : undefined,
					thinkingLevel:
						typeof piCfg.thinking_level === "string"
							? (piCfg.thinking_level as AgentSessionOpts["thinkingLevel"])
							: undefined,
					systemPrompt: config.systemPrompt ?? undefined,
					skills,
				}
			}
		}

		const agentSession = this.provider.createSession(agentOpts)
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
		// Session should already be ensured by the WS handler; create a bare fallback if not.
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
