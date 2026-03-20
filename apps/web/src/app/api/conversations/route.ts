import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// GET /api/conversations
export async function GET(req: NextRequest) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const result = await pool.query(
		`SELECT c.id, c.title, c.createdby, c.createdat, c.updatedat, c.agent_config_id,
            (SELECT content FROM public.messages m
             WHERE m.conversationid = c.id AND m.deletedat IS NULL
             ORDER BY m.createdat DESC LIMIT 1) as lastmessage,
            (SELECT COUNT(*) FROM public.messages m
             WHERE m.conversationid = c.id AND m.deletedat IS NULL)::int as messagecount
     FROM public.conversations c
     WHERE c.deletedat IS NULL
     ORDER BY c.updatedat DESC`,
	)

	return NextResponse.json({ conversations: result.rows })
}

// POST /api/conversations
export async function POST(req: NextRequest) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const body = await req.json()
	const { title, agentConfigId } = body

	const userid = session.user.id
	const username = session.user.name

	// Create conversation, linking to agent config if provided
	const convresult = await pool.query(
		`INSERT INTO public.conversations (title, createdby, agent_config_id)
     VALUES ($1, $2, $3)
     RETURNING id, title, createdby, createdat, updatedat, agent_config_id`,
		[title || "New Conversation", userid, agentConfigId ?? null],
	)

	const conversation = convresult.rows[0]

	// Add human participant
	await pool.query(
		`INSERT INTO public.conversationparticipants (conversationid, participanttype, participantid, participantname)
     VALUES ($1, 'human', $2, $3)`,
		[conversation.id, userid, username],
	)

	// Agent participant: required so the chat UI opens the gateway WebSocket (see chat-view).
	let agentParticipantId = "openzosma-agent"
	let agentParticipantName = "Agent"
	if (agentConfigId) {
		const cfg = await pool.query<{ id: string; name: string }>(
			`SELECT id, name FROM public.agent_configs WHERE id = $1`,
			[agentConfigId],
		)
		if (cfg.rows[0]) {
			agentParticipantId = cfg.rows[0].id
			agentParticipantName = cfg.rows[0].name
		}
	}
	await pool.query(
		`INSERT INTO public.conversationparticipants (conversationid, participanttype, participantid, participantname)
     VALUES ($1, 'agent', $2, $3)`,
		[conversation.id, agentParticipantId, agentParticipantName],
	)

	return NextResponse.json({ conversation }, { status: 201 })
}
