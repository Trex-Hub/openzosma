"use client"

import { Badge } from "@/src/components/ui/badge"
import { IconMessageCircle, IconRobot, IconUser } from "@tabler/icons-react"
import type { ChatParticipant, ConversationData } from "./types"

type ChatHeaderProps = {
	conversation: ConversationData | null
	participants: ChatParticipant[]
}

const ChatHeader = ({ conversation, participants }: ChatHeaderProps) => {
	return (
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
	)
}

export default ChatHeader
