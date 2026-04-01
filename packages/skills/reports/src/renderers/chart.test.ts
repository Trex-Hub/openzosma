import { describe, expect, it } from "vitest"
import { renderChart } from "./chart.js"

describe("renderChart", () => {
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
})
