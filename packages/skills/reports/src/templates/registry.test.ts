import { describe, expect, it } from "vitest"
import { getTemplate, listTemplates, registerTemplate } from "./registry.js"
import type { MonthlyReportData, ReportTemplate } from "./types.js"

describe("template registry", () => {
	it("lists built-in monthly-report template", () => {
		const templates = listTemplates()
		const names = templates.map((t) => t.name)
		expect(names).toContain("monthly-report")
	})

	it("getTemplate returns the monthly-report template", () => {
		const tmpl = getTemplate("monthly-report")
		expect(tmpl).toBeDefined()
		expect(tmpl?.name).toBe("monthly-report")
		expect(tmpl?.label).toBe("Monthly Report")
		expect(tmpl?.formats).toContain("pdf")
		expect(tmpl?.formats).toContain("csv")
	})

	it("getTemplate returns undefined for unknown name", () => {
		expect(getTemplate("nonexistent-report")).toBeUndefined()
	})

	it("registerTemplate adds a custom template visible in listTemplates", () => {
		const custom: ReportTemplate = {
			name: "custom-test",
			label: "Custom Test Report",
			description: "A test template",
			schema: {} as never,
			formats: ["csv"],
			render: async () => Buffer.from(""),
		}

		registerTemplate(custom)

		const found = getTemplate("custom-test")
		expect(found).toBeDefined()
		expect(found?.name).toBe("custom-test")

		const names = listTemplates().map((t) => t.name)
		expect(names).toContain("custom-test")
	})

	it("registerTemplate overwrites an existing template with the same name", () => {
		const makeTemplate = (label: string): ReportTemplate => ({
			name: "overwrite-test",
			label,
			description: "",
			schema: {} as never,
			formats: ["pdf"],
			render: async (_format, _data: MonthlyReportData) => Buffer.from(""),
		})

		registerTemplate(makeTemplate("Version 1"))
		registerTemplate(makeTemplate("Version 2"))

		const found = getTemplate("overwrite-test")
		expect(found?.label).toBe("Version 2")
	})
})
