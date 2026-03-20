import type pg from "pg"
import type { AgentConfig } from "../types.js"

export async function createAgentConfig(
	pool: pg.Pool,
	config: {
		agentTypeId: string
		name: string
		description?: string
		organizationId?: string
		systemPrompt?: string
		config?: Record<string, unknown>
		isDefault?: boolean
	},
): Promise<AgentConfig> {
	const result = await pool.query(
		`INSERT INTO agent_configs (organization_id, agent_type_id, name, description, system_prompt, config, is_default)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING *`,
		[
			config.organizationId ?? null,
			config.agentTypeId,
			config.name,
			config.description ?? null,
			config.systemPrompt ?? null,
			JSON.stringify(config.config ?? {}),
			config.isDefault ?? false,
		],
	)
	return mapAgentConfig(result.rows[0])
}

export async function getAgentConfig(pool: pg.Pool, id: string): Promise<AgentConfig | null> {
	const result = await pool.query("SELECT * FROM agent_configs WHERE id = $1", [id])
	return result.rows[0] ? mapAgentConfig(result.rows[0]) : null
}

export async function listAgentConfigs(pool: pg.Pool, organizationId?: string): Promise<AgentConfig[]> {
	if (organizationId) {
		const result = await pool.query(
			"SELECT * FROM agent_configs WHERE organization_id = $1 ORDER BY created_at DESC",
			[organizationId],
		)
		return result.rows.map(mapAgentConfig)
	}
	const result = await pool.query("SELECT * FROM agent_configs ORDER BY created_at DESC")
	return result.rows.map(mapAgentConfig)
}

export async function updateAgentConfig(
	pool: pg.Pool,
	id: string,
	updates: Partial<{
		name: string
		description: string | null
		organizationId: string | null
		agentTypeId: string
		systemPrompt: string | null
		config: Record<string, unknown>
		isDefault: boolean
	}>,
): Promise<AgentConfig | null> {
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
	if (updates.organizationId !== undefined) {
		fields.push(`organization_id = $${paramIndex++}`)
		values.push(updates.organizationId)
	}
	if (updates.agentTypeId !== undefined) {
		fields.push(`agent_type_id = $${paramIndex++}`)
		values.push(updates.agentTypeId)
	}
	if (updates.systemPrompt !== undefined) {
		fields.push(`system_prompt = $${paramIndex++}`)
		values.push(updates.systemPrompt)
	}
	if (updates.config !== undefined) {
		fields.push(`config = $${paramIndex++}`)
		values.push(JSON.stringify(updates.config))
	}
	if (updates.isDefault !== undefined) {
		fields.push(`is_default = $${paramIndex++}`)
		values.push(updates.isDefault)
	}

	if (fields.length === 0) return getAgentConfig(pool, id)

	fields.push("updated_at = now()")
	values.push(id)

	const result = await pool.query(
		`UPDATE agent_configs SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
		values,
	)
	return result.rows[0] ? mapAgentConfig(result.rows[0]) : null
}

export async function deleteAgentConfig(pool: pg.Pool, id: string): Promise<void> {
	await pool.query("DELETE FROM agent_configs WHERE id = $1", [id])
}

function mapAgentConfig(row: Record<string, unknown>): AgentConfig {
	return {
		id: row.id as string,
		organizationId: row.organization_id as string | null,
		agentTypeId: row.agent_type_id as string,
		name: row.name as string,
		description: row.description as string | null,
		systemPrompt: row.system_prompt as string | null,
		config: row.config as Record<string, unknown>,
		isDefault: row.is_default as boolean,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
	}
}
