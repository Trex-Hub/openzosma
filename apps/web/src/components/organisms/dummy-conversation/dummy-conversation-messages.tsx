"use client"

import { Message, MessageContent, MessageResponse } from "@/src/components/ai-elements/message"
import { dummyChatMessages } from "@/src/components/content/chat"

const DummyConversationMessages = () => {
	return (
		<div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4 z-99 font-mono">
			{dummyChatMessages.map((message, index) => (
				<Message key={index} from={message.role}>
					<MessageContent>
						<MessageResponse>{message.content}</MessageResponse>
					</MessageContent>
				</Message>
			))}
		</div>
	)
}

export default DummyConversationMessages
