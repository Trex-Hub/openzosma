/**
 * Built-in monthly report template.
 *
 * Accepts MonthlyReportData, validates it via TypeBox, and dispatches
 * rendering to format-specific renderers.
 */

import { Type } from "@sinclair/typebox"
import { renderCsv } from "../renderers/csv.js"
import { renderPdf } from "../renderers/pdf.js"
import { renderPptx } from "../renderers/pptx.js"
import { renderXlsx } from "../renderers/xlsx.js"
import type { MonthlyReportData, RenderOpts, ReportFormat, ReportTemplate } from "./types.js"

// ---------------------------------------------------------------------------
// TypeBox schema (mirrors the MonthlyReportData interface in types.ts)
// ---------------------------------------------------------------------------

const MetricRowSchema = Type.Object({
	label: Type.String(),
	value: Type.Number(),
	unit: Type.Optional(Type.String()),
	change: Type.Optional(Type.Number()),
})

const ChartDatasetSchema = Type.Object({
	label: Type.String(),
	data: Type.Array(Type.Number()),
	backgroundColor: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
	borderColor: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
})

const ChartDefinitionSchema = Type.Object({
	type: Type.Union([Type.Literal("bar"), Type.Literal("line"), Type.Literal("pie")]),
	title: Type.String(),
	labels: Type.Array(Type.String()),
	datasets: Type.Array(ChartDatasetSchema),
})

const TableDefinitionSchema = Type.Object({
	title: Type.String(),
	headers: Type.Array(Type.String()),
	rows: Type.Array(Type.Array(Type.String())),
})

/** TypeBox schema for {@link MonthlyReportData}. Exported for use by the tool layer. */
export const MonthlyReportDataSchema = Type.Object({
	title: Type.String({ minLength: 1 }),
	period: Type.Object({
		start: Type.String({ minLength: 1 }),
		end: Type.String({ minLength: 1 }),
	}),
	metrics: Type.Array(MetricRowSchema),
	charts: Type.Array(ChartDefinitionSchema),
	tables: Type.Array(TableDefinitionSchema),
	summary: Type.Optional(Type.String()),
})

// ---------------------------------------------------------------------------
// Renderer dispatcher
// ---------------------------------------------------------------------------

const renderMonthlyReport = async (
	format: ReportFormat,
	data: MonthlyReportData,
	opts: RenderOpts,
): Promise<Buffer> => {
	switch (format) {
		case "pdf":
			return renderPdf(data, opts)
		case "pptx":
			return renderPptx(data, opts)
		case "csv":
			return renderCsv(data)
		case "xlsx":
			return renderXlsx(data, opts)
		case "png":
		case "svg":
			throw new Error(`Format '${format}' is not supported by the monthly-report template directly. Use report_execute_code to generate charts as standalone image files.`)
		default: {
			const _exhaustive: never = format
			throw new Error(`Unsupported format: ${String(_exhaustive)}`)
		}
	}
}

// ---------------------------------------------------------------------------
// Template definition
// ---------------------------------------------------------------------------

/** Built-in monthly report template. */
export const MonthlyReportTemplate: ReportTemplate = {
	name: "monthly-report",
	label: "Monthly Report",
	description:
		"A structured monthly report with summary metrics, embedded charts, and data tables. " +
		"Supports PDF, PPTX, CSV, and XLSX output formats.",
	schema: MonthlyReportDataSchema,
	formats: ["pdf", "pptx", "csv", "xlsx"],
	render: renderMonthlyReport,
}
