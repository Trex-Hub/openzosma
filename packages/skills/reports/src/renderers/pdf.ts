import ReactPDF from "@react-pdf/renderer"
import React from "react"
import type { MonthlyReportData, RenderOpts } from "../templates/types.js"
import { renderChart } from "./chart.js"

const { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } = ReactPDF

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 11,
		color: "#222",
	},
	title: {
		fontSize: 22,
		fontFamily: "Helvetica-Bold",
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 12,
		marginBottom: 20,
		color: "#555",
	},
	sectionHeading: {
		fontSize: 13,
		fontFamily: "Helvetica-Bold",
		marginBottom: 6,
		marginTop: 16,
	},
	tableRow: {
		flexDirection: "row",
		borderBottomWidth: 0.5,
		borderBottomColor: "#ccc",
		paddingVertical: 3,
	},
	tableHeaderRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#888",
		paddingVertical: 3,
		fontFamily: "Helvetica-Bold",
	},
	cell: {
		flex: 1,
		fontSize: 10,
	},
	chart: {
		width: 480,
		height: 240,
		marginBottom: 10,
	},
	summary: {
		fontSize: 11,
		color: "#444",
		marginBottom: 12,
		lineHeight: 1.5,
	},
})

/**
 * Render MonthlyReportData to a PDF buffer using @react-pdf/renderer.
 *
 * Layout:
 *   Page 1 — title, period, optional summary, metrics table
 *   Page 2+ — one chart image per ChartDefinition (PNG embedded)
 *   Final — one section per TableDefinition
 *
 * @param data - The monthly report data to render.
 * @param opts - Render options.
 * @returns A Buffer containing the PDF binary content.
 */
export const renderPdf = async (data: MonthlyReportData, _opts?: RenderOpts): Promise<Buffer> => {
	// Pre-render all charts to base64 PNG data URIs
	const chartUris: string[] = await Promise.all(
		data.charts.map(async (chart) => {
			const buf = await renderChart(chart)
			return `data:image/png;base64,${buf.toString("base64")}`
		}),
	)

	const children: React.ReactElement[] = []

	// --- Page 1: title + metrics ---
	const page1Rows: React.ReactElement[] = [
		React.createElement(Text, { key: "title", style: styles.title }, data.title),
		React.createElement(Text, { key: "period", style: styles.subtitle }, `${data.period.start} — ${data.period.end}`),
	]

	if (data.summary) {
		page1Rows.push(React.createElement(Text, { key: "summary", style: styles.summary }, data.summary))
	}

	if (data.metrics.length > 0) {
		page1Rows.push(React.createElement(Text, { key: "metricsHeading", style: styles.sectionHeading }, "Metrics"))

		const metricHeaderRow = React.createElement(
			View,
			{ key: "metricHeader", style: styles.tableHeaderRow },
			React.createElement(Text, { style: styles.cell }, "Metric"),
			React.createElement(Text, { style: styles.cell }, "Value"),
			React.createElement(Text, { style: styles.cell }, "Unit"),
			React.createElement(Text, { style: styles.cell }, "Change"),
		)

		const metricDataRows = data.metrics.map((m, i) =>
			React.createElement(
				View,
				{ key: `m${i}`, style: styles.tableRow },
				React.createElement(Text, { style: styles.cell }, m.label),
				React.createElement(Text, { style: styles.cell }, String(m.value)),
				React.createElement(Text, { style: styles.cell }, m.unit ?? ""),
				React.createElement(Text, { style: styles.cell }, m.change !== undefined ? String(m.change) : ""),
			),
		)

		page1Rows.push(
			React.createElement(View, { key: "metricsTable" }, metricHeaderRow, ...metricDataRows),
		)
	}

	children.push(React.createElement(Page, { key: "p1", size: "A4", style: styles.page }, ...page1Rows))

	// --- Chart pages ---
	for (let i = 0; i < data.charts.length; i++) {
		const chart = data.charts[i]
		const uri = chartUris[i]
		children.push(
			React.createElement(
				Page,
				{ key: `chart${i}`, size: "A4", style: styles.page },
				React.createElement(Text, { style: styles.sectionHeading }, chart.title),
				React.createElement(Image, { src: uri, style: styles.chart }),
			),
		)
	}

	// --- Table pages ---
	for (let t = 0; t < data.tables.length; t++) {
		const table = data.tables[t]
		const headerRow = React.createElement(
			View,
			{ key: "th", style: styles.tableHeaderRow },
			...table.headers.map((h, hi) => React.createElement(Text, { key: hi, style: styles.cell }, h)),
		)
		const dataRows = table.rows.map((row, ri) =>
			React.createElement(
				View,
				{ key: `r${ri}`, style: styles.tableRow },
				...row.map((cell, ci) => React.createElement(Text, { key: ci, style: styles.cell }, cell)),
			),
		)
		children.push(
			React.createElement(
				Page,
				{ key: `table${t}`, size: "A4", style: styles.page },
				React.createElement(Text, { style: styles.sectionHeading }, table.title),
				React.createElement(View, { key: "tableBody" }, headerRow, ...dataRows),
			),
		)
	}

	const doc = React.createElement(Document, null, ...children)
	return renderToBuffer(doc)
}
