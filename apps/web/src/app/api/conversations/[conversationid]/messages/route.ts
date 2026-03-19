import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// GET /api/conversations/[conversationid]/messages?limit=50&before=uuid
export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationid: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { conversationid } = await params
	const limit = Number.parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)
	const before = req.nextUrl.searchParams.get("before")

	let query = `
    SELECT m.id, m.sendertype, m.senderid, m.content, m.metadata, m.createdat,
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
  `

	const queryparams: (string | number)[] = [conversationid]

	if (before) {
		query += ` AND m.createdat < (SELECT createdat FROM public.messages WHERE id = $${queryparams.length + 1})`
		queryparams.push(before)
	}

	query += " GROUP BY m.id, m.sendertype, m.senderid, m.content, m.metadata, m.createdat"
	query += " ORDER BY m.createdat ASC"
	query += ` LIMIT $${queryparams.length + 1}`
	queryparams.push(limit)

	const result = await pool.query(query, queryparams)

	return NextResponse.json({ messages: result.rows })
}

// POST /api/conversations/[conversationid]/messages
export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationid: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { conversationid } = await params
	const body = await req.json()
	const { sendertype, senderid, content, metadata, attachments } = body

	if (!sendertype || !senderid) {
		return NextResponse.json({ error: "sendertype and senderid are required" }, { status: 400 })
	}

	// Insert message
	const msgresult = await pool.query(
		`INSERT INTO public.messages (conversationid, sendertype, senderid, content, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, sendertype, senderid, content, metadata, createdat`,
		[conversationid, sendertype, senderid, content || "", metadata || {}],
	)

	const message = msgresult.rows[0]

	// Insert attachments if any
	if (attachments && Array.isArray(attachments) && attachments.length > 0) {
		for (const att of attachments) {
			await pool.query(
				`INSERT INTO public.messageattachments (messageid, type, filename, mediatype, url, sizebytes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					message.id,
					att.type || "file",
					att.filename || null,
					att.mediatype || null,
					att.url || null,
					att.sizebytes || null,
					att.metadata || {},
				],
			)
		}
	}

	// Update conversation updatedat
	await pool.query("UPDATE public.conversations SET updatedat = CURRENT_TIMESTAMP WHERE id = $1", [conversationid])

	return NextResponse.json({ message }, { status: 201 })
}
