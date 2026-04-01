// Reports Skill — template-based and agent-generated report creation.
export { createReportListTemplatesTool, createReportGenerateTool, createReportExecuteCodeTool } from "./tools.js"
export type {
	MonthlyReportData,
	MetricRow,
	ChartDefinition,
	ChartDataset,
	TableDefinition,
	RenderOpts,
	ReportFormat,
	ReportTemplate,
} from "./templates/types.js"
export { MonthlyReportDataSchema, MonthlyReportTemplate } from "./templates/monthly-report.js"
export { getTemplate, listTemplates, registerTemplate } from "./templates/registry.js"
