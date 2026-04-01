import type { MonthlyReportData } from "../templates/types.js"

/**
 * Escape a single CSV field value.
 * Wraps in double-quotes if the value contains a comma, newline, or double-quote.
 * Inner double-quotes are escaped as "".
 */
const escapeCsvField = (value: string): string => {
	if (value.includes(",") || value.includes("\n") || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

/**
 * Render a 2D array of string rows as a CSV block.
 */
const renderTable = (headers: string[], rows: string[][]): string => {
	const lines: string[] = [headers.map(escapeCsvField).join(",")]
	for (const row of rows) {
		lines.push(row.map(escapeCsvField).join(","))
	}
	return lines.join("\n")
}

/**
 * Render MonthlyReportData to a CSV buffer.
 *
 * Outputs three sections separated by blank lines:
 * 1. Summary metrics (label, value, unit, change)
 * 2. One block per table defined in data.tables
 *
 * @param data - The monthly report data to render.
 * @returns A Buffer containing the UTF-8 encoded CSV content.
 */
export const renderCsv = async (data: MonthlyReportData): Promise<Buffer> => {
	const sections: string[] = []

	// Section 1: metrics
	sections.push(
		renderTable(
			["label", "value", "unit", "change"],
			data.metrics.map((m) => [
				m.label,
				String(m.value),
				m.unit ?? "",
				m.change !== undefined ? String(m.change) : "",
			]),
		),
	)

	// Section 2+: one block per table
	for (const table of data.tables) {
		sections.push(`# ${table.title}`)
		sections.push(renderTable(table.headers, table.rows))
	}

	return Buffer.from(sections.join("\n\n"), "utf-8")
}
