/**
 * Core types for the report generation skill.
 *
 * MonthlyReportData is the canonical data shape accepted by the built-in
 * monthly-report template. Custom templates may define their own shapes.
 */
import type { TSchema } from "@sinclair/typebox"

/** Output format supported by report templates. */
export type ReportFormat = "pdf" | "pptx" | "csv" | "xlsx" | "png" | "svg"

/** Options passed to a template renderer. */
export interface RenderOpts {
	/** Directory where rendered output files are written. */
	outputDir: string
}

/** A single dataset within a chart. */
export interface ChartDataset {
	/** Dataset label shown in the chart legend. */
	label: string
	/** Numeric data values aligned with the chart's labels array. */
	data: number[]
	/** Optional bar/area fill color(s). */
	backgroundColor?: string | string[]
	/** Optional line border color(s). */
	borderColor?: string | string[]
}

/** A chart definition embedded in a report. */
export interface ChartDefinition {
	/** Chart type. */
	type: "bar" | "line" | "pie"
	/** Chart title displayed above the chart. */
	title: string
	/** X-axis / slice labels. */
	labels: string[]
	/** One or more datasets to plot. */
	datasets: ChartDataset[]
}

/** A table definition embedded in a report. */
export interface TableDefinition {
	/** Table title displayed above the table. */
	title: string
	/** Column header labels. */
	headers: string[]
	/** Data rows — each inner array must have the same length as headers. */
	rows: string[][]
}

/** A single summary metric row. */
export interface MetricRow {
	/** Human-readable metric name. */
	label: string
	/** Numeric value. */
	value: number
	/** Optional unit suffix, e.g. "%" or "ms". */
	unit?: string
	/** Optional period-over-period change, e.g. 0.12 for +12%. */
	change?: number
}

/**
 * Canonical data shape for the built-in monthly-report template.
 *
 * All fields except summary are required. charts and tables may be empty
 * arrays when not applicable, but must be present.
 */
export interface MonthlyReportData {
	/** Report title. */
	title: string
	/** Reporting period. */
	period: { start: string; end: string }
	/** Summary metrics displayed in the metrics section. */
	metrics: MetricRow[]
	/** Charts to embed. Maximum 20 per render call. */
	charts: ChartDefinition[]
	/** Tables to embed. */
	tables: TableDefinition[]
	/** Optional executive summary paragraph. */
	summary?: string
}

/**
 * A report template definition.
 *
 * Register custom templates at startup via registerTemplate() from the
 * registry module. The registry is the extension point for adding new
 * templates beyond the built-in ones.
 */
export interface ReportTemplate {
	/** Unique machine-readable name, e.g. "monthly-report". */
	name: string
	/** Human-readable display label. */
	label: string
	/** Short description of what the template produces. */
	description: string
	/** TypeBox schema for the data payload accepted by this template. */
	schema: TSchema
	/** Output formats this template supports. */
	formats: ReportFormat[]
	/**
	 * Render the template to a Buffer.
	 *
	 * @param format - Requested output format.
	 * @param data   - Validated template data.
	 * @param opts   - Render options (output directory, etc.).
	 * @returns Buffer containing the rendered output bytes.
	 */
	render: (format: ReportFormat, data: MonthlyReportData, opts: RenderOpts) => Promise<Buffer>
}
