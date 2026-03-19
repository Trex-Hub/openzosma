// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { pool } from "@/src/lib/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// ─── Types ────────────────────────────────────────────────────────────────────

type EmbeddingPayload = {
	vector: number[]
	metadata: {
		text: string
		integrationid: string
		chunkindex: number
		totalchunks: number
		[key: string]: unknown
	}
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { integrationid, indexname, embeddings } = body as {
			integrationid: string
			indexname: string
			embeddings: EmbeddingPayload[]
		}

		// ── Validate inputs ──
		if (!integrationid) {
			return NextResponse.json({ error: "integrationid is required" }, { status: 400 })
		}
		if (!indexname) {
			return NextResponse.json({ error: "indexname is required" }, { status: 400 })
		}
		if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
			return NextResponse.json({ error: "embeddings must be a non-empty array" }, { status: 400 })
		}

		// Validate each embedding has vector and metadata.text
		for (let i = 0; i < embeddings.length; i++) {
			const emb = embeddings[i]
			if (!emb.vector || !Array.isArray(emb.vector) || emb.vector.length === 0) {
				return NextResponse.json(
					{
						error: `embeddings[${i}].vector is required and must be a non-empty array`,
					},
					{ status: 400 },
				)
			}
			if (!emb.metadata?.text) {
				return NextResponse.json({ error: `embeddings[${i}].metadata.text is required` }, { status: 400 })
			}
		}

		// ── Execute in a transaction ──
		const client = await pool.connect()

		try {
			await client.query("BEGIN")

			// 1. Find or create a knowledgesources row for this integration
			const existingsource = await client.query(
				`SELECT id FROM public.knowledgesources
         WHERE integrationid = $1
           AND sourcetype = 'integration'
           AND deletedat IS NULL
         LIMIT 1`,
				[integrationid],
			)

			let sourceid: string

			if (existingsource.rows.length > 0) {
				sourceid = existingsource.rows[0].id

				// Mark as processing
				await client.query(
					`UPDATE public.knowledgesources
           SET status = 'processing', updatedat = CURRENT_TIMESTAMP
           WHERE id = $1`,
					[sourceid],
				)
			} else {
				// Look up integration name for a descriptive source name
				const integrationresult = await client.query(
					`SELECT name FROM public.integrations
           WHERE id = $1`,
					[integrationid],
				)

				const integrationname = integrationresult.rows[0]?.name ?? "Database Integration"

				const newsource = await client.query(
					`INSERT INTO public.knowledgesources
             (integrationid, sourcetype, name, description, status, createdby)
           VALUES ($1, 'integration', $2, $3, 'processing', 'system')
           RETURNING id`,
					[
						integrationid,
						`DB Context: ${integrationname}`,
						`Automatically generated database context analysis for ${integrationname}`,
					],
				)

				sourceid = newsource.rows[0].id
			}

			// 2. Soft-delete existing chunks for this source
			await client.query(
				`UPDATE public.knowledgechunks
         SET deletedat = CURRENT_TIMESTAMP
         WHERE sourceid = $1 AND deletedat IS NULL`,
				[sourceid],
			)

			// 3. Batch insert new chunks
			const valueclauses: string[] = []
			const insertparams: unknown[] = []
			let paramindex = 1

			for (const emb of embeddings) {
				valueclauses.push(
					`($${paramindex}, $${paramindex + 1}, $${paramindex + 2}, $${paramindex + 3}, $${paramindex + 4}, $${paramindex + 5})`,
				)
				insertparams.push(
					sourceid,
					emb.metadata.chunkindex,
					emb.metadata.totalchunks,
					emb.metadata.text,
					`[${emb.vector.join(",")}]`, // pgvector text representation
					JSON.stringify(emb.metadata),
				)
				paramindex += 6
			}

			await client.query(
				`INSERT INTO public.knowledgechunks
           (sourceid, chunkindex, totalchunks, content, embedding, metadata)
         VALUES ${valueclauses.join(", ")}`,
				insertparams,
			)

			// 4. Update source status to ready
			await client.query(
				`UPDATE public.knowledgesources
         SET status = 'ready', updatedat = CURRENT_TIMESTAMP
         WHERE id = $1`,
				[sourceid],
			)

			await client.query("COMMIT")

			return NextResponse.json({
				success: true,
				stored: embeddings.length,
			})
		} catch (txerror) {
			await client.query("ROLLBACK")
			throw txerror
		} finally {
			client.release()
		}
	} catch (error) {
		return NextResponse.json({ error: `Failed to store embeddings: ${(error as Error).message}` }, { status: 500 })
	}
}
