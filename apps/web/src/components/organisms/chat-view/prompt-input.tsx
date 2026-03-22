import {
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInput as PromptInputComponent,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/src/components/ai-elements/prompt-input"
import type { FileUIPart } from "ai"

const PromptInput = ({
	handlesubmit,
	hasmessages,
	textarearef,
	streaming,
}: {
	handlesubmit: (msg: { text: string; files: FileUIPart[] }) => void
	hasmessages: boolean
	textarearef: React.RefObject<HTMLTextAreaElement>
	streaming: boolean
}) => {
	return (
		<PromptInputComponent onSubmit={handlesubmit} className="rounded-2xl border shadow-lg">
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
		</PromptInputComponent>
	)
}

export default PromptInput
