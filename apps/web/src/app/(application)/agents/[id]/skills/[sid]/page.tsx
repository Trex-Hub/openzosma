"use client"

import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Textarea } from "@/src/components/ui/textarea"
import { IconArrowLeft, IconCopy, IconLoader2 } from "@tabler/icons-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type Skill = {
	id: string
	name: string
	description: string | null
	content: string
	isBuiltin: boolean
}

export default function EditSkillPage() {
	const { id: agentId, sid } = useParams<{ id: string; sid: string }>()
	const router = useRouter()

	const [skill, setSkill] = useState<Skill | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [cloning, setCloning] = useState(false)

	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [content, setContent] = useState("")

	const fetchSkill = useCallback(async () => {
		try {
			const res = await fetch(`/api/skills/${sid}`)
			if (res.ok) {
				const data: Skill = await res.json()
				setSkill(data)
				setName(data.name)
				setDescription(data.description ?? "")
				setContent(data.content)
			} else {
				toast.error("Skill not found")
				router.push(`/agents/${agentId}?tab=skills`)
			}
		} catch {
			toast.error("Failed to load skill")
		}
		setLoading(false)
	}, [sid, agentId, router])

	useEffect(() => {
		fetchSkill()
	}, [fetchSkill])

	const handleSave = async () => {
		if (!name.trim() || !content.trim()) {
			toast.error("Name and content are required")
			return
		}
		setSaving(true)
		try {
			const res = await fetch(`/api/skills/${sid}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					content: content.trim(),
				}),
			})
			if (res.ok) {
				toast.success("Skill saved")
				setSkill(await res.json())
			} else {
				toast.error("Failed to save skill")
			}
		} catch {
			toast.error("Failed to save skill")
		} finally {
			setSaving(false)
		}
	}

	const handleClone = async () => {
		if (!skill) return
		setCloning(true)
		try {
			const res = await fetch("/api/skills", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: `${skill.name} (copy)`,
					description: skill.description,
					content: skill.content,
				}),
			})
			if (res.ok) {
				const clone = await res.json()
				toast.success("Skill cloned — editing your copy")
				router.push(`/agents/${agentId}/skills/${clone.id}`)
			} else {
				toast.error("Failed to clone skill")
			}
		} catch {
			toast.error("Failed to clone skill")
		} finally {
			setCloning(false)
		}
	}

	if (loading) {
		return (
			<div className="max-w-5xl mx-auto py-6 px-2 flex items-center gap-2 text-muted-foreground text-sm">
				<IconLoader2 className="size-4 animate-spin" />
				Loading skill...
			</div>
		)
	}

	if (!skill) return null

	const isBuiltin = skill.isBuiltin

	return (
		<div className="max-w-5xl mx-auto py-6 px-2">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon-sm" onClick={() => router.push(`/agents/${agentId}?tab=skills`)}>
						<IconArrowLeft className="size-4" />
					</Button>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-xl font-semibold tracking-tight">{skill.name}</h1>
							{isBuiltin && (
								<Badge variant="secondary" className="text-[10px]">
									Built-in
								</Badge>
							)}
						</div>
						{isBuiltin && (
							<p className="text-sm text-muted-foreground mt-0.5">
								Built-in skills are read-only. Clone to create an editable copy.
							</p>
						)}
					</div>
				</div>
				<div className="flex gap-2">
					{isBuiltin ? (
						<Button size="sm" onClick={handleClone} disabled={cloning}>
							{cloning ? <IconLoader2 className="size-4 animate-spin" /> : <IconCopy className="size-4" />}
							Clone
						</Button>
					) : (
						<Button size="sm" onClick={handleSave} disabled={saving}>
							{saving && <IconLoader2 className="size-4 animate-spin" />}
							Save Skill
						</Button>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-200px)]">
				{/* Left pane — editor / viewer */}
				<div className="flex flex-col gap-4 border rounded-lg p-5 overflow-auto">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="edit-name">Name</Label>
						<Input
							id="edit-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={isBuiltin}
							className={isBuiltin ? "opacity-60 cursor-not-allowed" : ""}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="edit-desc">Description</Label>
						<Input
							id="edit-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Short description"
							disabled={isBuiltin}
							className={isBuiltin ? "opacity-60 cursor-not-allowed" : ""}
						/>
					</div>

					<div className="flex flex-col gap-1.5 flex-1">
						<Label htmlFor="edit-content">Content</Label>
						<Textarea
							id="edit-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							className={`font-mono text-xs flex-1 resize-none ${isBuiltin ? "opacity-60 cursor-not-allowed" : ""}`}
							style={{ minHeight: "300px" }}
							disabled={isBuiltin}
							readOnly={isBuiltin}
						/>
					</div>
				</div>

				{/* Right pane — preview */}
				<div className="border rounded-lg p-5 overflow-auto">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
					{content ? (
						<pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed">{content}</pre>
					) : (
						<p className="text-sm text-muted-foreground italic">Content is empty...</p>
					)}
				</div>
			</div>
		</div>
	)
}
