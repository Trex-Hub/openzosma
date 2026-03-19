// ICONS
import { AlertTriangle } from "lucide-react"

export interface ChatErrorBannerProps {
	message: string
}

const ChatErrorBanner = ({ message }: ChatErrorBannerProps) => (
	<div
		className="flex items-start gap-3 text-sm p-4 bg-destructive/10 border border-destructive/20 rounded-xl"
		role="alert"
	>
		<AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
		<div className="flex flex-col gap-1 min-w-0">
			<p className="font-medium text-destructive">Something went wrong</p>
			<p className="text-xs text-destructive/70">{message}</p>
			<p className="text-xs text-destructive/50 mt-0.5">Please try sending your message again.</p>
		</div>
	</div>
)

export default ChatErrorBanner
