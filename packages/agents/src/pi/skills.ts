import type { SkillDefinition } from "../types.js"

export function formatSkillsForPrompt(skills: SkillDefinition[]): string {
	if (!skills.length) return ""
	const blocks = skills
		.map((s) => `<skill name="${s.name.replace(/"/g, "&quot;")}">\n${s.content}\n</skill>`)
		.join("\n\n")
	return `\n\n<skills>\n${blocks}\n</skills>`
}
