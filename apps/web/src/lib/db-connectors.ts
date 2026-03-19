import mysql from "mysql2/promise"
import { Pool as PgPool } from "pg"

export type ConnectionConfig = {
	host: string
	port: number
	database: string
	username: string
	password: string
	ssl?: boolean
}

export type ConnectionTestResult = {
	success: boolean
	message: string
	latencyms?: number
}

/**
 * Test a PostgreSQL connection.
 */
export async function testpostgresql(config: ConnectionConfig): Promise<ConnectionTestResult> {
	const start = Date.now()
	const pool = new PgPool({
		host: config.host,
		port: config.port,
		database: config.database,
		user: config.username,
		password: config.password,
		ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
		connectionTimeoutMillis: 10000,
	})

	try {
		const client = await pool.connect()
		try {
			const result = await client.query("SELECT version()")
			const latencyms = Date.now() - start
			const version = result.rows[0]?.version ?? "unknown"
			return {
				success: true,
				message: `Connected successfully. ${version}`,
				latencyms,
			}
		} finally {
			client.release()
		}
	} catch (error) {
		return {
			success: false,
			message: `Connection failed: ${(error as Error).message}`,
		}
	} finally {
		await pool.end()
	}
}

/**
 * Test a MySQL / MariaDB connection.
 */
export async function testmysql(config: ConnectionConfig): Promise<ConnectionTestResult> {
	const start = Date.now()
	let connection: mysql.Connection | null = null

	try {
		connection = await mysql.createConnection({
			host: config.host,
			port: config.port,
			database: config.database,
			user: config.username,
			password: config.password,
			ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
			connectTimeout: 10000,
		})

		const [rows] = await connection.query("SELECT VERSION() as version")
		const latencyms = Date.now() - start
		const version = (rows as { version: string }[])[0]?.version ?? "unknown"
		return {
			success: true,
			message: `Connected successfully. MySQL ${version}`,
			latencyms,
		}
	} catch (error) {
		return {
			success: false,
			message: `Connection failed: ${(error as Error).message}`,
		}
	} finally {
		if (connection) {
			await connection.end()
		}
	}
}

/**
 * Dispatcher — routes to the correct connector based on the db type.
 */
export async function testconnection(type: string, config: ConnectionConfig): Promise<ConnectionTestResult> {
	switch (type) {
		case "postgresql":
			return testpostgresql(config)
		case "mysql":
			return testmysql(config)
		default:
			return {
				success: false,
				message: `Unsupported database type: ${type}`,
			}
	}
}

// ─── Query Execution ──────────────────────────────────────────────────────────

export type QueryResult = {
	success: boolean
	rows?: Record<string, unknown>[]
	fields?: string[]
	rowcount: number
	error?: string
	latencyms?: number
}

const QUERY_TIMEOUT_MS = 30_000 // 30 seconds

/**
 * Execute a SQL query against a PostgreSQL database.
 */
export async function querypostgresql(config: ConnectionConfig, query: string): Promise<QueryResult> {
	const start = Date.now()
	const pool = new PgPool({
		host: config.host,
		port: config.port,
		database: config.database,
		user: config.username,
		password: config.password,
		ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
		connectionTimeoutMillis: 10_000,
		statement_timeout: QUERY_TIMEOUT_MS,
	})

	try {
		const client = await pool.connect()
		try {
			const result = await client.query(query)
			const latencyms = Date.now() - start
			return {
				success: true,
				rows: result.rows,
				fields: result.fields?.map((f) => f.name) ?? [],
				rowcount: result.rowCount ?? result.rows?.length ?? 0,
				latencyms,
			}
		} finally {
			client.release()
		}
	} catch (error) {
		return {
			success: false,
			rows: [],
			fields: [],
			rowcount: 0,
			error: (error as Error).message,
			latencyms: Date.now() - start,
		}
	} finally {
		await pool.end()
	}
}

/**
 * Execute a SQL query against a MySQL / MariaDB database.
 */
export async function querymysql(config: ConnectionConfig, query: string): Promise<QueryResult> {
	const start = Date.now()
	let connection: mysql.Connection | null = null

	try {
		connection = await mysql.createConnection({
			host: config.host,
			port: config.port,
			database: config.database,
			user: config.username,
			password: config.password,
			ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
			connectTimeout: 10_000,
		})

		// Set query timeout
		await connection.query(`SET SESSION MAX_EXECUTION_TIME = ${QUERY_TIMEOUT_MS}`)

		const [rows, fields] = await connection.query(query)
		const latencyms = Date.now() - start
		const rowarray = Array.isArray(rows) ? rows : []
		return {
			success: true,
			rows: rowarray as Record<string, unknown>[],
			fields: Array.isArray(fields) ? fields.map((f) => f.name) : [],
			rowcount: rowarray.length,
			latencyms,
		}
	} catch (error) {
		return {
			success: false,
			rows: [],
			fields: [],
			rowcount: 0,
			error: (error as Error).message,
			latencyms: Date.now() - start,
		}
	} finally {
		if (connection) {
			await connection.end()
		}
	}
}

/**
 * Dispatcher — execute a SQL query against the correct database type.
 */
export async function executequery(type: string, config: ConnectionConfig, query: string): Promise<QueryResult> {
	switch (type) {
		case "postgresql":
			return querypostgresql(config, query)
		case "mysql":
			return querymysql(config, query)
		default:
			return {
				success: false,
				rows: [],
				fields: [],
				rowcount: 0,
				error: `Unsupported database type: ${type}`,
			}
	}
}
