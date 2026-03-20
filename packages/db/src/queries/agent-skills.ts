import type pg from "pg"
import type { AgentSkill, ResolvedSkill } from "../types.js"

export async function createSkill(
	pool: pg.Pool,
	skill: {
		name: string
		description?: string
		content: string
		isBuiltin?: boolean
	},
): Promise<AgentSkill> {
	const result = await pool.query(
		`INSERT INTO agent_skills (name, description, content, is_builtin)
		 VALUES ($1, $2, $3, $4)
		 RETURNING *`,
		[skill.name, skill.description ?? null, skill.content, skill.isBuiltin ?? false],
	)
	return mapSkill(result.rows[0])
}

export async function getSkill(pool: pg.Pool, id: string): Promise<AgentSkill | null> {
	const result = await pool.query("SELECT * FROM agent_skills WHERE id = $1", [id])
	return result.rows[0] ? mapSkill(result.rows[0]) : null
}

export async function listSkills(pool: pg.Pool): Promise<AgentSkill[]> {
	const result = await pool.query(
		"SELECT * FROM agent_skills ORDER BY sort_order ASC, created_at ASC",
	)
	return result.rows.map(mapSkill)
}

export async function updateSkill(
	pool: pg.Pool,
	id: string,
	updates: Partial<{
		name: string
		description: string | null
		content: string
		enabled: boolean
		sortOrder: number
	}>,
): Promise<AgentSkill | null> {
	const fields: string[] = []
	const values: unknown[] = []
	let paramIndex = 1

	if (updates.name !== undefined) {
		fields.push(`name = $${paramIndex++}`)
		values.push(updates.name)
	}
	if (updates.description !== undefined) {
		fields.push(`description = $${paramIndex++}`)
		values.push(updates.description)
	}
	if (updates.content !== undefined) {
		fields.push(`content = $${paramIndex++}`)
		values.push(updates.content)
	}
	if (updates.enabled !== undefined) {
		fields.push(`enabled = $${paramIndex++}`)
		values.push(updates.enabled)
	}
	if (updates.sortOrder !== undefined) {
		fields.push(`sort_order = $${paramIndex++}`)
		values.push(updates.sortOrder)
	}

	if (fields.length === 0) return getSkill(pool, id)

	fields.push("updated_at = now()")
	values.push(id)

	const result = await pool.query(
		`UPDATE agent_skills SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
		values,
	)
	return result.rows[0] ? mapSkill(result.rows[0]) : null
}

export async function deleteSkill(pool: pg.Pool, id: string): Promise<void> {
	await pool.query("DELETE FROM agent_skills WHERE id = $1 AND is_builtin = false", [id])
}

export async function getSkillsForConfig(
	pool: pg.Pool,
	agentConfigId: string,
): Promise<ResolvedSkill[]> {
	const result = await pool.query(
		`SELECT s.name, s.content
		 FROM agent_skills s
		 JOIN agent_config_skills acs ON acs.skill_id = s.id
		 WHERE acs.agent_config_id = $1
		   AND acs.enabled = true
		   AND s.enabled = true
		 ORDER BY acs.sort_order ASC, s.sort_order ASC`,
		[agentConfigId],
	)
	return result.rows.map((row) => ({
		name: row.name as string,
		content: row.content as string,
	}))
}

export async function setConfigSkills(
	pool: pg.Pool,
	agentConfigId: string,
	skillIds: string[],
): Promise<void> {
	await pool.query("DELETE FROM agent_config_skills WHERE agent_config_id = $1", [agentConfigId])
	if (skillIds.length === 0) return
	const placeholders = skillIds.map((_, i) => `($1, $${i + 2})`).join(", ")
	await pool.query(
		`INSERT INTO agent_config_skills (agent_config_id, skill_id) VALUES ${placeholders}`,
		[agentConfigId, ...skillIds],
	)
}

function mapSkill(row: Record<string, unknown>): AgentSkill {
	return {
		id: row.id as string,
		name: row.name as string,
		description: row.description as string | null,
		content: row.content as string,
		isBuiltin: row.is_builtin as boolean,
		enabled: row.enabled as boolean,
		sortOrder: row.sort_order as number,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
	}
}
