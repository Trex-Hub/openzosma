/**
 * Template registry for the report generation skill.
 *
 * Built-in templates are registered on module load. Custom templates can be
 * added at runtime via registerTemplate(), making this the extension point
 * for adding templates beyond the built-in set.
 */

import { MonthlyReportTemplate } from "./monthly-report.js"
import type { ReportTemplate } from "./types.js"

const registry = new Map<string, ReportTemplate>([[MonthlyReportTemplate.name, MonthlyReportTemplate]])

/**
 * Register a report template.
 *
 * If a template with the same name already exists it will be overwritten.
 * Use this to add custom templates at application startup.
 *
 * @param template - Template to register.
 */
export const registerTemplate = (template: ReportTemplate): void => {
	registry.set(template.name, template)
}

/**
 * List all registered report templates.
 *
 * @returns Array of all registered templates.
 */
export const listTemplates = (): ReportTemplate[] => Array.from(registry.values())

/**
 * Look up a template by name.
 *
 * @param name - Template identifier, e.g. "monthly-report".
 * @returns The template, or undefined if not found.
 */
export const getTemplate = (name: string): ReportTemplate | undefined => registry.get(name)
