// -- Agent Configs --

export interface AgentConfig {
	id: string
	name: string
	description: string | null
	model: string
	provider: string
	systemPrompt: string | null
	toolsEnabled: string[]
	skills: string[]
	maxTokens: number
	temperature: number
	createdAt: Date
	updatedAt: Date
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
