// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { pool } from "@/src/lib/db"
import { type ConnectionConfig, executequery } from "@/src/lib/db-connectors"
import { decrypt } from "@/src/lib/encryption"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Try to decrypt a value. If it fails (e.g. legacy plaintext data),
 * return the original value as-is.
 */
function safeDecrypt(value: string): string {
	try {
		return decrypt(value)
	} catch {
		return value
	}
}

/**
 * Decrypt every sensitive field from the stored config.
 */
function decryptConfig(stored: {
	host: string
	port: string | number
	database: string
	username: string
	password: string
	ssl: boolean
}): ConnectionConfig {
	const portRaw = typeof stored.port === "number" ? String(stored.port) : stored.port

	return {
		host: safeDecrypt(stored.host),
		port: Number(safeDecrypt(portRaw)),
		database: safeDecrypt(stored.database),
		username: safeDecrypt(stored.username),
		password: safeDecrypt(stored.password),
		ssl: stored.ssl,
	}
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	// Authenticate
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { integrationid, query } = body

		// ── Validate inputs ──
		if (!integrationid) {
			return NextResponse.json({ error: "integrationid is required" }, { status: 400 })
		}
		if (!query || typeof query !== "string" || !query.trim()) {
			return NextResponse.json({ error: "query is required and must be a non-empty string" }, { status: 400 })
		}

		// ── Fetch integration ──
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

		// ── Verify integration is active ──
		if (integration.status !== "active") {
			return NextResponse.json({ error: "Integration is not active" }, { status: 400 })
		}

		// ── Decrypt config and execute query ──
		const config = decryptConfig(integration.config)
		const result = await executequery(integration.type, config, query.trim())

		if (result.success) {
			return NextResponse.json({
				success: true,
				rows: result.rows,
				fields: result.fields,
				rowcount: result.rowcount,
				latencyms: result.latencyms,
			})
		}

		// Return the database error to the caller
		return NextResponse.json(
			{
				success: false,
				error: result.error,
				latencyms: result.latencyms,
			},
			{ status: 422 },
		)
	} catch (error) {
		return NextResponse.json({ error: `Server error: ${(error as Error).message}` }, { status: 500 })
	}
}
