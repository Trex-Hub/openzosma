import DummyConversationHeader from "./dummy-conversation-header"
import DummyConversationMessages from "./dummy-conversation-messages"

const DummyConversation = () => {
	return (
		<div className="flex flex-col h-full w-full">
			<DummyConversationHeader name="Press0 Agent" status="Online" avatarUrl="/illustrations/pepe.png" />
			<DummyConversationMessages />
		</div>
	)
}

export default DummyConversation
