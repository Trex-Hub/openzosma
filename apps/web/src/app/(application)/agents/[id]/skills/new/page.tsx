"use client"

import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Textarea } from "@/src/components/ui/textarea"
import { IconArrowLeft, IconLoader2 } from "@tabler/icons-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function NewSkillPage() {
	const { id: agentId } = useParams<{ id: string }>()
	const router = useRouter()

	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [content, setContent] = useState("")
	const [saving, setSaving] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim() || !content.trim()) {
			toast.error("Name and content are required")
			return
		}

		setSaving(true)
		try {
			const res = await fetch("/api/skills", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					content: content.trim(),
				}),
			})

			if (!res.ok) {
				toast.error("Failed to create skill")
				return
			}

			const skill = await res.json()

			// Auto-attach the skill to this agent config
			const skillsRes = await fetch(`/api/agent-configs/${agentId}/skills`)
			if (skillsRes.ok) {
				const current = await skillsRes.json()
				const currentIds = current.map((s: { id: string }) => s.id)
				await fetch(`/api/agent-configs/${agentId}/skills`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ skillIds: [...currentIds, skill.id] }),
				})
			}

			toast.success("Skill created and attached")
			router.push(`/agents/${agentId}?tab=skills`)
		} catch {
			toast.error("Failed to create skill")
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="max-w-5xl mx-auto py-6 px-2">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon-sm" onClick={() => router.push(`/agents/${agentId}?tab=skills`)}>
						<IconArrowLeft className="size-4" />
					</Button>
					<div>
						<h1 className="text-xl font-semibold tracking-tight">New Skill</h1>
						<p className="text-sm text-muted-foreground">Write custom instructions injected into the agent's prompt</p>
					</div>
				</div>
				<Button size="sm" onClick={handleSubmit} disabled={saving || !name.trim() || !content.trim()}>
					{saving && <IconLoader2 className="size-4 animate-spin" />}
					Save Skill
				</Button>
			</div>

			<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-200px)]">
				{/* Left pane — editor */}
				<div className="flex flex-col gap-4 border rounded-lg p-5 overflow-auto">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="skill-name">
							Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="skill-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Code Review Checklist"
							autoFocus
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="skill-desc">Description</Label>
						<Input
							id="skill-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Short description shown in the skills list"
						/>
					</div>

					<div className="flex flex-col gap-1.5 flex-1">
						<Label htmlFor="skill-content">
							Content <span className="text-destructive">*</span>
						</Label>
						<Textarea
							id="skill-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Write the instructions for this skill in markdown..."
							className="font-mono text-xs flex-1 resize-none"
							style={{ minHeight: "300px" }}
						/>
					</div>
				</div>

				{/* Right pane — preview */}
				<div className="border rounded-lg p-5 overflow-auto">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
					{content ? (
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed">{content}</pre>
						</div>
					) : (
						<p className="text-sm text-muted-foreground italic">Start typing to see a preview...</p>
					)}
				</div>
			</form>
		</div>
	)
}
