import { randomUUID } from "node:crypto"
import { Agent, type AgentEvent as PiAgentEvent } from "@mariozechner/pi-agent-core"
import { getEnvApiKey } from "@mariozechner/pi-ai"
import { convertToLlm } from "@mariozechner/pi-coding-agent"
import { DEFAULT_SYSTEM_PROMPT } from "./pi/config.js"
import { resolveModel } from "./pi/model.js"
import { formatSkillsForPrompt } from "./pi/skills.js"
import { buildToolList } from "./pi/tools.js"
import type { AgentMessage, AgentProvider, AgentSession, AgentSessionOpts, AgentStreamEvent } from "./types.js"

class PiAgentSession implements AgentSession {
	private agent: Agent
	private messages: AgentMessage[] = []

	constructor(opts: AgentSessionOpts) {
		const { model } = resolveModel(opts.provider, opts.model)
		const toolList = buildToolList(opts.workspaceDir, opts.toolsEnabled)
		const basePrompt = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
		const fullPrompt = opts.skills?.length ? basePrompt + formatSkillsForPrompt(opts.skills) : basePrompt

		this.agent = new Agent({
			initialState: {
				systemPrompt: fullPrompt,
				model,
				thinkingLevel: opts.thinkingLevel ?? "off",
				tools: toolList,
			},
			convertToLlm,
			getApiKey: (provider: string) => {
				return getEnvApiKey(provider)
			},
		})
	}

	async *sendMessage(content: string, signal?: AbortSignal): AsyncGenerator<AgentStreamEvent> {
		const userMsg: AgentMessage = {
			id: randomUUID(),
			role: "user",
			content,
			createdAt: new Date().toISOString(),
		}
		this.messages.push(userMsg)

		const eventQueue: AgentStreamEvent[] = []
		let resolveWaiting: (() => void) | null = null
		let done = false

		function enqueue(event: AgentStreamEvent): void {
			eventQueue.push(event)
			if (resolveWaiting) {
				resolveWaiting()
				resolveWaiting = null
			}
		}

		let fullResponseText = ""
		let messageId = randomUUID()

		const unsubscribe = this.agent.subscribe((event: PiAgentEvent) => {
			switch (event.type) {
				case "agent_start":
					enqueue({ type: "turn_start", id: randomUUID() })
					break

				case "message_start":
					if (event.message.role === "assistant") {
						messageId = randomUUID()
						fullResponseText = ""
						enqueue({ type: "message_start", id: messageId })
					}
					break

				case "message_update": {
					const assistantEvent = event.assistantMessageEvent
					if (assistantEvent.type === "text_delta") {
						fullResponseText += assistantEvent.delta
						enqueue({ type: "message_update", id: messageId, text: assistantEvent.delta })
					} else if (assistantEvent.type === "thinking_delta") {
						enqueue({ type: "thinking_update", id: messageId, text: assistantEvent.delta })
					}
					break
				}

				case "message_end":
					if (event.message.role === "assistant") {
						enqueue({ type: "message_end", id: messageId })
					}
					break

				case "tool_execution_start":
					enqueue({
						type: "tool_call_start",
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						toolArgs: typeof event.args === "string" ? event.args : JSON.stringify(event.args),
					})
					break

				case "tool_execution_update":
					enqueue({
						type: "tool_call_update",
						toolCallId: event.toolCallId,
						toolName: event.toolName,
					})
					break

				case "tool_execution_end": {
					const resultText =
						event.result?.content
							?.map((c: { type: string; text?: string }) => (c.type === "text" ? c.text : ""))
							.join("") ?? ""
					enqueue({
						type: "tool_call_end",
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						toolResult: resultText,
						isToolError: event.isError,
					})
					break
				}

				case "agent_end": {
					const errorMessages: string[] = []
					for (const m of event.messages) {
						if (m.role === "assistant" && "errorMessage" in m && m.errorMessage) {
							errorMessages.push(m.errorMessage)
						}
					}
					if (errorMessages.length > 0) {
						enqueue({ type: "error", error: errorMessages.join("; ") })
					}
					enqueue({ type: "turn_end", id: randomUUID() })
					done = true
					if (resolveWaiting) {
						resolveWaiting()
						resolveWaiting = null
					}
					break
				}

				case "turn_start":
				case "turn_end":
					break
			}
		})

		if (signal) {
			signal.addEventListener(
				"abort",
				() => {
					this.agent.abort()
				},
				{ once: true },
			)
		}

		const promptPromise = this.agent.prompt(content).catch((err: unknown) => {
			const errorMsg = err instanceof Error ? err.message : "Unknown agent error"
			enqueue({ type: "error", error: errorMsg })
			done = true
			if (resolveWaiting) {
				resolveWaiting()
				resolveWaiting = null
			}
		})

		try {
			while (!done || eventQueue.length > 0) {
				if (eventQueue.length > 0) {
					const event = eventQueue.shift()!
					yield event
				} else if (!done) {
					await new Promise<void>((resolve) => {
						resolveWaiting = resolve
					})
				}
			}
		} finally {
			unsubscribe()
			await promptPromise
		}

		if (fullResponseText) {
			const assistantMsg: AgentMessage = {
				id: messageId,
				role: "assistant",
				content: fullResponseText,
				createdAt: new Date().toISOString(),
			}
			this.messages.push(assistantMsg)
		}
	}

	getMessages(): AgentMessage[] {
		return this.messages
	}
}

export class PiAgentProvider implements AgentProvider {
	readonly id = "openzosma-agent"
	readonly name = "OpenZosma Agent"

	createSession(opts: AgentSessionOpts): AgentSession {
		return new PiAgentSession(opts)
	}
}
