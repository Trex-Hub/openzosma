"use client"

import { Conversation, ConversationContent, ConversationScrollButton } from "@/src/components/ai-elements/conversation"
import { MessageResponse } from "@/src/components/ai-elements/message"
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/src/components/ai-elements/prompt-input"
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar"
import { Badge } from "@/src/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible"
import { GATEWAY_URL } from "@/src/lib/constants"
import type { AgentStreamEvent } from "@openzosma/agents/types"
import { IconMessageCircle, IconRobot, IconSparkles, IconUser } from "@tabler/icons-react"
import type { FileUIPart } from "ai"
import { AnimatePresence, motion } from "framer-motion"
import {
	BrainIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	DatabaseIcon,
	DownloadIcon,
	FileIcon,
	ListIcon,
	LoaderIcon,
	SearchIcon,
	WrenchIcon,
	XCircleIcon,
} from "lucide-react"
import { useParams, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

// ── Types ────────────────────────────────────────────────────────────────────

type ChatParticipant = {
	id: string
	participanttype: string
	participantid: string
	participantname: string | null
	joinedat: string
}

type ChatAttachment = {
	id: string
	type: string
	filename: string | null
	mediatype: string | null
	url: string | null
	sizebytes: number | null
	metadata: Record<string, unknown>
}

type ChatMessage = {
	id: string
	sendertype: string
	senderid: string
	content: string
	metadata: Record<string, unknown>
	createdat: string
	attachments: ChatAttachment[]
}

type ConversationData = {
	id: string
	title: string
	createdby: string
	createdat: string
	updatedat: string
}

type StreamToolCall = {
	toolcallid: string
	toolname: string
	args: Record<string, unknown> | string
	state: "calling" | "streaming-args" | "result" | "error"
	result?: unknown
	iserror?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TOOL_DISPLAY: Record<string, { label: string; icon: typeof WrenchIcon }> = {
	listintegrationstool: {
		label: "Discovering databases",
		icon: ListIcon,
	},
	searchknowledgetool: {
		label: "Searching knowledge base",
		icon: SearchIcon,
	},
	executesqlquerytool: {
		label: "Running SQL query",
		icon: DatabaseIcon,
	},
}

function gettooldisplay(toolname: string) {
	return (
		TOOL_DISPLAY[toolname] || {
			label: toolname,
			icon: WrenchIcon,
		}
	)
}

// ── Tool Activity Pill ───────────────────────────────────────────────────────

function ToolActivityPill({ tool }: { tool: StreamToolCall }) {
	const display = gettooldisplay(tool.toolname)
	const Icon = display.icon

	return (
		<Collapsible>
			<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs transition-colors hover:bg-muted/70">
				<div className="flex flex-1 items-center gap-2 min-w-0">
					{tool.state === "calling" || tool.state === "streaming-args" ? (
						<LoaderIcon className="size-3.5 animate-spin text-primary shrink-0" />
					) : tool.state === "error" || tool.iserror ? (
						<XCircleIcon className="size-3.5 text-destructive shrink-0" />
					) : (
						<CheckCircleIcon className="size-3.5 text-emerald-500 shrink-0" />
					)}
					<Icon className="size-3.5 text-muted-foreground shrink-0" />
					<span className="font-medium text-foreground truncate">{display.label}</span>
					{(tool.state === "calling" || tool.state === "streaming-args") && (
						<Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 shrink-0">
							Running
						</Badge>
					)}
					{tool.state === "result" && !tool.iserror && (
						<Badge
							variant="secondary"
							className="ml-auto text-[10px] px-1.5 py-0 shrink-0 bg-emerald-500/10 text-emerald-600"
						>
							Done
						</Badge>
					)}
					{(tool.state === "error" || tool.iserror) && (
						<Badge
							variant="secondary"
							className="ml-auto text-[10px] px-1.5 py-0 shrink-0 bg-destructive/10 text-destructive"
						>
							Error
						</Badge>
					)}
				</div>
				<ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-1.5 space-y-1.5">
				{/* Tool args */}
				{tool.args && Object.keys(tool.args).length > 0 && (
					<div className="rounded-md border bg-background px-3 py-2">
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Parameters</p>
						<pre className="text-[11px] text-foreground overflow-auto max-h-32 whitespace-pre-wrap font-mono">
							{typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}
						</pre>
					</div>
				)}
				{/* Tool result */}
				{tool.result !== undefined && (
					<div className="rounded-md border bg-background px-3 py-2">
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
							{tool.iserror ? "Error" : "Result"}
						</p>
						<pre
							className={`text-[11px] overflow-auto max-h-48 whitespace-pre-wrap font-mono ${
								tool.iserror ? "text-destructive" : "text-foreground"
							}`}
						>
							{typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)}
						</pre>
					</div>
				)}
			</CollapsibleContent>
		</Collapsible>
	)
}

// ── Reasoning Section ────────────────────────────────────────────────────────

function ReasoningSection({
	text,
	isstreaming,
}: {
	text: string
	isstreaming: boolean
}) {
	if (!text) return null

	return (
		<Collapsible defaultOpen>
			<CollapsibleTrigger className="group flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground mb-1">
				<BrainIcon className="size-3.5" />
				<span className="font-medium">{isstreaming ? "Thinking..." : "Thought process"}</span>
				<ChevronDownIcon className="size-3 transition-transform group-data-[state=open]:rotate-180" />
			</CollapsibleTrigger>
			<CollapsibleContent className="ml-5.5 text-xs text-muted-foreground">
				<div className="border-l-2 border-muted pl-3 py-1 whitespace-pre-wrap">{text}</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

// ── Main ChatView ────────────────────────────────────────────────────────────

const ChatView = () => {
	const { conversationid } = useParams<{
		conversationid: string
	}>()
	const searchparams = useSearchParams()

	const [conversation, setConversation] = useState<ConversationData | null>(null)
	const [participants, setParticipants] = useState<ChatParticipant[]>([])
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [loading, setLoading] = useState(true)
	const [streaming, setStreaming] = useState(false)
	const [streamingcontent, setStreamingcontent] = useState("")
	const [streamingtoolcalls, setStreamingtoolcalls] = useState<StreamToolCall[]>([])
	const [streamingreasoning, setStreamingreasoning] = useState("")
	const textarearef = useRef<HTMLTextAreaElement>(null)
	const initialhandled = useRef(false)

	const hasmessages = messages.length > 0 || streaming

	const fetchconversation = useCallback(async () => {
		try {
			const res = await fetch(`/api/conversations/${conversationid}`)
			if (res.ok) {
				const data = await res.json()
				setConversation(data.conversation)
				setParticipants(data.participants)
				setMessages(data.messages)
			} else {
				toast.error("Failed to load conversation")
			}
		} catch {
			toast.error("Failed to load conversation")
		}
		setLoading(false)
	}, [conversationid])

	useEffect(() => {
		fetchconversation()
	}, [fetchconversation])

	// Handle initial message passed via query param from the chat root page
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only runs on loading/searchparams change
	useEffect(() => {
		if (initialhandled.current) return
		if (loading) return

		const initialmessage = searchparams.get("initial")
		if (initialmessage && messages.length === 0) {
			initialhandled.current = true
			handlesubmit({ text: initialmessage, files: [] })
		}
	}, [loading, searchparams])

	const getparticipantname = (senderid: string, sendertype: string) => {
		const participant = participants.find((p) => p.participantid === senderid && p.participanttype === sendertype)
		return participant?.participantname || (sendertype === "human" ? "You" : "Agent")
	}

	const savemessage = async (
		sendertype: string,
		senderid: string,
		content: string,
		metadata?: Record<string, unknown>,
		attachments?: {
			type: string
			filename: string
			mediatype: string
			url: string
			sizebytes: number
		}[],
	) => {
		try {
			const res = await fetch(`/api/conversations/${conversationid}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sendertype,
					senderid,
					content,
					metadata: metadata || {},
					attachments: attachments || [],
				}),
			})
			if (res.ok) {
				const data = await res.json()
				return data.message
			}
		} catch {
			console.error("Failed to save message")
		}
		return null
	}

	const handlesubmit = async (message: {
		text: string
		files: FileUIPart[]
	}) => {
		if (!message.text.trim() && message.files.length === 0) return

		const userid = conversation?.createdby || "unknown"

		// Add user message optimistically
		const usermsg: ChatMessage = {
			id: `temp-${Date.now()}`,
			sendertype: "human",
			senderid: userid,
			content: message.text,
			metadata: {},
			createdat: new Date().toISOString(),
			attachments: message.files.map((f, i) => ({
				id: `temp-att-${i}`,
				type: f.mediaType?.startsWith("image/") ? "media" : "file",
				filename: f.filename || null,
				mediatype: f.mediaType || null,
				url: f.url || null,
				sizebytes: null,
				metadata: {},
			})),
		}
		setMessages((prev) => [...prev, usermsg])

		// Save user message to DB
		await savemessage("human", userid, message.text)

		// Find agent participant
		const agentparticipant = participants.find((p) => p.participanttype === "agent")

		if (!agentparticipant) {
			fetchconversation()
			return
		}

		// Stream response from gateway via WebSocket
		setStreaming(true)
		setStreamingcontent("")
		setStreamingtoolcalls([])
		setStreamingreasoning("")

		try {
			// Build WebSocket URL from GATEWAY_URL
			const wsurl = `${GATEWAY_URL.replace(/^http/, "ws")}/ws`
			const ws = new WebSocket(wsurl)
			let fullcontent = ""
			let fullreasoning = ""
			const toolcalls: Record<string, StreamToolCall> = {}

			const updatetoolcalls = () => {
				setStreamingtoolcalls(Object.values(toolcalls))
			}

			await new Promise<void>((resolve, reject) => {
				ws.onopen = () => {
					// Send the user message to the gateway
					ws.send(
						JSON.stringify({
							type: "message",
							sessionId: conversationid,
							content: message.text,
						}),
					)
				}

				ws.onmessage = (event) => {
					let evt: AgentStreamEvent
					try {
						evt = JSON.parse(event.data)
					} catch {
						return
					}

					switch (evt.type) {
						// ── Text streaming ───────────────────────────────
						case "message_update": {
							if (evt.text) {
								fullcontent += evt.text
								setStreamingcontent(fullcontent)
							}
							break
						}

						// ── Tool calls ───────────────────────────────────
						case "tool_call_start": {
							const { toolCallId, toolName, toolArgs } = evt
							if (toolCallId) {
								let parsedargs = {}
								if (toolArgs) {
									try {
										parsedargs = JSON.parse(toolArgs)
									} catch {
										parsedargs = toolArgs
									}
								}
								toolcalls[toolCallId] = {
									toolcallid: toolCallId,
									toolname: toolName || "unknown",
									args: parsedargs,
									state: "calling",
								}
								updatetoolcalls()
							}
							break
						}
						case "tool_call_update": {
							const { toolCallId, toolResult } = evt
							if (toolCallId && toolcalls[toolCallId]) {
								// Partial result streaming
								const existing = toolcalls[toolCallId]
								const rawtext = typeof existing.result === "string" ? existing.result : ""
								existing.result = rawtext + (toolResult || "")
								existing.state = "streaming-args"
								updatetoolcalls()
							}
							break
						}
						case "tool_call_end": {
							const { toolCallId, toolResult, isToolError } = evt
							if (toolCallId) {
								if (toolcalls[toolCallId]) {
									toolcalls[toolCallId].result = toolResult
									toolcalls[toolCallId].iserror = isToolError
									toolcalls[toolCallId].state = isToolError ? "error" : "result"
								} else {
									toolcalls[toolCallId] = {
										toolcallid: toolCallId,
										toolname: evt.toolName || "unknown",
										args: {},
										state: isToolError ? "error" : "result",
										result: toolResult,
										iserror: isToolError,
									}
								}
								updatetoolcalls()
							}
							break
						}

						// ── Reasoning ────────────────────────────────────
						case "thinking_update": {
							if (evt.text) {
								fullreasoning += evt.text
								setStreamingreasoning(fullreasoning)
							}
							break
						}

						// ── Error ────────────────────────────────────────
						case "error": {
							console.error("[chat] Stream error:", evt.error)
							toast.error(evt.error || "Agent encountered an error")
							break
						}

						// ── Turn lifecycle ───────────────────────────────
						case "turn_end": {
							ws.close()
							resolve()
							break
						}
					}
				}

				ws.onerror = () => {
					reject(new Error("WebSocket connection failed"))
				}

				ws.onclose = () => {
					resolve()
				}
			})

			await savemessage("agent", agentparticipant.participantid, fullcontent)
			fetchconversation()
		} catch (err) {
			console.error("Failed to stream from agent:", err)
			toast.error("Failed to get response from agent")
		}

		setStreaming(false)
		setStreamingcontent("")
		setStreamingtoolcalls([])
		setStreamingreasoning("")
	}

	const formattime = (datestr: string) => {
		return new Date(datestr).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const formatsizebytes = (bytes: number | null) => {
		if (!bytes) return ""
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-sm text-muted-foreground">Loading conversation...</p>
			</div>
		)
	}

	// ── Prompt input block (shared between centered and docked layouts) ──
	const promptinput = (
		<PromptInput onSubmit={handlesubmit} className="rounded-2xl border shadow-lg">
			<PromptInputAttachments>{(file) => <PromptInputAttachment data={file} />}</PromptInputAttachments>
			<PromptInputTextarea placeholder={hasmessages ? "Type a message..." : "Ask anything..."} ref={textarearef} />
			<PromptInputFooter>
				<PromptInputTools>
					<PromptInputActionMenu>
						<PromptInputActionMenuTrigger />
						<PromptInputActionMenuContent>
							<PromptInputActionAddAttachments />
						</PromptInputActionMenuContent>
					</PromptInputActionMenu>
				</PromptInputTools>
				<PromptInputSubmit disabled={streaming} status={streaming ? "streaming" : undefined} />
			</PromptInputFooter>
		</PromptInput>
	)

	// Whether the stream has any visible activity (tools, reasoning, or text)
	const hasstreamactivity = streamingcontent || streamingtoolcalls.length > 0 || streamingreasoning

	return (
		<div className="relative flex flex-col h-full w-full">
			{/* ─── Empty state: centered input ─── */}
			<AnimatePresence>
				{!hasmessages && (
					<motion.div
						key="empty-state"
						initial={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 40, transition: { duration: 0.3 } }}
						className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4"
					>
						<div className="flex flex-col items-center gap-4 mb-8">
							<div className="rounded-full bg-primary/10 p-4">
								<IconSparkles className="size-8 text-primary" />
							</div>
							<div className="text-center space-y-1">
								<h2 className="text-2xl font-semibold tracking-tight">{conversation?.title || "Start chatting"}</h2>
								<p className="text-sm text-muted-foreground max-w-md">Send a message to begin the conversation.</p>
							</div>
						</div>
						<div className="w-full max-w-2xl">{promptinput}</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ─── Conversation with messages: input docked at bottom ─── */}
			<AnimatePresence>
				{hasmessages && (
					<motion.div
						key="conversation-state"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, transition: { duration: 0.3 } }}
						className="flex flex-col h-full"
					>
						{/* Header */}
						<div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
							<div className="flex items-center gap-3">
								<IconMessageCircle className="size-5 text-muted-foreground" />
								<div>
									<h3 className="font-semibold text-sm">{conversation?.title || "Conversation"}</h3>
									<div className="flex items-center gap-1.5 mt-0.5">
										{participants.map((p) => (
											<Badge key={p.id} variant="outline" className="text-[10px] px-1.5 py-0">
												{p.participanttype === "agent" ? (
													<IconRobot className="size-2.5 mr-0.5" />
												) : (
													<IconUser className="size-2.5 mr-0.5" />
												)}
												{p.participantname || p.participantid}
											</Badge>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Messages */}
						<Conversation className="flex-1 min-h-0">
							<ConversationContent className="max-w-3xl mx-auto w-full py-6">
								{messages.map((msg) => (
									<div key={msg.id} className="flex gap-3 w-full">
										<Avatar className="size-7 shrink-0 mt-1">
											<AvatarFallback
												className={msg.sendertype === "agent" ? "bg-primary/10 text-primary" : "bg-secondary"}
											>
												{msg.sendertype === "agent" ? (
													<IconRobot className="size-3.5" />
												) : (
													<IconUser className="size-3.5" />
												)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="font-medium text-sm">{getparticipantname(msg.senderid, msg.sendertype)}</span>
												<span className="text-[10px] text-muted-foreground">{formattime(msg.createdat)}</span>
											</div>
											{msg.sendertype === "agent" ? (
												<MessageResponse>{msg.content}</MessageResponse>
											) : (
												<p className="text-sm whitespace-pre-wrap">{msg.content}</p>
											)}

											{/* Attachments */}
											{msg.attachments && msg.attachments.length > 0 && (
												<div className="flex flex-wrap gap-2 mt-2">
													{msg.attachments.map((att) => {
														if (att.mediatype?.startsWith("image/") && att.url) {
															return (
																<div key={att.id} className="relative rounded-lg overflow-hidden border max-w-xs">
																	<img
																		src={att.url}
																		alt={att.filename || "Image"}
																		className="max-h-48 object-contain"
																	/>
																</div>
															)
														}

														return (
															<a
																key={att.id}
																href={att.url || "#"}
																target="_blank"
																rel="noopener noreferrer"
																className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors"
															>
																<FileIcon className="size-4 text-muted-foreground" />
																<div className="min-w-0">
																	<p className="truncate font-medium text-xs">{att.filename || "Download"}</p>
																	{att.sizebytes && (
																		<p className="text-[10px] text-muted-foreground">
																			{formatsizebytes(att.sizebytes)}
																		</p>
																	)}
																</div>
																<DownloadIcon className="size-3.5 text-muted-foreground shrink-0" />
															</a>
														)
													})}
												</div>
											)}
										</div>
									</div>
								))}

								{/* ─── Streaming agent response ─── */}
								{streaming && (
									<div className="flex gap-3 w-full">
										<Avatar className="size-7 shrink-0 mt-1">
											<AvatarFallback className="bg-primary/10 text-primary">
												<IconRobot className="size-3.5" />
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0 space-y-2">
											<div className="flex items-center gap-2 mb-1">
												<span className="font-medium text-sm">Agent</span>
											</div>

											{/* Reasoning (for reasoning models like o3) */}
											{streamingreasoning && (
												<ReasoningSection text={streamingreasoning} isstreaming={streaming && !streamingcontent} />
											)}

											{/* Tool activity indicators */}
											{streamingtoolcalls.length > 0 && (
												<div className="space-y-1.5">
													{streamingtoolcalls.map((tool) => (
														<ToolActivityPill key={tool.toolcallid} tool={tool} />
													))}
												</div>
											)}

											{/* Streaming text content */}
											{streamingcontent && <MessageResponse>{streamingcontent}</MessageResponse>}

											{/* Typing indicator when no activity yet */}
											{!hasstreamactivity && (
												<div className="flex items-center gap-1 py-2">
													<div className="flex gap-1">
														<span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
														<span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
														<span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
													</div>
												</div>
											)}
										</div>
									</div>
								)}
							</ConversationContent>
							<ConversationScrollButton />
						</Conversation>

						{/* Docked input at bottom */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{
								opacity: 1,
								y: 0,
								transition: { duration: 0.3, delay: 0.1 },
							}}
							className="shrink-0 border-t"
						>
							<div className="max-w-3xl mx-auto w-full px-4 py-3">{promptinput}</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ChatView
