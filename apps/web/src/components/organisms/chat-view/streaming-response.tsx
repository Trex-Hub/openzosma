"use client"

import { MessageResponse } from "@/src/components/ai-elements/message"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/src/components/ai-elements/reasoning"
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar"
import { IconRobot } from "@tabler/icons-react"
import { ToolActivityPill } from "./tool-calls"
import type { StreamToolCall } from "./types"

type StreamingResponseProps = {
	content: string
	toolcalls: StreamToolCall[]
	reasoning: string
	isstreaming: boolean
}

function TypingIndicator() {
	return (
		<div className="flex items-center gap-1 py-2">
			<div className="flex gap-1">
				<span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
				<span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
				<span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
			</div>
		</div>
	)
}

export function StreamingResponse({ content, toolcalls, reasoning, isstreaming }: StreamingResponseProps) {
	const hasactivity = content || toolcalls.length > 0 || reasoning

	return (
		<div className="flex gap-3 w-full">
			<Avatar className="size-7 shrink-0 mt-1">
				<AvatarFallback className="bg-primary/10 text-primary">
					<IconRobot className="size-3.5" />
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0 space-y-2">
				<div className="flex items-center gap-2 mb-1">
					<span className="font-medium text-sm">Open Zosma Agent</span>
				</div>

				{reasoning && (
					<Reasoning isStreaming={isstreaming && !content}>
						<ReasoningTrigger />
						<ReasoningContent>{reasoning}</ReasoningContent>
					</Reasoning>
				)}

				{toolcalls.length > 0 && (
					<div className="space-y-1.5">
						{toolcalls.map((tool) => (
							<ToolActivityPill key={tool.toolcallid} tool={tool} />
						))}
					</div>
				)}

				{content && <MessageResponse>{content}</MessageResponse>}

				{!hasactivity && <TypingIndicator />}
			</div>
		</div>
	)
}
