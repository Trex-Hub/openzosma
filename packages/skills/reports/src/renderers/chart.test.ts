import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock chartjs-node-canvas before importing renderChart so the native canvas
// binary is never loaded. CI runners do not have the system libraries (Cairo,
// libpng) required to compile canvas@2.x, causing a hard module-not-found
// error when the real binding is required.
vi.mock("chartjs-node-canvas", () => {
	const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

	const ChartJSNodeCanvas = vi.fn().mockImplementation(() => ({
		renderToBuffer: vi.fn().mockResolvedValue(PNG_HEADER),
		renderToBufferSync: vi.fn().mockReturnValue(Buffer.from("<svg/>", "utf-8")),
	}))

	return { ChartJSNodeCanvas }
})

import { renderChart } from "./chart.js"

describe("renderChart", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders a bar chart and returns a Buffer with PNG magic bytes", async () => {
		const buf = await renderChart({
			type: "bar",
			title: "Test Bar Chart",
			labels: ["Jan", "Feb", "Mar"],
			datasets: [
				{
					label: "Sessions",
					data: [10, 20, 15],
					backgroundColor: "rgba(54, 162, 235, 0.5)",
				},
			],
		})

		expect(buf).toBeInstanceOf(Buffer)
		// PNG magic bytes: \x89PNG
		expect(buf[0]).toBe(0x89)
		expect(buf[1]).toBe(0x50) // P
		expect(buf[2]).toBe(0x4e) // N
		expect(buf[3]).toBe(0x47) // G
	})

	it("renders a line chart", async () => {
		const buf = await renderChart({
			type: "line",
			title: "Line Chart",
			labels: ["Q1", "Q2"],
			datasets: [{ label: "Value", data: [5, 10] }],
		})
		expect(buf).toBeInstanceOf(Buffer)
		expect(buf.length).toBeGreaterThan(0)
	})

	it("renders a pie chart", async () => {
		const buf = await renderChart({
			type: "pie",
			title: "Pie Chart",
			labels: ["A", "B"],
			datasets: [{ label: "Share", data: [60, 40] }],
		})
		expect(buf).toBeInstanceOf(Buffer)
		expect(buf.length).toBeGreaterThan(0)
	})

	it("renders an SVG when format is svg", async () => {
		const buf = await renderChart(
			{
				type: "bar",
				title: "SVG Chart",
				labels: ["X"],
				datasets: [{ label: "Y", data: [1] }],
			},
			"svg",
		)
		expect(buf).toBeInstanceOf(Buffer)
		expect(buf.toString()).toContain("<svg")
	})
})
