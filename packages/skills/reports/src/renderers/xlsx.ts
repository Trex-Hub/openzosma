import ExcelJS from "exceljs"
import type { MonthlyReportData, RenderOpts } from "../templates/types.js"

/**
 * Render MonthlyReportData to an Excel (XLSX) buffer using exceljs.
 *
 * Sheet layout:
 *   - Sheet "Metrics": label, value, unit, change columns
 *   - One sheet per table in data.tables, using the table title as the sheet name
 *
 * @param data - The monthly report data to render.
 * @param opts - Render options.
 * @returns A Buffer containing the XLSX binary content.
 */
export const renderXlsx = async (data: MonthlyReportData, _opts?: RenderOpts): Promise<Buffer> => {
	const workbook = new ExcelJS.Workbook()

	// --- Sheet 1: Metrics ---
	const metricsSheet = workbook.addWorksheet("Metrics")
	metricsSheet.columns = [
		{ header: "label", key: "label", width: 28 },
		{ header: "value", key: "value", width: 20 },
		{ header: "unit", key: "unit", width: 14 },
		{ header: "change", key: "change", width: 14 },
	]
	const metricsHeader = metricsSheet.getRow(1)
	metricsHeader.font = { bold: true }
	metricsHeader.commit()

	for (const m of data.metrics) {
		metricsSheet.addRow({
			label: m.label,
			value: m.value,
			unit: m.unit ?? "",
			change: m.change ?? "",
		})
	}

	// --- One sheet per table ---
	for (const table of data.tables) {
		// Excel sheet names max 31 chars, strip invalid chars
		const sheetName = table.title.replace(/[[\]\\/*?:]/g, "").slice(0, 31)
		const sheet = workbook.addWorksheet(sheetName)

		sheet.columns = table.headers.map((h) => ({
			header: h,
			key: h,
			width: Math.max(h.length + 4, 14),
		}))

		const headerRow = sheet.getRow(1)
		headerRow.font = { bold: true }
		headerRow.commit()

		for (const row of table.rows) {
			const rowObj: Record<string, string> = {}
			table.headers.forEach((h, i) => {
				rowObj[h] = row[i] ?? ""
			})
			sheet.addRow(rowObj)
		}
	}

	const arrayBuffer = await workbook.xlsx.writeBuffer()
	return Buffer.from(arrayBuffer)
}
