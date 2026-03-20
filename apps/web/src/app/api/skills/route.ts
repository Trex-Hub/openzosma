import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { agentSkillQueries } from "@openzosma/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET() {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const skills = await agentSkillQueries.listSkills(pool)
	return NextResponse.json(skills)
}

export async function POST(req: NextRequest) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const body = await req.json()
	const { name, description, content } = body

	if (!name || !content) {
		return NextResponse.json({ error: "name and content are required" }, { status: 400 })
	}

	const skill = await agentSkillQueries.createSkill(pool, { name, description, content })
	return NextResponse.json(skill, { status: 201 })
}
