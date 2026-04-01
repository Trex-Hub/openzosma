import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import type { AgentToolResult } from "@mariozechner/pi-agent-core"
import type { ToolDefinition } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import type { TSchema } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"
import { getTemplate, listTemplates } from "./templates/registry.js"
import type { MonthlyReportData } from "./templates/types.js"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const textResult = (text: string): AgentToolResult<unknown> => ({
	content: [{ type: "text", text }],
	details: {},
})

const OUTPUT_DIR = "/workspace/output"

const MIME_MAP: Record<string, string> = {
	png: "image/png",
	svg: "image/svg+xml",
	pdf: "application/pdf",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	csv: "text/csv",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

const OUTPUT_EXTENSIONS = new Set(["png", "svg", "pdf", "pptx", "csv", "xlsx"])

// ─── Tool factories ───────────────────────────────────────────────────────────

/**
 * Create the report_list_templates tool.
 *
 * Returns a JSON array of all registered report templates, including their
 * name, label, description, and supported output formats.
 */
export const createReportListTemplatesTool = (): ToolDefinition => ({
	name: "report_list_templates",
	label: "List Report Templates",
	description: "List all available report templates with their names, descriptions, and supported formats.",
	promptSnippet: "report_list_templates() — list available report templates",
	parameters: Type.Object({}),
	execute: async (_toolCallId, _params, _signal, _onUpdate, _ctx): Promise<AgentToolResult<unknown>> => {
		const templates = listTemplates().map((t) => ({
			name: t.name,
			label: t.label,
			description: t.description,
			formats: t.formats,
		}))
		return textResult(JSON.stringify(templates, null, 2))
	},
})

/**
 * Create the report_generate tool.
 *
 * Validates the input data against the template's TypeBox schema, renders
 * the report, writes it to /workspace/output/, and returns the file path
 * and size.
 */
export const createReportGenerateTool = (): ToolDefinition => ({
	name: "report_generate",
	label: "Generate Report",
	description:
		"Generate a report from a registered template and structured data. " +
		"Returns the file path and size of the generated report.",
	promptSnippet: "report_generate(template, format, data) — render a report from a template",
	parameters: Type.Object({
		template: Type.String({ description: "Template name, e.g. 'monthly-report'." }),
		format: Type.Union(
			[
				Type.Literal("pdf"),
				Type.Literal("pptx"),
				Type.Literal("csv"),
				Type.Literal("xlsx"),
				Type.Literal("png"),
				Type.Literal("svg"),
			],
			{ description: "Output format." },
		),
		data: Type.Object(
			{},
			{
				additionalProperties: true,
				description: "Structured data matching the template schema.",
			},
		),
		outputFilename: Type.Optional(Type.String({ description: "Override the output filename." })),
	}),
	execute: async (_toolCallId, params, _signal, _onUpdate, _ctx): Promise<AgentToolResult<unknown>> => {
		const p = params as {
			template: string
			format: "pdf" | "pptx" | "csv" | "xlsx" | "png" | "svg"
			data: Record<string, unknown>
			outputFilename?: string
		}

		const template = getTemplate(p.template)
		if (!template) {
			return textResult(`Unknown template: ${p.template}`)
		}

		// Schema validation
		if (!Value.Check(template.schema as TSchema, p.data)) {
			const errors = [...Value.Errors(template.schema as TSchema, p.data)]
			const lines = errors.map((e) => `  - ${e.path || "/"}: ${e.message}`)
			return textResult(`Validation errors:\n${lines.join("\n")}`)
		}

		// Chart limit guard
		const charts = (p.data as { charts?: unknown[] }).charts
		if (Array.isArray(charts) && charts.length > 20) {
			return textResult(
				`Chart limit exceeded: maximum 20 charts per report. You provided ${charts.length}. Split into multiple reports or reduce the number of charts.`,
			)
		}

		mkdirSync(OUTPUT_DIR, { recursive: true })

		const buffer = await template.render(p.format, p.data as unknown as MonthlyReportData, { outputDir: OUTPUT_DIR })

		const filename = p.outputFilename ?? `${p.template}-${Date.now()}.${p.format}`
		const outPath = `${OUTPUT_DIR}/${filename}`
		writeFileSync(outPath, buffer)

		const sizeBytes = statSync(outPath).size

		return textResult(JSON.stringify({ path: outPath, filename, sizeBytes }, null, 2))
	},
})

/**
 * Create the report_execute_code tool.
 *
 * Installs optional dependencies, writes code to a temp file, executes it
 * inside /workspace, and returns paths to any generated output files together
 * with captured stdout.
 */
export const createReportExecuteCodeTool = (): ToolDefinition => ({
	name: "report_execute_code",
	label: "Execute Report Code",
	description:
		"Execute Python or JavaScript code to generate charts, reports, or data visualizations. " +
		"Code should save output files to /workspace/output/. " +
		"Returns file paths and stdout.",
	promptSnippet:
		"report_execute_code(language, code, dependencies?, outputDir?) — run code that generates report files",
	parameters: Type.Object({
		language: Type.Union([Type.Literal("python"), Type.Literal("javascript")], {
			description: "Runtime to use.",
		}),
		code: Type.String({ description: "Code to execute." }),
		dependencies: Type.Optional(
			Type.Array(Type.String(), { description: "Additional packages to install before execution." }),
		),
		outputDir: Type.Optional(
			Type.String({ description: "Override the output directory (default: /workspace/output)." }),
		),
	}),
	execute: async (_toolCallId, params, _signal, _onUpdate, _ctx): Promise<AgentToolResult<unknown>> => {
		const p = params as {
			language: "python" | "javascript"
			code: string
			dependencies?: string[]
			outputDir?: string
		}

		const outputDir = p.outputDir ?? OUTPUT_DIR
		mkdirSync(outputDir, { recursive: true })

		// Install dependencies
		if (p.dependencies && p.dependencies.length > 0) {
			try {
				if (p.language === "python") {
					execFileSync("pip3", ["install", "--break-system-packages", ...p.dependencies], {
						timeout: 30000,
					})
				} else {
					execFileSync("npm", ["install", "-g", ...p.dependencies], {
						timeout: 30000,
					})
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				return textResult(`Dependency installation failed: ${msg}`)
			}
		}

		// Write code to temp file
		const ext = p.language === "python" ? "py" : "js"
		mkdirSync("/tmp/agent", { recursive: true })
		const scriptPath = `/tmp/agent/report_${randomUUID()}.${ext}`
		writeFileSync(scriptPath, p.code)

		// Execute
		let stdout = ""
		try {
			const runtime = p.language === "python" ? "python3" : "node"
			const result = execFileSync(runtime, [scriptPath], {
				timeout: 60000,
				cwd: "/workspace",
				encoding: "utf-8",
			})
			stdout = result
		} catch (err) {
			const execErr = err as NodeJS.ErrnoException & { stderr?: string }
			const msg = execErr.stderr ?? execErr.message ?? String(err)
			return textResult(msg)
		}

		// Collect output files
		const files = readdirSync(outputDir)
			.filter((f) => {
				const ext = f.split(".").pop() ?? ""
				return OUTPUT_EXTENSIONS.has(ext)
			})
			.map((filename) => {
				const filePath = `${outputDir}/${filename}`
				const ext = filename.split(".").pop() ?? ""
				return {
					path: filePath,
					filename,
					sizeBytes: statSync(filePath).size,
					mimeType: MIME_MAP[ext] ?? "application/octet-stream",
				}
			})

		return textResult(JSON.stringify({ files, stdout }, null, 2))
	},
})
