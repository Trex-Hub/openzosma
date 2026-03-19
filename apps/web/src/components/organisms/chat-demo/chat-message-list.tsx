"use client"

// COMPONENTS
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
} from "@/src/components/ai-elements/message"
import ChatErrorBanner from "@/src/components/molecules/chat-error-banner"
import TypingIndicator from "@/src/components/molecules/typing-indicator"
// TYPES
import type { UIMessage } from "ai"
// ICONS
import { Check, Copy } from "lucide-react"
// ANIMATION
import { motion } from "motion/react"
// HOOKS
import { useCallback, useEffect, useRef, useState } from "react"

/* ------------------------------------------------------------------ */
/*  Copy button — self-contained state per message                     */
/* ------------------------------------------------------------------ */

const CopyMessageAction = ({ text }: { text: string }) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			/* clipboard API unavailable */
		}
	}, [text])

	return (
		<MessageAction tooltip={copied ? "Copied!" : "Copy"} label="Copy message" onClick={handleCopy}>
			{copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
		</MessageAction>
	)
}

/* ------------------------------------------------------------------ */
/*  Message list                                                       */
/* ------------------------------------------------------------------ */

export interface ChatMessageListProps {
	messages: UIMessage[]
	showTyping: boolean
	error: Error | undefined
}

const ChatMessageList = ({ messages, showTyping, error }: ChatMessageListProps) => {
	const messagesEndRef = useRef<HTMLDivElement>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages/typing change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages, showTyping])

	return (
		<div
			className="flex-1 overflow-y-auto overscroll-contain px-4 py-6"
			role="log"
			aria-label="Chat messages"
			aria-live="polite"
		>
			<div className="space-y-5 max-w-3xl mx-auto">
				{messages.map((message) => {
					const textPart = message.parts.find((part) => part.type === "text")
					const text = textPart?.type === "text" ? textPart.text : ""

					return (
						<motion.div
							key={message.id}
							style={{
								contentVisibility: "auto",
								containIntrinsicSize: "auto 80px",
							}}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25, ease: "easeOut" }}
						>
							<Message from={message.role}>
								<MessageContent>
									<MessageResponse>{text}</MessageResponse>
								</MessageContent>
								{text ? (
									<MessageActions className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
										<CopyMessageAction text={text} />
									</MessageActions>
								) : null}
							</Message>
						</motion.div>
					)
				})}

				{showTyping ? (
					<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
						<TypingIndicator />
					</motion.div>
				) : null}

				{error ? (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
						<ChatErrorBanner message={error.message} />
					</motion.div>
				) : null}

				<div ref={messagesEndRef} aria-hidden="true" />
			</div>
		</div>
	)
}

export default ChatMessageList
