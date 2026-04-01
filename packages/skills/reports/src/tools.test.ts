import type { ExtensionContext } from "@mariozechner/pi-coding-agent"
import type { Type } from "@sinclair/typebox"
import { describe, expect, it } from "vitest"
import { createReportExecuteCodeTool, createReportGenerateTool, createReportListTemplatesTool } from "./tools.js"

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Minimal stub — tests don't rely on ctx methods.
const stubCtx = {} as ExtensionContext

const invoke = async (tool: ReturnType<typeof createReportListTemplatesTool>, params: unknown) => {
	const result = await tool.execute("test-call-id", params, new AbortController().signal, () => {}, stubCtx)
	return result.content[0].type === "text" ? (result.content[0] as { type: "text"; text: string }).text : ""
}

// ─── report_list_templates ────────────────────────────────────────────────────

describe("report_list_templates", () => {
	it("returns an array that includes the monthly-report template", async () => {
		const tool = createReportListTemplatesTool()
		const output = await invoke(tool, {})
		const templates = JSON.parse(output) as { name: string }[]
		expect(Array.isArray(templates)).toBe(true)
		const names = templates.map((t) => t.name)
		expect(names).toContain("monthly-report")
	})
})

// ─── report_generate ─────────────────────────────────────────────────────────

describe("report_generate", () => {
	it("returns an error for an unknown template name", async () => {
		const tool = createReportGenerateTool()
		const output = await invoke(tool, {
			template: "does-not-exist",
			format: "pdf",
			data: {},
		})
		expect(output).toContain("Unknown template: does-not-exist")
	})

	it("returns an error when charts array exceeds 20 entries", async () => {
		const tool = createReportGenerateTool()
		const charts = Array.from({ length: 21 }, (_, i) => ({
			type: "bar" as const,
			title: `Chart ${i}`,
			labels: ["A"],
			datasets: [{ label: "ds", data: [i] }],
		}))
		const output = await invoke(tool, {
			template: "monthly-report",
			format: "csv",
			data: {
				title: "Test",
				period: { start: "2025-01-01", end: "2025-01-31" },
				metrics: [],
				charts,
				tables: [],
			},
		})
		expect(output).toContain("Chart limit exceeded")
		expect(output).toContain("21")
	})

	it("returns a schema validation error for missing required field", async () => {
		const tool = createReportGenerateTool()
		// 'title' is required by the monthly-report schema but omitted here
		const output = await invoke(tool, {
			template: "monthly-report",
			format: "csv",
			data: {
				period: { start: "2025-01-01", end: "2025-01-31" },
				metrics: [],
				charts: [],
				tables: [],
			},
		})
		expect(output).toContain("Validation errors")
	})
})

// ─── report_execute_code ──────────────────────────────────────────────────────

describe("report_execute_code", () => {
	it("has the expected parameter shape", () => {
		const tool = createReportExecuteCodeTool()
		expect(tool.name).toBe("report_execute_code")

		const paramSchema = tool.parameters as ReturnType<typeof Type.Object>
		const props = paramSchema.properties as Record<string, unknown>

		expect(props).toHaveProperty("language")
		expect(props).toHaveProperty("code")
		expect(props).toHaveProperty("dependencies")
		expect(props).toHaveProperty("outputDir")
	})
})
