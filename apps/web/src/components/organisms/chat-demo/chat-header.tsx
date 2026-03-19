"use client"

// COMPONENTS
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"
import { Button } from "@/src/components/ui/button"
// ICONS
import { ArrowLeft, Trash2 } from "lucide-react"
// NEXT
import Link from "next/link"

export interface ChatHeaderProps {
	onClear: () => void
	hasMessages: boolean
}

const ChatHeader = ({ onClear, hasMessages }: ChatHeaderProps) => (
	<header className="shrink-0 flex items-center justify-between gap-2 px-2 py-2 border-b border-border/50 sm:px-4">
		<div className="flex items-center gap-2 min-w-0 flex-1">
			<Link
				href="/"
				className="flex items-center justify-center shrink-0 size-9 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				aria-label="Back to home"
			>
				<ArrowLeft size={20} aria-hidden="true" />
			</Link>

			<Avatar className="size-10 shrink-0 bg-emerald-600">
				<AvatarImage src="/illustrations/pepe.png" />
				<AvatarFallback className="bg-emerald-600 text-white font-semibold text-sm">P0</AvatarFallback>
			</Avatar>

			<div className="min-w-0 flex-1">
				<p className="font-semibold text-sm line-clamp-1">Press0 Agent</p>
				<div className="flex items-center gap-1.5">
					<span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
					<p className="text-xs text-muted-foreground line-clamp-1">Online</p>
				</div>
			</div>
		</div>

		{hasMessages ? (
			<Button
				variant="ghost"
				size="icon"
				onClick={onClear}
				className="shrink-0 size-9 text-muted-foreground hover:text-destructive transition-colors"
				aria-label="Clear chat history"
			>
				<Trash2 size={18} aria-hidden="true" />
			</Button>
		) : null}
	</header>
)

export default ChatHeader
