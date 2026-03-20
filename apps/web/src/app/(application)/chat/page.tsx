"use client"

import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/src/components/ai-elements/prompt-input"
import {
	IconBolt,
	IconBrain,
	IconChartBar,
	IconDatabase,
	IconFileAnalytics,
	IconShieldCheck,
	IconSparkles,
	IconTableSpark,
	IconTrendingUp,
	IconWand,
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const SUGGESTIONS = [
	{
		icon: IconDatabase,
		label: "Explore my databases",
		prompt: "What databases and tables do I have connected?",
	},
	{
		icon: IconChartBar,
		label: "Visualize trends",
		prompt: "Show me a chart of the most important trends in my data",
	},
	{
		icon: IconFileAnalytics,
		label: "Generate a report",
		prompt: "Generate a summary report of my data from last month",
	},
	{
		icon: IconBrain,
		label: "Ask anything",
		prompt: "What insights can you find in my data?",
	},
]

const ROTATING_TIPS = [
	{
		icon: IconBolt,
		text: "Ask in plain English — AI writes the SQL for you",
		color: "text-amber-400",
	},
	{
		icon: IconShieldCheck,
		text: "Read-only queries — your data is always safe",
		color: "text-emerald-400",
	},
	{
		icon: IconWand,
		text: "Generate charts, tables, and Mermaid diagrams instantly",
		color: "text-violet-400",
	},
	{
		icon: IconTrendingUp,
		text: "Spot trends and anomalies across all your databases",
		color: "text-cyan-400",
	},
	{
		icon: IconTableSpark,
		text: "Knowledge-powered — AI understands your schema and relationships",
		color: "text-pink-400",
	},
	{
		icon: IconDatabase,
		text: "Connect PostgreSQL, MySQL, and more — query them all in one place",
		color: "text-blue-400",
	},
]

const ChatPage = () => {
	const router = useRouter()
	const textarearef = useRef<HTMLTextAreaElement>(null)
	const [tipindex, setTipindex] = useState(0)
	const [defaultConfigId, setDefaultConfigId] = useState<string | null>(null)

	// Rotate tips every 4 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			setTipindex((prev) => (prev + 1) % ROTATING_TIPS.length)
		}, 4000)
		return () => clearInterval(interval)
	}, [])

	useEffect(() => {
		fetch("/api/agent-configs/default")
			.then((r) => (r.ok ? r.json() : null))
			.then((d: { id: string } | null) => setDefaultConfigId(d?.id ?? null))
			.catch(() => {})
	}, [])

	const handlesubmit = async (message: PromptInputMessage) => {
		if (!message.text.trim()) return

		try {
			const res = await fetch("/api/conversations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: message.text.slice(0, 80) || "New Conversation",
					agentConfigId: defaultConfigId,
				}),
			})

			if (res.ok) {
				const data = await res.json()
				router.push(`/chat/${data.conversation.id}?initial=${encodeURIComponent(message.text)}`)
			} else {
				toast.error("Failed to start conversation")
			}
		} catch {
			toast.error("Failed to start conversation")
		}
	}

	const handlesuggestionclick = (prompt: string) => {
		if (textarearef.current) {
			textarearef.current.value = prompt
			textarearef.current.dispatchEvent(new Event("input", { bubbles: true }))
			textarearef.current.focus()
		}
	}

	const currenttip = ROTATING_TIPS[tipindex]

	return (
		<div className="relative flex flex-col items-center justify-center h-full w-full px-4 overflow-hidden">
			{/* ── Subtle background glow ── */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/[0.04] blur-[100px]" />
				<div className="absolute left-1/3 top-2/3 -translate-x-1/2 -translate-y-1/2 size-[400px] rounded-full bg-violet-500/[0.03] blur-[80px]" />
			</div>

			{/* ── Main content ── */}
			<div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
				{/* Animated icon */}
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5, ease: "easeOut" }}
					className="mb-6"
				>
					<div className="relative">
						<div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
						<div className="relative rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/10 p-5 border border-primary/10">
							<IconSparkles className="size-8 text-primary" />
						</div>
					</div>
				</motion.div>

				{/* Heading */}
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="text-center mb-3"
				>
					<h1 className="text-3xl font-bold tracking-tight mb-2">What can I help you with?</h1>
					<p className="text-muted-foreground max-w-md mx-auto text-sm">
						Chat with AI to explore your databases, visualize data, and discover insights — all in natural language.
					</p>
				</motion.div>

				{/* ── Rotating tips ── */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3 }}
					className="h-8 mb-6 flex items-center justify-center"
				>
					<AnimatePresence mode="wait">
						<motion.div
							key={tipindex}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: 0.35 }}
							className="flex items-center gap-2"
						>
							<currenttip.icon className={`size-4 ${currenttip.color}`} />
							<span className="text-xs text-muted-foreground">{currenttip.text}</span>
						</motion.div>
					</AnimatePresence>
				</motion.div>

				{/* Prompt input */}
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="w-full mb-8"
				>
					<PromptInput
						onSubmit={handlesubmit}
						className="rounded-2xl border border-border/60 shadow-xl shadow-primary/[0.03] bg-background/80 backdrop-blur-sm"
					>
						<PromptInputAttachments>{(file) => <PromptInputAttachment data={file} />}</PromptInputAttachments>
						<PromptInputTextarea placeholder="Ask anything about your data..." ref={textarearef} />
						<PromptInputFooter>
							<PromptInputTools>
								<PromptInputActionMenu>
									<PromptInputActionMenuTrigger />
									<PromptInputActionMenuContent>
										<PromptInputActionAddAttachments />
									</PromptInputActionMenuContent>
								</PromptInputActionMenu>
							</PromptInputTools>
							<PromptInputSubmit />
						</PromptInputFooter>
					</PromptInput>
				</motion.div>

				{/* Suggestion cards */}
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.35 }}
					className="grid grid-cols-2 gap-3 w-full"
				>
					{SUGGESTIONS.map((s, i) => (
						<motion.button
							key={s.label}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3, delay: 0.4 + i * 0.07 }}
							onClick={() => handlesuggestionclick(s.prompt)}
							className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 text-left transition-all duration-200 hover:bg-accent/60 hover:border-primary/20 hover:shadow-md hover:shadow-primary/[0.03]"
						>
							<div className="rounded-lg bg-primary/10 p-2 shrink-0 transition-colors group-hover:bg-primary/15">
								<s.icon className="size-4 text-primary" />
							</div>
							<div className="min-w-0">
								<p className="text-sm font-medium mb-0.5 group-hover:text-foreground transition-colors">{s.label}</p>
								<p className="text-xs text-muted-foreground line-clamp-1">{s.prompt}</p>
							</div>
						</motion.button>
					))}
				</motion.div>
			</div>
		</div>
	)
}

export default ChatPage
