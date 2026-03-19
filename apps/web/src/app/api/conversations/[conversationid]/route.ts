import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// GET /api/conversations/[conversationid]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ conversationid: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { conversationid } = await params

	// Get conversation
	const convresult = await pool.query(
		`SELECT id, title, createdby, createdat, updatedat
     FROM public.conversations
     WHERE id = $1 AND deletedat IS NULL`,
		[conversationid],
	)

	if (convresult.rows.length === 0) {
		return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
	}

	// Get participants
	const participantsresult = await pool.query(
		`SELECT id, participanttype, participantid, participantname, joinedat
     FROM public.conversationparticipants
     WHERE conversationid = $1 AND deletedat IS NULL`,
		[conversationid],
	)

	// Get messages with attachments
	const messagesresult = await pool.query(
		`SELECT m.id, m.sendertype, m.senderid, m.content, m.metadata, m.createdat,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ma.id,
                  'type', ma.type,
                  'filename', ma.filename,
                  'mediatype', ma.mediatype,
                  'url', ma.url,
                  'sizebytes', ma.sizebytes,
                  'metadata', ma.metadata
                )
              ) FILTER (WHERE ma.id IS NOT NULL),
              '[]'
            ) as attachments
     FROM public.messages m
     LEFT JOIN public.messageattachments ma ON ma.messageid = m.id AND ma.deletedat IS NULL
     WHERE m.conversationid = $1 AND m.deletedat IS NULL
     GROUP BY m.id, m.sendertype, m.senderid, m.content, m.metadata, m.createdat
     ORDER BY m.createdat ASC`,
		[conversationid],
	)

	return NextResponse.json({
		conversation: convresult.rows[0],
		participants: participantsresult.rows,
		messages: messagesresult.rows,
	})
}

// DELETE /api/conversations/[conversationid] (soft delete)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ conversationid: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { conversationid } = await params

	await pool.query("UPDATE public.conversations SET deletedat = CURRENT_TIMESTAMP WHERE id = $1", [conversationid])

	return NextResponse.json({ success: true })
}
