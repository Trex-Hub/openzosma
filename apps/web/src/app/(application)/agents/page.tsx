"use client"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/src/components/ui/alert-dialog"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Skeleton } from "@/src/components/ui/skeleton"
import { IconPencil, IconPlus, IconRobot, IconTrash } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type AgentConfig = {
	id: string
	name: string
	description: string | null
	agentTypeId: string
	isDefault: boolean
	config: {
		provider?: string
		model?: string
		tools_enabled?: string[]
	}
	createdAt: string
}

const ALL_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"]

export default function AgentsPage() {
	const router = useRouter()
	const [agents, setAgents] = useState<AgentConfig[]>([])
	const [loading, setLoading] = useState(true)
	const [deletingId, setDeletingId] = useState<string | null>(null)

	const fetchAgents = useCallback(async () => {
		try {
			const res = await fetch("/api/agent-configs")
			if (res.ok) {
				const data = await res.json()
				setAgents(data)
			}
		} catch {
			toast.error("Failed to load agents")
		}
		setLoading(false)
	}, [])

	useEffect(() => {
		fetchAgents()
	}, [fetchAgents])

	const handleDelete = async (id: string) => {
		try {
			const res = await fetch(`/api/agent-configs/${id}`, { method: "DELETE" })
			if (res.ok) {
				toast.success("Agent deleted")
				setAgents((prev) => prev.filter((a) => a.id !== id))
			} else {
				toast.error("Failed to delete agent")
			}
		} catch {
			toast.error("Failed to delete agent")
		} finally {
			setDeletingId(null)
		}
	}

	const getModelLabel = (config: AgentConfig["config"]) => {
		if (config.provider && config.model) return `${config.provider} / ${config.model}`
		if (config.model) return config.model
		return null
	}

	const getToolCount = (config: AgentConfig["config"]) => {
		if (Array.isArray(config.tools_enabled)) return config.tools_enabled.length
		return ALL_TOOLS.length
	}

	return (
		<div className="flex flex-col gap-6 max-w-5xl mx-auto py-6 px-2">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">Agents</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						Create and configure custom AI agents with specific models, tools, and skills.
					</p>
				</div>
				<Button size="sm" onClick={() => router.push("/agents/new")}>
					<IconPlus className="size-4" />
					New Agent
				</Button>
			</div>

			{/* Content */}
			{loading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16 w-full rounded-lg" />
					))}
				</div>
			) : agents.length === 0 ? (
				<div className="flex flex-col items-center gap-4 py-20 text-center">
					<div className="size-12 rounded-full bg-muted flex items-center justify-center">
						<IconRobot className="size-6 text-muted-foreground" />
					</div>
					<div>
						<p className="font-medium text-sm">No agents yet</p>
						<p className="text-sm text-muted-foreground mt-1">
							Create your first agent to customize the AI model, tools, and behavior.
						</p>
					</div>
					<Button size="sm" onClick={() => router.push("/agents/new")}>
						<IconPlus className="size-4" />
						Create your first agent
					</Button>
				</div>
			) : (
				<div className="border rounded-lg overflow-hidden">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/30">
								<th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
								<th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Model</th>
								<th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Tools</th>
								<th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Created</th>
								<th className="px-4 py-3 w-20" />
							</tr>
						</thead>
						<tbody>
							{agents.map((agent, idx) => {
								const modelLabel = getModelLabel(agent.config)
								const toolCount = getToolCount(agent.config)
								return (
									<tr
										key={agent.id}
										className={`border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer ${idx % 2 === 0 ? "" : "bg-muted/5"}`}
										onClick={() => router.push(`/agents/${agent.id}`)}
									>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<span className="font-medium">{agent.name}</span>
												{agent.isDefault && (
													<Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
														Default
													</Badge>
												)}
											</div>
											{agent.description && (
												<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{agent.description}</p>
											)}
										</td>
										<td className="px-4 py-3 hidden sm:table-cell">
											{modelLabel ? (
												<Badge variant="outline" className="font-mono text-[10px]">
													{modelLabel}
												</Badge>
											) : (
												<span className="text-muted-foreground text-xs">Auto</span>
											)}
										</td>
										<td className="px-4 py-3 hidden md:table-cell">
											<span className="text-muted-foreground text-xs">{toolCount} tools</span>
										</td>
										<td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
											{new Date(agent.createdAt).toLocaleDateString()}
										</td>
										<td className="px-4 py-3">
											<div
												className="flex items-center gap-1 justify-end"
												onClick={(e) => e.stopPropagation()}
											>
												<Button
													size="icon-sm"
													variant="ghost"
													onClick={() => router.push(`/agents/${agent.id}`)}
												>
													<IconPencil className="size-3.5" />
												</Button>
												<Button
													size="icon-sm"
													variant="ghost"
													className="text-muted-foreground hover:text-destructive"
													onClick={() => setDeletingId(agent.id)}
												>
													<IconTrash className="size-3.5" />
												</Button>
											</div>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Delete confirmation */}
			<AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete agent?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the agent configuration. Existing conversations that used this agent will not be
							affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => deletingId && handleDelete(deletingId)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
