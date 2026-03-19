"use client"

// COMPONENTS
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/src/components/ui/command"
// STORES
import type { CommandMenuStoreProps } from "@/src/stores/command-menu-store"
import { IconMessageCircle, IconPlug, IconSettings, IconUser } from "@tabler/icons-react"
// ICONS
import { Bot } from "lucide-react"
import { useRouter } from "next/navigation"
// HOOKS
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type ConversationSummary = {
	id: string
	title: string
	updatedat: string
}

const CommandMenu = ({ open, setOpen }: CommandMenuStoreProps) => {
	const router = useRouter()
	const [conversations, setConversations] = useState<ConversationSummary[]>([])
	const [loadingconversations, setLoadingconversations] = useState(false)

	// Fetch conversations when menu opens
	useEffect(() => {
		if (open) {
			setLoadingconversations(true)
			fetch("/api/conversations")
				.then((res) => res.json())
				.then((data) => {
					if (data.conversations) {
						const sorted = (data.conversations as ConversationSummary[])
							.sort((a, b) => new Date(b.updatedat).getTime() - new Date(a.updatedat).getTime())
							.slice(0, 10)
						setConversations(sorted)
					}
				})
				.catch(() => {
					// Silently fail
				})
				.finally(() => {
					setLoadingconversations(false)
				})
		}
	}, [open])

	const handleSelect = useCallback(
		(value: string) => {
			if (value.startsWith("/")) {
				router.push(value)
				setOpen(false)
			}
		},
		[router, setOpen],
	)

	const handleAI = useCallback(() => {
		toast.info("This feature is coming soon...")
	}, [])

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Search"
			description="Search for pages and navigate quickly"
		>
			<CommandInput placeholder="Search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>

				{/* Navigation */}
				<CommandGroup heading="Navigation">
					<CommandItem value="/chat" onSelect={handleSelect}>
						<IconMessageCircle />
						<span>Chat</span>
					</CommandItem>
					<CommandItem value="/integrations" onSelect={handleSelect}>
						<IconPlug />
						<span>Integrations</span>
					</CommandItem>
					<CommandItem value="/settings" onSelect={handleSelect}>
						<IconSettings />
						<span>Settings</span>
					</CommandItem>
					<CommandItem value="/settings/profile" onSelect={handleSelect}>
						<IconUser />
						<span>Profile</span>
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="AI Features Coming Soon...">
					<CommandItem onSelect={handleAI}>
						<Bot />
						<span>Ask AI</span>
					</CommandItem>
					<CommandItem onSelect={handleAI}>
						<Bot />
						<span>Analyze with AI</span>
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Quick Actions">
					<CommandItem onSelect={handleAI}>
						<Bot />
						<span>Create a Support Ticket</span>
					</CommandItem>
				</CommandGroup>

				{/* Conversations */}
				<CommandSeparator />
				<CommandGroup heading="Recent Conversations">
					{loadingconversations ? (
						<CommandItem disabled>
							<span className="text-muted-foreground text-sm">Loading...</span>
						</CommandItem>
					) : conversations.length > 0 ? (
						conversations.map((conv) => (
							<CommandItem
								key={conv.id}
								value={`${conv.title} ${conv.id}`}
								onSelect={() => {
									router.push(`/chat/${conv.id}`)
									setOpen(false)
								}}
							>
								<IconMessageCircle className="size-4" />
								<span className="truncate">{conv.title}</span>
							</CommandItem>
						))
					) : (
						<CommandItem value="/chat" onSelect={handleSelect}>
							<IconMessageCircle className="size-4" />
							<span>Start new conversation</span>
						</CommandItem>
					)}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	)
}

export default CommandMenu
