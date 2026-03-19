"use client"

// ICONS
import { Film, ShieldQuestion, Youtube } from "lucide-react"
// ANIMATION
import { motion } from "motion/react"

const SUGGESTED_PROMPTS = [
	{
		icon: Youtube,
		label: "Verify a YouTube Video",
		prompt: "I want to verify a YouTube video. How can I share it with you?",
		color: "text-red-400",
		bg: "bg-red-500/10",
		bgHover: "hover:bg-red-500/[0.15]",
		border: "border-red-500/20",
	},
	{
		icon: Film,
		label: "Check an Instagram Reel",
		prompt: "I want to fact-check an Instagram Reel. How should I share it?",
		color: "text-fuchsia-400",
		bg: "bg-fuchsia-500/10",
		bgHover: "hover:bg-fuchsia-500/[0.15]",
		border: "border-fuchsia-500/20",
	},
	{
		icon: ShieldQuestion,
		label: "Verify a Claim",
		prompt: "Is it true that tomatoes will disappear from India next year?",
		color: "text-emerald-400",
		bg: "bg-emerald-500/10",
		bgHover: "hover:bg-emerald-500/[0.15]",
		border: "border-emerald-500/20",
	},
] as const

export interface ChatEmptyStateProps {
	onPromptSelect: (prompt: string) => void
}

const ChatEmptyState = ({ onPromptSelect }: ChatEmptyStateProps) => (
	<div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
		<motion.div
			className="flex flex-col items-center gap-8 w-full max-w-lg"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: "easeOut" }}
		>
			<div className="text-center space-y-2">
				<h2 className="font-antonio text-2xl sm:text-3xl font-bold uppercase tracking-tight text-balance">
					What Would You Like to Verify?
				</h2>
				<p className="text-sm text-muted-foreground text-pretty max-w-sm mx-auto">
					Share a link or type a claim to get started
				</p>
			</div>

			<div className="grid gap-3 w-full">
				{SUGGESTED_PROMPTS.map((item, index) => (
					<motion.button
						key={item.label}
						type="button"
						onClick={() => onPromptSelect(item.prompt)}
						className={`flex items-center gap-2 lg:gap-4 w-full px-2 lg:px-4 py-3.5 rounded-xl border ${item.border} ${item.bg} ${item.bgHover} text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer`}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							duration: 0.3,
							delay: 0.15 + index * 0.08,
							ease: "easeOut",
						}}
					>
						<div
							className={`shrink-0 flex items-center justify-center size-10 rounded-lg ${item.bg} ${item.color}`}
							aria-hidden="true"
						>
							<item.icon className="size-5" />
						</div>
						<div className="flex flex-col gap-0.5 min-w-0">
							<span className="text-sm font-medium text-foreground">{item.label}</span>
							<span className="text-xs text-muted-foreground truncate">{item.prompt}</span>
						</div>
					</motion.button>
				))}
			</div>
		</motion.div>
	</div>
)

export default ChatEmptyState
