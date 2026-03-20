import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { agentConfigQueries } from "@openzosma/db"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET() {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const configs = await agentConfigQueries.listAgentConfigs(pool)
	return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const body = await req.json()
	const { agentTypeId, name, description, systemPrompt, config, isDefault } = body

	if (!agentTypeId || !name) {
		return NextResponse.json({ error: "agentTypeId and name are required" }, { status: 400 })
	}

	const agentConfig = await agentConfigQueries.createAgentConfig(pool, {
		agentTypeId,
		name,
		description,
		systemPrompt,
		config,
		isDefault,
	})

	return NextResponse.json(agentConfig, { status: 201 })
}
