// -- Agent Types --

export interface AgentType {
	id: string
	name: string
	description: string | null
	configSchema: unknown | null
	isAvailable: boolean
	createdAt: Date
}

// -- Agent Configs --

export interface AgentConfig {
	id: string
	organizationId: string | null
	agentTypeId: string
	name: string
	description: string | null
	systemPrompt: string | null
	config: Record<string, unknown>
	isDefault: boolean
	createdAt: Date
	updatedAt: Date
}

// -- Agent Skills --

export interface AgentSkill {
	id: string
	name: string
	description: string | null
	content: string
	isBuiltin: boolean
	enabled: boolean
	sortOrder: number
	createdAt: Date
	updatedAt: Date
}

export interface AgentConfigSkill {
	agentConfigId: string
	skillId: string
	enabled: boolean
	sortOrder: number
}

export interface ResolvedSkill {
	name: string
	content: string
}

// -- API Keys --

export interface ApiKey {
	id: string
	name: string
	keyHash: string
	keyPrefix: string
	scopes: string[]
	lastUsedAt: Date | null
	expiresAt: Date | null
	createdAt: Date
}

// -- Usage --

export interface UsageRecord {
	id: string
	sessionId: string | null
	tokensIn: number
	tokensOut: number
	cost: number
	model: string | null
	createdAt: Date
}

// -- Connections --

export type ConnectionType = "postgresql" | "mysql" | "mongodb" | "clickhouse" | "bigquery" | "sqlite" | "generic_sql"

export interface Connection {
	id: string
	name: string
	type: ConnectionType
	encryptedCredentials: string
	schemaCache: unknown | null
	readOnly: boolean
	queryTimeout: number
	rowLimit: number
	createdAt: Date
	updatedAt: Date
}

// -- Settings --

export interface Setting {
	key: string
	value: unknown
	updatedAt: Date
}
