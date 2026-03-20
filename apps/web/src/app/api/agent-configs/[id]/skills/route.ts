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
	const skills = await agentSkillQueries.getSkillsForConfig(pool, id)
	return NextResponse.json(skills)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const { id } = await params
	const body = await req.json()
	if (!Array.isArray(body.skillIds)) {
		return NextResponse.json({ error: "skillIds array required" }, { status: 400 })
	}
	await agentSkillQueries.setConfigSkills(pool, id, body.skillIds)
	return NextResponse.json({ ok: true })
}
