"use client"

import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { Switch } from "@/src/components/ui/switch"
import { Textarea } from "@/src/components/ui/textarea"
import { IconArrowLeft, IconLoader2 } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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

const DEFAULT_PROMPT_PLACEHOLDER = `You are a helpful AI assistant running inside the OpenZosma platform.
You have access to tools for reading files, writing files, editing files, executing shell commands, searching file contents, finding files, and listing directories.
Use these tools when the user asks you to work with files, code, or the system.
Be direct and concise. When showing code, use markdown code blocks with language annotations.`

type AgentType = { id: string; name: string }

export default function NewAgentPage() {
	const router = useRouter()
	const [saving, setSaving] = useState(false)
	const [agentTypes, setAgentTypes] = useState<AgentType[]>([])

	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [agentTypeId, setAgentTypeId] = useState("pi-agent")
	const [provider, setProvider] = useState("")
	const [model, setModel] = useState("")
	const [systemPrompt, setSystemPrompt] = useState("")
	const [isDefault, setIsDefault] = useState(false)

	useEffect(() => {
		fetch("/api/agent-types")
			.then((r) => (r.ok ? r.json() : []))
			.then((types: AgentType[]) => {
				setAgentTypes(types)
				if (types.length > 0 && !agentTypeId) setAgentTypeId(types[0].id)
			})
			.catch(() => {})
	}, [agentTypeId])

	const handleProviderChange = (val: string) => {
		setProvider(val)
		setModel("")
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) {
			toast.error("Name is required")
			return
		}

		setSaving(true)
		try {
			const res = await fetch("/api/agent-configs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					agentTypeId,
					name: name.trim(),
					description: description.trim() || null,
					systemPrompt: systemPrompt.trim() || null,
					isDefault,
					config: {
						...(provider ? { provider } : {}),
						...(model ? { model } : {}),
					},
				}),
			})

			if (res.ok) {
				const data = await res.json()
				toast.success("Agent created")
				router.push(`/agents/${data.id}`)
			} else {
				toast.error("Failed to create agent")
			}
		} catch {
			toast.error("Failed to create agent")
		} finally {
			setSaving(false)
		}
	}

	const availableModels = provider ? (MODELS_BY_PROVIDER[provider] ?? []) : []

	return (
		<div className="max-w-2xl mx-auto py-6 px-2">
			{/* Header */}
			<div className="flex items-center gap-3 mb-6">
				<Button variant="ghost" size="icon-sm" onClick={() => router.push("/agents")}>
					<IconArrowLeft className="size-4" />
				</Button>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">New Agent</h1>
					<p className="text-sm text-muted-foreground">Configure a custom AI agent</p>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="border rounded-lg overflow-hidden">
				<div className="flex flex-col gap-5 p-6">
					{/* Name */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="name">
							Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My Custom Agent"
							required
						/>
					</div>

					{/* Description */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="description">Description</Label>
						<Input
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description"
						/>
					</div>

					{/* Agent Type */}
					<div className="flex flex-col gap-1.5">
						<Label>Agent Type</Label>
						<Select value={agentTypeId} onValueChange={setAgentTypeId}>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								{agentTypes.length > 0 ? (
									agentTypes.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))
								) : (
									<SelectItem value="pi-agent">Pi Agent</SelectItem>
								)}
							</SelectContent>
						</Select>
					</div>

					{/* Provider + Model */}
					<div className="flex flex-col gap-1.5">
						<Label>Model</Label>
						<p className="text-xs text-muted-foreground -mt-0.5">
							Leave blank to auto-detect from configured API keys.
						</p>
						<div className="flex gap-2">
							<Select value={provider} onValueChange={handleProviderChange}>
								<SelectTrigger className="flex-1">
									<SelectValue placeholder="Provider" />
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
									<SelectValue placeholder="Model" />
								</SelectTrigger>
								<SelectContent>
									{availableModels.map((m) => (
										<SelectItem key={m.id} value={m.id}>
											{m.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* System Prompt */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="system-prompt">System Prompt</Label>
						<Textarea
							id="system-prompt"
							value={systemPrompt}
							onChange={(e) => setSystemPrompt(e.target.value)}
							placeholder={DEFAULT_PROMPT_PLACEHOLDER}
							rows={6}
							className="font-mono text-xs resize-none"
						/>
					</div>

					{/* Set as default */}
					<div className="flex items-center gap-3">
						<Switch id="is-default" checked={isDefault} onCheckedChange={setIsDefault} />
						<div>
							<Label htmlFor="is-default" className="cursor-pointer">
								Set as default agent
							</Label>
							<p className="text-xs text-muted-foreground">New conversations will use this agent automatically.</p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 px-6 py-4 bg-muted/20 border-t">
					<Button type="button" variant="outline" onClick={() => router.push("/agents")} disabled={saving}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving || !name.trim()}>
						{saving && <IconLoader2 className="size-4 animate-spin" />}
						Create Agent
					</Button>
				</div>
			</form>
		</div>
	)
}
