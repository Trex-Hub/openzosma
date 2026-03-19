// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { pool } from "@/src/lib/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// ─── DELETE ────────────────────────────────────────────────────────────────────
// Soft-deletes all embeddings (knowledgechunks) and their parent knowledgesource
// for a given integration.
//
// DELETE /api/integrations/[integrationid]/embeddings

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ integrationid: string }> }) {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { integrationid } = await params

	const client = await pool.connect()

	try {
		await client.query("BEGIN")

		// 1. Find all knowledge sources for this integration
		const sourcesresult = await client.query(
			`SELECT id FROM public.knowledgesources
       WHERE integrationid = $1
         AND deletedat IS NULL`,
			[integrationid],
		)

		const sourceids = sourcesresult.rows.map((r: { id: string }) => r.id)

		let chunkcount = 0

		if (sourceids.length > 0) {
			// 2. Soft-delete all chunks belonging to those sources
			const chunksresult = await client.query(
				`UPDATE public.knowledgechunks
         SET deletedat = CURRENT_TIMESTAMP
         WHERE sourceid = ANY($1::uuid[])
           AND deletedat IS NULL`,
				[sourceids],
			)

			chunkcount = chunksresult.rowCount ?? 0

			// 3. Soft-delete the knowledge sources themselves
			await client.query(
				`UPDATE public.knowledgesources
         SET deletedat = CURRENT_TIMESTAMP, updatedat = CURRENT_TIMESTAMP
         WHERE id = ANY($1::uuid[])
           AND deletedat IS NULL`,
				[sourceids],
			)
		}

		await client.query("COMMIT")

		return NextResponse.json({
			success: true,
			deleted: {
				sources: sourceids.length,
				chunks: chunkcount,
			},
		})
	} catch (error) {
		await client.query("ROLLBACK")
		return NextResponse.json({ error: `Failed to clear embeddings: ${(error as Error).message}` }, { status: 500 })
	} finally {
		client.release()
	}
}
