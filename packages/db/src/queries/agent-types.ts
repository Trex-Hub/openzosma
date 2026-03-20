import type pg from "pg"
import type { AgentType } from "../types.js"

export async function getAgentType(pool: pg.Pool, id: string): Promise<AgentType | null> {
	const result = await pool.query("SELECT * FROM agent_types WHERE id = $1", [id])
	return result.rows[0] ? mapAgentType(result.rows[0]) : null
}

export async function listAgentTypes(pool: pg.Pool): Promise<AgentType[]> {
	const result = await pool.query(
		"SELECT * FROM agent_types WHERE is_available = true ORDER BY id",
	)
	return result.rows.map(mapAgentType)
}

function mapAgentType(row: Record<string, unknown>): AgentType {
	return {
		id: row.id as string,
		name: row.name as string,
		description: row.description as string | null,
		configSchema: row.config_schema ?? null,
		isAvailable: row.is_available as boolean,
		createdAt: row.created_at as Date,
	}
}
