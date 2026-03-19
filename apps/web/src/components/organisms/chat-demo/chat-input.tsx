// COMPONENTS
import type { PromptInputProps } from "@/src/components/ai-elements/prompt-input"
import {
	PromptInput,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@/src/components/ai-elements/prompt-input"
// TYPES
import type { ChatStatus } from "ai"

export interface ChatInputProps {
	status: ChatStatus
	onSubmit: PromptInputProps["onSubmit"]
}

const ChatInput = ({ status, onSubmit }: ChatInputProps) => (
	<div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 border-t border-border/50">
		<div className="max-w-3xl mx-auto">
			<PromptInput onSubmit={onSubmit}>
				<PromptInputTextarea aria-label="Message input" placeholder="Type your message or paste a URL…" />
				<PromptInputFooter>
					<PromptInputSubmit status={status} />
				</PromptInputFooter>
			</PromptInput>
		</div>
	</div>
)

export default ChatInput
