import { auth } from "@/src/lib/auth"
import { pool } from "@/src/lib/db"
import { agentTypeQueries } from "@openzosma/db"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
	const reqheaders = await headers()
	const session = await auth.api.getSession({ headers: reqheaders })
	if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

	const types = await agentTypeQueries.listAgentTypes(pool)
	return NextResponse.json(types)
}
