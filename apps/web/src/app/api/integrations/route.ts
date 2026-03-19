// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { pool } from "@/src/lib/db"
import { decrypt, encrypt } from "@/src/lib/encryption"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Encrypt every sensitive field in the connection config. */
function encryptConfig(raw: {
	host: string
	port: number
	database: string
	username: string
	password: string
	ssl: boolean
}) {
	return {
		host: encrypt(raw.host),
		port: encrypt(String(raw.port)),
		database: encrypt(raw.database),
		username: encrypt(raw.username),
		password: encrypt(raw.password ?? ""),
		ssl: raw.ssl, // boolean – not sensitive
	}
}

/**
 * Decrypt every sensitive field from the stored config.
 * Handles legacy records where host/port/database were stored in plaintext.
 */
function decryptConfig(stored: {
	host: string
	port: string | number
	database: string
	username: string
	password: string
	ssl: boolean
}) {
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

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { searchParams } = new URL(request.url)
	const id = searchParams.get("id")

	// ── Single integration by ID (includes decrypted config for editing) ──
	if (id) {
		try {
			const result = await pool.query(
				`SELECT id, organizationid, teamid, name, type, config, status, createdby, createdat, updatedat
         FROM public.integrations
         WHERE id = $1`,
				[id],
			)

			if (result.rows.length === 0) {
				return NextResponse.json({ error: "Integration not found" }, { status: 404 })
			}

			const row = result.rows[0]

			const decryptedConfig = decryptConfig(row.config)

			return NextResponse.json({
				integration: {
					id: row.id,
					teamid: row.teamid,
					name: row.name,
					type: row.type,
					config: decryptedConfig,
					status: row.status,
					createdby: row.createdby,
					createdat: row.createdat,
					updatedat: row.updatedat,
				},
			})
		} catch (error) {
			return NextResponse.json({ error: `Failed to fetch integration: ${(error as Error).message}` }, { status: 500 })
		}
	}

	// ── List integrations (no config exposed) ──
	try {
		const result = await pool.query(
			`SELECT
         i.id,
         i.teamid,
         i.name,
         i.type,
         i.status,
         i.workflowrunid,
         i.workflowstatus,
         i.createdby,
         i.createdat,
         i.updatedat,
         COALESCE(ks.status, 'none') AS knowledgestatus
       FROM public.integrations i
       LEFT JOIN public.knowledgesources ks
         ON ks.integrationid = i.id::text
         AND ks.deletedat IS NULL
       ORDER BY i.createdat DESC`,
			[],
		)

		return NextResponse.json({ integrations: result.rows })
	} catch (error) {
		return NextResponse.json({ error: `Failed to fetch integrations: ${(error as Error).message}` }, { status: 500 })
	}
}

// ─── POST (Create) ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { teamid, name, type, host, port, database, username, password, ssl } = body

		if (!name || !type || !host || !port || !database || !username) {
			return NextResponse.json(
				{
					error: "Missing required fields: name, type, host, port, database, username",
				},
				{ status: 400 },
			)
		}

		const config = encryptConfig({
			host,
			port: Number(port),
			database,
			username,
			password: password ?? "",
			ssl: ssl ?? false,
		})

		const result = await pool.query(
			`INSERT INTO public.integrations
         (teamid, name, type, config, status, createdby)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, teamid, name, type, status, workflowrunid, workflowstatus, createdby, createdat, updatedat`,
			[teamid ?? "", name, type, JSON.stringify(config), "active", session.user.id],
		)

		return NextResponse.json({ integration: result.rows[0] }, { status: 201 })
	} catch (error) {
		return NextResponse.json({ error: `Failed to create integration: ${(error as Error).message}` }, { status: 500 })
	}
}

// ─── PUT (Update) ────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { id, name, type, host, port, database, username, password, ssl } = body

		if (!id) {
			return NextResponse.json({ error: "Missing required field: id" }, { status: 400 })
		}

		// Verify the integration exists and isn't deleted
		const existing = await pool.query("SELECT id, organizationid FROM public.integrations WHERE id = $1", [id])

		if (existing.rows.length === 0) {
			return NextResponse.json({ error: "Integration not found" }, { status: 404 })
		}

		// Build SET clause dynamically for provided fields
		const updates: string[] = []
		const values: unknown[] = []
		let paramIndex = 1

		if (name !== undefined) {
			updates.push(`name = $${paramIndex++}`)
			values.push(name)
		}

		if (type !== undefined) {
			updates.push(`type = $${paramIndex++}`)
			values.push(type)
		}

		// If any connection field is provided, re-encrypt the full config
		if (
			host !== undefined ||
			port !== undefined ||
			database !== undefined ||
			username !== undefined ||
			password !== undefined ||
			ssl !== undefined
		) {
			if (!host || !port || !database || !username) {
				return NextResponse.json(
					{
						error: "When updating connection details, host, port, database, and username are required",
					},
					{ status: 400 },
				)
			}

			const config = encryptConfig({
				host,
				port: Number(port),
				database,
				username,
				password: password ?? "",
				ssl: ssl ?? false,
			})

			updates.push(`config = $${paramIndex++}`)
			values.push(JSON.stringify(config))
		}

		if (updates.length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400 })
		}

		updates.push("updatedat = NOW()")
		values.push(id)

		const result = await pool.query(
			`UPDATE public.integrations
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, organizationid, teamid, name, type, status, workflowrunid, workflowstatus, createdby, createdat, updatedat`,
			values,
		)

		return NextResponse.json({ integration: result.rows[0] })
	} catch (error) {
		return NextResponse.json({ error: `Failed to update integration: ${(error as Error).message}` }, { status: 500 })
	}
}

// ─── DELETE (Hard delete) ────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const { searchParams } = new URL(request.url)
		const id = searchParams.get("id")

		if (!id) {
			return NextResponse.json({ error: "Missing required query parameter: id" }, { status: 400 })
		}

		const result = await pool.query("DELETE FROM public.integrations WHERE id = $1 RETURNING id", [id])

		if (result.rowCount === 0) {
			return NextResponse.json({ error: "Integration not found" }, { status: 404 })
		}

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: `Failed to delete integration: ${(error as Error).message}` }, { status: 500 })
	}
}
