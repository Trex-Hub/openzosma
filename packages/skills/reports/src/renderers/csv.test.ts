import { describe, expect, it } from "vitest"
import type { MonthlyReportData } from "../templates/types.js"
import { renderCsv } from "./csv.js"

const baseData: MonthlyReportData = {
	title: "March 2026 Report",
	period: { start: "2026-03-01", end: "2026-03-31" },
	metrics: [
		{ label: "Sessions", value: 42, unit: "count", change: 0.12 },
		{ label: "Avg Duration", value: 95, unit: "s" },
	],
	charts: [],
	tables: [
		{
			title: "Top Channels",
			headers: ["Channel", "Messages"],
			rows: [
				["#general", "310"],
				["#engineering", "205"],
			],
		},
	],
}

describe("renderCsv", () => {
	it("returns a non-empty Buffer", async () => {
		const buf = await renderCsv(baseData)
		expect(buf).toBeInstanceOf(Buffer)
		expect(buf.length).toBeGreaterThan(0)
	})

	it("metrics section has correct headers and values", async () => {
		const buf = await renderCsv(baseData)
		const text = buf.toString("utf-8")
		expect(text).toContain("label,value,unit,change")
		expect(text).toContain("Sessions,42,count,0.12")
		expect(text).toContain("Avg Duration,95,s,")
	})

	it("table section uses the table title as a comment header", async () => {
		const buf = await renderCsv(baseData)
		const text = buf.toString("utf-8")
		expect(text).toContain("# Top Channels")
		expect(text).toContain("Channel,Messages")
		expect(text).toContain("#general,310")
	})

	it("sections are separated by a blank line", async () => {
		const buf = await renderCsv(baseData)
		const text = buf.toString("utf-8")
		expect(text).toContain("\n\n")
	})

	it("escapes fields containing commas", async () => {
		const data: MonthlyReportData = {
			...baseData,
			tables: [
				{
					title: "Test",
					headers: ["Name"],
					rows: [["Smith, John"]],
				},
			],
		}
		const buf = await renderCsv(data)
		expect(buf.toString("utf-8")).toContain('"Smith, John"')
	})

	it("escapes fields containing double-quotes", async () => {
		const data: MonthlyReportData = {
			...baseData,
			tables: [
				{
					title: "Test",
					headers: ["Name"],
					rows: [['He said "hello"']],
				},
			],
		}
		const buf = await renderCsv(data)
		expect(buf.toString("utf-8")).toContain('"He said ""hello"""')
	})

	it("escapes fields containing newlines", async () => {
		const data: MonthlyReportData = {
			...baseData,
			tables: [
				{
					title: "Test",
					headers: ["Name"],
					rows: [["line1\nline2"]],
				},
			],
		}
		const buf = await renderCsv(data)
		expect(buf.toString("utf-8")).toContain('"line1\nline2"')
	})
})
