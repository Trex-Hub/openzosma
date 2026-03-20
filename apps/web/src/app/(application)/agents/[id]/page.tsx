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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { Separator } from "@/src/components/ui/separator"
import { Switch } from "@/src/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs"
import { Textarea } from "@/src/components/ui/textarea"
import {
	IconAlertTriangle,
	IconArrowLeft,
	IconGripVertical,
	IconLoader2,
	IconPlus,
	IconSearch,
	IconTrash,
} from "@tabler/icons-react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDERS = [
	{ id: "anthropic", label: "Anthropic" },
	{ id: "openai", label: "OpenAI" },
	{ id: "google", label: "Google" },
	{ id: "groq", label: "Groq" },
	{ id: "xai", label: "xAI" },
	{ id: "mistral", label: "Mistral" },
]

const MODELS_BY_PROVIDER: Record<string, { id: string; label: string }[]> = {
	anthropic: [
		{ id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
		{ id: "claude-opus-4-20250514", label: "Claude Opus 4" },
		{ id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
	],
	openai: [
		{ id: "gpt-4o", label: "GPT-4o" },
		{ id: "gpt-4o-mini", label: "GPT-4o Mini" },
		{ id: "o3", label: "o3" },
	],
	google: [
		{ id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
		{ id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
	],
	groq: [{ id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" }],
	xai: [{ id: "grok-3", label: "Grok 3" }],
	mistral: [{ id: "mistral-large-latest", label: "Mistral Large" }],
}

const TOOLS = [
	{ name: "read", label: "read", description: "Read file contents" },
	{ name: "bash", label: "bash", description: "Execute shell commands", dangerous: true },
	{ name: "edit", label: "edit", description: "Edit files in-place" },
	{ name: "write", label: "write", description: "Create or overwrite files", dangerous: true },
	{ name: "grep", label: "grep", description: "Search file contents with regex" },
	{ name: "find", label: "find", description: "Find files by name pattern" },
	{ name: "ls", label: "ls", description: "List directory contents" },
]

const THINKING_LEVELS = [
	{ value: "off", label: "Off" },
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentConfig = {
	id: string
	name: string
	description: string | null
	agentTypeId: string
	systemPrompt: string | null
	isDefault: boolean
	config: {
		provider?: string
		model?: string
		tools_enabled?: string[]
		thinking_level?: string
	}
}

type Skill = {
	id: string
	name: string
	description: string | null
	content: string
	isBuiltin: boolean
	enabled: boolean
	sortOrder: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
	const { id } = useParams<{ id: string }>()
	const router = useRouter()
	const searchParams = useSearchParams()
	const defaultTab = searchParams.get("tab") ?? "settings"

	const [loading, setLoading] = useState(true)
	const [config, setConfig] = useState<AgentConfig | null>(null)
	const [deleting, setDeleting] = useState(false)

	// Settings tab state
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [provider, setProvider] = useState("")
	const [model, setModel] = useState("")
	const [systemPrompt, setSystemPrompt] = useState("")
	const [thinkingLevel, setThinkingLevel] = useState("off")
	const [isDefault, setIsDefault] = useState(false)
	const [savingSettings, setSavingSettings] = useState(false)

	// Tools tab state
	const [toolsEnabled, setToolsEnabled] = useState<string[]>(TOOLS.map((t) => t.name))
	const [savingTools, setSavingTools] = useState(false)
	const [dangerDismissed, setDangerDismissed] = useState(false)

	// Skills tab state
	const [attachedSkills, setAttachedSkills] = useState<Skill[]>([])
	const [allSkills, setAllSkills] = useState<Skill[]>([])
	const [skillDialogOpen, setSkillDialogOpen] = useState(false)
	const [skillSearch, setSkillSearch] = useState("")
	const [savingSkills, setSavingSkills] = useState(false)
	const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

	const fetchConfig = useCallback(async () => {
		try {
			const [cfgRes, skillsRes] = await Promise.all([
				fetch(`/api/agent-configs/${id}`),
				fetch(`/api/agent-configs/${id}/skills`),
			])
			if (cfgRes.ok) {
				const cfg: AgentConfig = await cfgRes.json()
				setConfig(cfg)
				setName(cfg.name)
				setDescription(cfg.description ?? "")
				setProvider(cfg.config.provider ?? "")
				setModel(cfg.config.model ?? "")
				setSystemPrompt(cfg.systemPrompt ?? "")
				setThinkingLevel(cfg.config.thinking_level ?? "off")
				setIsDefault(cfg.isDefault)
				setToolsEnabled(cfg.config.tools_enabled ?? TOOLS.map((t) => t.name))
			}
			if (skillsRes.ok) {
				const skills: Skill[] = await skillsRes.json()
				setAttachedSkills(skills)
			}
		} catch {
			toast.error("Failed to load agent")
		}
		setLoading(false)
	}, [id])

	const fetchAllSkills = useCallback(async () => {
		try {
			const res = await fetch("/api/skills")
			if (res.ok) setAllSkills(await res.json())
		} catch {}
	}, [])

	useEffect(() => {
		fetchConfig()
		fetchAllSkills()
	}, [fetchConfig, fetchAllSkills])

	const handleSaveSettings = async () => {
		setSavingSettings(true)
		try {
			const res = await fetch(`/api/agent-configs/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					systemPrompt: systemPrompt.trim() || null,
					isDefault,
					config: {
						...(provider ? { provider } : {}),
						...(model ? { model } : {}),
						thinking_level: thinkingLevel,
						tools_enabled: toolsEnabled,
					},
				}),
			})
			if (res.ok) {
				toast.success("Settings saved")
				const updated = await res.json()
				setConfig(updated)
			} else {
				toast.error("Failed to save settings")
			}
		} catch {
			toast.error("Failed to save settings")
		} finally {
			setSavingSettings(false)
		}
	}

	const handleSaveTools = async () => {
		setSavingTools(true)
		try {
			const res = await fetch(`/api/agent-configs/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					config: {
						...(config?.config ?? {}),
						tools_enabled: toolsEnabled,
					},
				}),
			})
			if (res.ok) {
				toast.success("Tools saved")
			} else {
				toast.error("Failed to save tools")
			}
		} catch {
			toast.error("Failed to save tools")
		} finally {
			setSavingTools(false)
		}
	}

	const toggleTool = (toolName: string) => {
		setToolsEnabled((prev) =>
			prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName],
		)
	}

	const handleSaveSkills = async () => {
		setSavingSkills(true)
		try {
			const res = await fetch(`/api/agent-configs/${id}/skills`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ skillIds: attachedSkills.map((s) => s.id) }),
			})
			if (res.ok) {
				toast.success("Skills saved")
			} else {
				toast.error("Failed to save skills")
			}
		} catch {
			toast.error("Failed to save skills")
		} finally {
			setSavingSkills(false)
		}
	}

	const handleAddSkill = (skill: Skill) => {
		if (!attachedSkills.find((s) => s.id === skill.id)) {
			setAttachedSkills((prev) => [...prev, skill])
		}
		setSkillDialogOpen(false)
		setSkillSearch("")
	}

	const handleRemoveSkill = (skillId: string) => {
		setAttachedSkills((prev) => prev.filter((s) => s.id !== skillId))
	}

	const handleDragStart = (idx: number) => setDraggedIdx(idx)
	const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
		e.preventDefault()
		if (draggedIdx === null || draggedIdx === targetIdx) return
		const reordered = [...attachedSkills]
		const [removed] = reordered.splice(draggedIdx, 1)
		reordered.splice(targetIdx, 0, removed)
		setAttachedSkills(reordered)
		setDraggedIdx(targetIdx)
	}

	const handleDelete = async () => {
		try {
			const res = await fetch(`/api/agent-configs/${id}`, { method: "DELETE" })
			if (res.ok) {
				toast.success("Agent deleted")
				router.push("/agents")
			} else {
				toast.error("Failed to delete agent")
			}
		} catch {
			toast.error("Failed to delete agent")
		}
		setDeleting(false)
	}

	const hasDangerousTool = toolsEnabled.includes("bash") || toolsEnabled.includes("write")
	const filteredAllSkills = allSkills.filter(
		(s) =>
			!attachedSkills.find((a) => a.id === s.id) &&
			(s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
				(s.description ?? "").toLowerCase().includes(skillSearch.toLowerCase())),
	)

	if (loading) {
		return (
			<div className="max-w-3xl mx-auto py-6 px-2 flex items-center gap-2 text-muted-foreground text-sm">
				<IconLoader2 className="size-4 animate-spin" />
				Loading agent...
			</div>
		)
	}

	if (!config) {
		return (
			<div className="max-w-3xl mx-auto py-6 px-2 text-sm text-muted-foreground">Agent not found.</div>
		)
	}

	return (
		<div className="max-w-3xl mx-auto py-6 px-2">
			{/* Header */}
			<div className="flex items-start justify-between mb-6">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon-sm" onClick={() => router.push("/agents")}>
						<IconArrowLeft className="size-4" />
					</Button>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-xl font-semibold tracking-tight">{config.name}</h1>
							{config.isDefault && (
								<Badge variant="secondary" className="text-[10px]">
									Default
								</Badge>
							)}
						</div>
						{config.description && (
							<p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
						)}
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="text-destructive border-destructive/30 hover:bg-destructive/5"
					onClick={() => setDeleting(true)}
				>
					<IconTrash className="size-3.5" />
					Delete
				</Button>
			</div>

			{/* Tabs */}
			<Tabs defaultValue={defaultTab}>
				<TabsList className="mb-4">
					<TabsTrigger value="settings">Settings</TabsTrigger>
					<TabsTrigger value="tools">Tools</TabsTrigger>
					<TabsTrigger value="skills">Skills</TabsTrigger>
				</TabsList>

				{/* ── Settings ─────────────────────────────────────────────────────── */}
				<TabsContent value="settings">
					<div className="border rounded-lg overflow-hidden">
						<div className="flex flex-col gap-5 p-6">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="s-name">Name</Label>
								<Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="s-desc">Description</Label>
								<Input
									id="s-desc"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Optional description"
								/>
							</div>

							<Separator />

							<div className="flex flex-col gap-1.5">
								<Label>Model</Label>
								<p className="text-xs text-muted-foreground -mt-0.5">
									Leave blank to auto-detect from configured API keys.
								</p>
								<div className="flex gap-2">
									<Select
										value={provider}
										onValueChange={(v) => {
											setProvider(v)
											setModel("")
										}}
									>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="Provider (auto)" />
										</SelectTrigger>
										<SelectContent>
											{PROVIDERS.map((p) => (
												<SelectItem key={p.id} value={p.id}>
													{p.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select value={model} onValueChange={setModel} disabled={!provider}>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="Model (default)" />
										</SelectTrigger>
										<SelectContent>
											{(MODELS_BY_PROVIDER[provider] ?? []).map((m) => (
												<SelectItem key={m.id} value={m.id}>
													{m.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label>Thinking Level</Label>
								<div className="flex gap-1.5">
									{THINKING_LEVELS.map((lvl) => (
										<button
											key={lvl.value}
											type="button"
											onClick={() => setThinkingLevel(lvl.value)}
											className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
												thinkingLevel === lvl.value
													? "bg-primary text-primary-foreground border-primary"
													: "hover:bg-muted border-border text-muted-foreground"
											}`}
										>
											{lvl.label}
										</button>
									))}
								</div>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="s-prompt">System Prompt</Label>
								<Textarea
									id="s-prompt"
									value={systemPrompt}
									onChange={(e) => setSystemPrompt(e.target.value)}
									rows={8}
									className="font-mono text-xs resize-none"
									placeholder="Leave blank to use the default system prompt"
								/>
							</div>

							<div className="flex items-center gap-3">
								<Switch id="s-default" checked={isDefault} onCheckedChange={setIsDefault} />
								<div>
									<Label htmlFor="s-default" className="cursor-pointer">
										Set as default agent
									</Label>
									<p className="text-xs text-muted-foreground">
										New conversations will use this agent automatically.
									</p>
								</div>
							</div>
						</div>

						<div className="flex justify-end px-6 py-4 bg-muted/20 border-t">
							<Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
								{savingSettings && <IconLoader2 className="size-4 animate-spin" />}
								Save Changes
							</Button>
						</div>
					</div>
				</TabsContent>

				{/* ── Tools ────────────────────────────────────────────────────────── */}
				<TabsContent value="tools">
					<div className="border rounded-lg overflow-hidden">
						{!dangerDismissed && hasDangerousTool && (
							<div className="flex items-start gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
								<IconAlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
								<div className="flex-1 text-xs text-amber-800 dark:text-amber-300">
									<strong>bash</strong> and <strong>write</strong> execute code and modify the filesystem. Use only with
									trusted workspaces.
								</div>
								<button
									type="button"
									onClick={() => setDangerDismissed(true)}
									className="text-xs text-amber-600 hover:underline shrink-0"
								>
									Dismiss
								</button>
							</div>
						)}

						<div className="divide-y">
							{TOOLS.map((tool) => {
								const enabled = toolsEnabled.includes(tool.name)
								return (
									<div key={tool.name} className="flex items-center justify-between px-5 py-4">
										<div className="flex items-center gap-3">
											<div>
												<div className="flex items-center gap-2">
													<span className="font-mono text-sm">{tool.label}</span>
													{tool.dangerous && (
														<Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 px-1.5 py-0 h-4">
															caution
														</Badge>
													)}
												</div>
												<p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
											</div>
										</div>
										<Switch checked={enabled} onCheckedChange={() => toggleTool(tool.name)} />
									</div>
								)
							})}
						</div>

						<div className="flex justify-end px-5 py-4 bg-muted/20 border-t">
							<Button size="sm" onClick={handleSaveTools} disabled={savingTools}>
								{savingTools && <IconLoader2 className="size-4 animate-spin" />}
								Save Changes
							</Button>
						</div>
					</div>
				</TabsContent>

				{/* ── Skills ───────────────────────────────────────────────────────── */}
				<TabsContent value="skills">
					<div className="border rounded-lg overflow-hidden">
						{attachedSkills.length === 0 ? (
							<div className="flex flex-col items-center gap-3 py-12 text-center px-6">
								<p className="text-sm text-muted-foreground">No skills attached yet.</p>
								<p className="text-xs text-muted-foreground">
									Skills inject additional instructions into the agent's system prompt.
								</p>
							</div>
						) : (
							<div className="divide-y">
								{attachedSkills.map((skill, idx) => (
									<div
										key={skill.id}
										draggable
										onDragStart={() => handleDragStart(idx)}
										onDragOver={(e) => handleDragOver(e, idx)}
										onDragEnd={() => setDraggedIdx(null)}
										className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
									>
										<IconGripVertical className="size-4 text-muted-foreground/40 cursor-grab shrink-0" />
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">{skill.name}</span>
												{skill.isBuiltin && (
													<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
														Built-in
													</Badge>
												)}
											</div>
											{skill.description && (
												<p className="text-xs text-muted-foreground mt-0.5 truncate">{skill.description}</p>
											)}
										</div>
										{!skill.isBuiltin && (
											<Button
												size="icon-sm"
												variant="ghost"
												className="shrink-0 text-muted-foreground hover:text-foreground"
												onClick={() => router.push(`/agents/${id}/skills/${skill.id}`)}
											>
												<IconSearch className="size-3.5" />
											</Button>
										)}
										<Button
											size="icon-sm"
											variant="ghost"
											className="shrink-0 text-muted-foreground hover:text-destructive"
											onClick={() => handleRemoveSkill(skill.id)}
										>
											<IconTrash className="size-3.5" />
										</Button>
									</div>
								))}
							</div>
						)}

						<div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t gap-2">
							<div className="flex gap-2">
								<Button size="sm" variant="outline" onClick={() => setSkillDialogOpen(true)}>
									<IconPlus className="size-3.5" />
									Add Skill
								</Button>
								<Button size="sm" variant="outline" onClick={() => router.push(`/agents/${id}/skills/new`)}>
									Create Skill
								</Button>
							</div>
							<Button size="sm" onClick={handleSaveSkills} disabled={savingSkills}>
								{savingSkills && <IconLoader2 className="size-4 animate-spin" />}
								Save Changes
							</Button>
						</div>
					</div>
				</TabsContent>
			</Tabs>

			{/* Add Skill Dialog */}
			<Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Add Skill</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3">
						<div className="relative">
							<IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
							<Input
								placeholder="Search skills..."
								value={skillSearch}
								onChange={(e) => setSkillSearch(e.target.value)}
								className="pl-8 h-8 text-sm"
								autoFocus
							/>
						</div>
						<div className="flex flex-col max-h-64 overflow-y-auto divide-y border rounded-md">
							{filteredAllSkills.length === 0 ? (
								<p className="text-xs text-muted-foreground text-center py-6">
									{skillSearch ? "No matching skills" : "All skills already added"}
								</p>
							) : (
								filteredAllSkills.map((skill) => (
									<button
										key={skill.id}
										type="button"
										onClick={() => handleAddSkill(skill)}
										className="flex flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
									>
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">{skill.name}</span>
											{skill.isBuiltin && (
												<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
													Built-in
												</Badge>
											)}
										</div>
										{skill.description && (
											<span className="text-xs text-muted-foreground">{skill.description}</span>
										)}
									</button>
								))
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation */}
			<AlertDialog open={deleting} onOpenChange={setDeleting}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete agent?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{config.name}". Existing conversations will not be affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
