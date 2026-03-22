"use client"

import { Badge } from "@/src/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible"
import {
	CheckCircleIcon,
	ChevronDownIcon,
	DatabaseIcon,
	ListIcon,
	LoaderIcon,
	SearchIcon,
	WrenchIcon,
	XCircleIcon,
} from "lucide-react"
import type { StreamToolCall } from "./types"

const TOOL_DISPLAY: Record<string, { label: string; icon: typeof WrenchIcon }> = {
	listintegrationstool: {
		label: "Discovering databases",
		icon: ListIcon,
	},
	searchknowledgetool: {
		label: "Searching knowledge base",
		icon: SearchIcon,
	},
	executesqlquerytool: {
		label: "Running SQL query",
		icon: DatabaseIcon,
	},
}

const getToolDisplay = (toolname: string) => {
	return TOOL_DISPLAY[toolname] ?? { label: toolname, icon: WrenchIcon }
}

type ToolActivityPillProps = {
	tool: StreamToolCall
}

const ToolActivityPill = ({ tool }: ToolActivityPillProps) => {
	const display = getToolDisplay(tool.toolname)
	const Icon = display.icon
	const isRunning = tool.state === "calling" || tool.state === "streaming-args"
	const isError = tool.state === "error" || tool.iserror

	return (
		<Collapsible>
			<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs transition-colors hover:bg-muted/70">
				<div className="flex flex-1 items-center gap-2 min-w-0">
					{isRunning ? (
						<LoaderIcon className="size-3.5 animate-spin text-primary shrink-0" />
					) : isError ? (
						<XCircleIcon className="size-3.5 text-destructive shrink-0" />
					) : (
						<CheckCircleIcon className="size-3.5 text-emerald-500 shrink-0" />
					)}
					<Icon className="size-3.5 text-muted-foreground shrink-0" />
					<span className="font-medium text-foreground truncate">{display.label}</span>
					{isRunning && (
						<Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 shrink-0">
							Running
						</Badge>
					)}
					{tool.state === "result" && !tool.iserror && (
						<Badge
							variant="secondary"
							className="ml-auto text-[10px] px-1.5 py-0 shrink-0 bg-emerald-500/10 text-emerald-600"
						>
							Done
						</Badge>
					)}
					{isError && (
						<Badge
							variant="secondary"
							className="ml-auto text-[10px] px-1.5 py-0 shrink-0 bg-destructive/10 text-destructive"
						>
							Error
						</Badge>
					)}
				</div>
				<ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-1.5 space-y-1.5">
				{tool.args && Object.keys(tool.args).length > 0 && (
					<div className="rounded-md border bg-background px-3 py-2">
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Parameters</p>
						<pre className="text-[11px] text-foreground overflow-auto max-h-32 whitespace-pre-wrap font-mono">
							{typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}
						</pre>
					</div>
				)}
				{tool.result !== undefined && (
					<div className="rounded-md border bg-background px-3 py-2">
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
							{tool.iserror ? "Error" : "Result"}
						</p>
						<pre
							className={`text-[11px] overflow-auto max-h-48 whitespace-pre-wrap font-mono ${
								tool.iserror ? "text-destructive" : "text-foreground"
							}`}
						>
							{typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)}
						</pre>
					</div>
				)}
			</CollapsibleContent>
		</Collapsible>
	)
}

export default ToolActivityPill
