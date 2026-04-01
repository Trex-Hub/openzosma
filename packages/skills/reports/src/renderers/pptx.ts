import { createRequire } from "node:module"
import type { MonthlyReportData, RenderOpts } from "../templates/types.js"
import { renderChart } from "./chart.js"

const require = createRequire(import.meta.url)
// pptxgenjs ships a CJS bundle; load it via require to get the constructor
const PptxGenJS = require("pptxgenjs") as new () => {
	layout: string
	addSlide(): {
		addText(text: string, opts: object): void
		addTable(rows: object[], opts: object): void
		addImage(opts: object): void
	}
	write(opts: { outputType: string }): Promise<unknown>
}

type PptxRow = { text: string; options?: { bold?: boolean } }[]

/**
 * Render MonthlyReportData to a PowerPoint (PPTX) buffer using pptxgenjs.
 *
 * Slide layout:
 *   1. Title slide — report title + period
 *   2. Metrics slide — label/value/unit/change table
 *   3+. One slide per chart (PNG embedded via addImage)
 *   N+. One slide per table
 *
 * Charts are rendered via chartjs-node-canvas → PNG buffer → base64 → addImage.
 *
 * @param data - The monthly report data to render.
 * @param opts - Render options.
 * @returns A Buffer containing the PPTX binary content.
 */
export const renderPptx = async (data: MonthlyReportData, _opts?: RenderOpts): Promise<Buffer> => {
	const pptx = new PptxGenJS()
	pptx.layout = "LAYOUT_16x9"

	// --- Slide 1: Title ---
	const titleSlide = pptx.addSlide()
	titleSlide.addText(data.title, {
		x: 0.5,
		y: 1.5,
		w: 9,
		h: 1.2,
		fontSize: 36,
		bold: true,
		align: "center",
	})
	titleSlide.addText(`${data.period.start} — ${data.period.end}`, {
		x: 0.5,
		y: 2.9,
		w: 9,
		h: 0.7,
		fontSize: 20,
		align: "center",
		color: "555555",
	})

	if (data.summary) {
		titleSlide.addText(data.summary, {
			x: 0.5,
			y: 3.8,
			w: 9,
			h: 1.2,
			fontSize: 14,
			align: "center",
			color: "444444",
		})
	}

	// --- Slide 2: Metrics ---
	if (data.metrics.length > 0) {
		const metricsSlide = pptx.addSlide()
		metricsSlide.addText("Metrics", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 20, bold: true })

		const headerRow: PptxRow = [
			{ text: "Metric", options: { bold: true } },
			{ text: "Value", options: { bold: true } },
			{ text: "Unit", options: { bold: true } },
			{ text: "Change", options: { bold: true } },
		]

		const metricRows: PptxRow[] = data.metrics.map((m) => [
			{ text: m.label },
			{ text: String(m.value) },
			{ text: m.unit ?? "" },
			{ text: m.change !== undefined ? String(m.change) : "" },
		])

		metricsSlide.addTable([headerRow, ...metricRows], {
			x: 0.5,
			y: 1.1,
			w: 9,
			colW: [3, 2, 2, 2],
			fontSize: 13,
		})
	}

	// --- Chart slides: one per chart ---
	for (const chart of data.charts) {
		const chartBuf = await renderChart(chart)
		const chartBase64 = chartBuf.toString("base64")

		const chartSlide = pptx.addSlide()
		chartSlide.addText(chart.title, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 20, bold: true })
		chartSlide.addImage({
			data: `image/png;base64,${chartBase64}`,
			x: 0.5,
			y: 1.1,
			w: 9,
			h: 4.5,
		})
	}

	// --- Table slides: one per table ---
	for (const table of data.tables) {
		const tableSlide = pptx.addSlide()
		tableSlide.addText(table.title, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 20, bold: true })

		const headerRow: PptxRow = table.headers.map((h) => ({ text: h, options: { bold: true } }))
		const dataRows: PptxRow[] = table.rows.map((row) => row.map((cell) => ({ text: cell })))

		const colCount = table.headers.length
		const colW = Array(colCount).fill(9 / colCount) as number[]

		tableSlide.addTable([headerRow, ...dataRows], {
			x: 0.5,
			y: 1.1,
			w: 9,
			colW,
			fontSize: 12,
		})
	}

	const result = await pptx.write({ outputType: "nodebuffer" })
	return result as Buffer
}
