// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { pool } from "@/src/lib/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// ─── POST ─────────────────────────────────────────────────────────────────────
// Cosine similarity search over knowledgechunks using pgvector.
//
// POST /api/embeddings/search

export async function POST(request: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { integrationids, vector, limit } = body as {
			integrationids?: string[]
			vector: number[]
			limit?: number
		}

		// ── Validate inputs ──

		if (!vector || !Array.isArray(vector) || vector.length === 0) {
			return NextResponse.json({ error: "vector is required and must be a non-empty array" }, { status: 400 })
		}

		const resultlimit = Math.min(Math.max(limit || 10, 1), 100)

		// Build the pgvector text representation
		const vectortext = `[${vector.join(",")}]`

		// Determine integration filter
		const hasintegrationfilter = integrationids && Array.isArray(integrationids) && integrationids.length > 0

		const result = await pool.query(
			`SELECT
         kc.content,
         kc.metadata,
         1 - (kc.embedding <=> $1::vector) AS similarity
       FROM public.knowledgechunks kc
       JOIN public.knowledgesources ks ON kc.sourceid = ks.id
       WHERE kc.deletedat IS NULL
         AND ks.deletedat IS NULL
         ${hasintegrationfilter ? "AND ks.integrationid = ANY($3::text[])" : ""}
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $2`,
			hasintegrationfilter ? [vectortext, resultlimit, integrationids] : [vectortext, resultlimit],
		)

		return NextResponse.json({
			results: result.rows.map((row: { content: string; metadata: Record<string, unknown>; similarity: number }) => ({
				content: row.content,
				metadata: row.metadata,
				similarity: Number.parseFloat(String(row.similarity)),
			})),
		})
	} catch (error) {
		return NextResponse.json({ error: `Server error: ${(error as Error).message}` }, { status: 500 })
	}
}
