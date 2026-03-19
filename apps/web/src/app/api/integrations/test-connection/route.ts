// AUTH
import { auth } from "@/src/lib/auth"
// LIB
import { type ConnectionConfig, testconnection } from "@/src/lib/db-connectors"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
	// Authenticate
	const session = await auth.api.getSession({
		headers: await headers(),
	})
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { type, host, port, database, username, password, ssl } = body

		if (!type || !host || !port || !database || !username) {
			return NextResponse.json(
				{ error: "Missing required fields: type, host, port, database, username" },
				{ status: 400 },
			)
		}

		const config: ConnectionConfig = {
			host,
			port: Number(port),
			database,
			username,
			password: password ?? "",
			ssl: ssl ?? false,
		}

		const result = await testconnection(type, config)

		return NextResponse.json(result)
	} catch (error) {
		return NextResponse.json({ success: false, message: `Server error: ${(error as Error).message}` }, { status: 500 })
	}
}
