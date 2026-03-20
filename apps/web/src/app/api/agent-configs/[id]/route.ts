import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { agentConfigQueries } from "@openzosma/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	const config = await agentConfigQueries.getAgentConfig(pool, id)
	if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 })
	return NextResponse.json(config)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	const body = await req.json()
	const config = await agentConfigQueries.updateAgentConfig(pool, id, body)
	if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 })
	return NextResponse.json(config)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	await agentConfigQueries.deleteAgentConfig(pool, id)
	return NextResponse.json({ ok: true })
}
