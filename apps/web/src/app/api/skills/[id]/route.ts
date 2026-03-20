import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { agentSkillQueries } from "@openzosma/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	const skill = await agentSkillQueries.getSkill(pool, id)
	if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 })
	return NextResponse.json(skill)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	const body = await req.json()
	const skill = await agentSkillQueries.updateSkill(pool, id, body)
	if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 })
	return NextResponse.json(skill)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	await agentSkillQueries.deleteSkill(pool, id)
	return NextResponse.json({ ok: true })
}
