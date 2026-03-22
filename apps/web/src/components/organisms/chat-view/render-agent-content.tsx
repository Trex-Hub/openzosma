import { MessageResponse } from "@/src/components/ai-elements/message"
import ToolActivityPill from "./tool-calls"
import type { ChatMessage as ChatMessageType, MessageSegment, StreamToolCall } from "./types"

const RenderAgentContent = ({ message }: { message: ChatMessageType }) => {
	const segments = message.metadata?.segments as MessageSegment[] | undefined
	const toolcalls = message.metadata?.toolcalls as StreamToolCall[] | undefined
	const toolmap = new Map((toolcalls ?? []).map((t) => [t.toolcallid, t]))

	if (segments && segments.length > 0) {
		return (
			<div className="space-y-2">
				{segments.map((seg, i) => {
					if (seg.type === "text") {
						return <MessageResponse key={i}>{seg.content}</MessageResponse>
					}
					const tool = toolmap.get(seg.toolcallid)
					if (!tool) return null
					return <ToolActivityPill key={seg.toolcallid} tool={tool} />
				})}
			</div>
		)
	}

	return (
		<div className="space-y-2">
			{toolcalls && toolcalls.length > 0 && (
				<div className="space-y-1.5">
					{toolcalls.map((tool) => (
						<ToolActivityPill key={tool.toolcallid} tool={tool} />
					))}
				</div>
			)}
			<MessageResponse>{message.content}</MessageResponse>
		</div>
	)
}

export default RenderAgentContent
