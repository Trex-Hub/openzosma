// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { pool } from "@/src/lib/db"
import { type ConnectionConfig, testconnection } from "@/src/lib/db-connectors"
import { decrypt } from "@/src/lib/encryption"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safedecrypt(value: string): string {
	try {
		return decrypt(value)
	} catch {
		return value
	}
}

function decryptconfig(stored: {
	host: string
	port: string | number
	database: string
	username: string
	password: string
	ssl: boolean
}): ConnectionConfig {
	const portraw = typeof stored.port === "number" ? String(stored.port) : stored.port

	return {
		host: safedecrypt(stored.host),
		port: Number(safedecrypt(portraw)),
		database: safedecrypt(stored.database),
		username: safedecrypt(stored.username),
		password: safedecrypt(stored.password),
		ssl: stored.ssl,
	}
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: { params: Promise<{ integrationid: string }> }) {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { integrationid } = await params

	try {
		// Fetch integration
		const integrationresult = await pool.query(
			`SELECT id, organizationid, type, config, status
       FROM public.integrations
       WHERE id = $1`,
			[integrationid],
		)

		if (integrationresult.rows.length === 0) {
			return NextResponse.json({ error: "Integration not found" }, { status: 404 })
		}

		const integration = integrationresult.rows[0]

		// Decrypt config and test connection
		const config = decryptconfig(integration.config)
		let status = "disconnected"

		try {
			const testresult = await testconnection(integration.type, config)
			status = testresult.success ? "connected" : "error"
		} catch {
			status = "error"
		}

		return NextResponse.json({
			dbtype: integration.type,
			dbname: config.database,
			status,
		})
	} catch (error) {
		return NextResponse.json({ error: `Server error: ${(error as Error).message}` }, { status: 500 })
	}
}
