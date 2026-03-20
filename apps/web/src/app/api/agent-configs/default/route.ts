import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { agentConfigQueries } from "@openzosma/db"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const configs = await agentConfigQueries.listAgentConfigs(pool)
	const defaultConfig = configs.find((c) => c.isDefault) ?? configs[0] ?? null
	return NextResponse.json(defaultConfig)
}
