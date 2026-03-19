import { Hono } from "hono"
import { cors } from "hono/cors"
import type { Pool } from "@openzosma/db"
import type { SessionManager } from "./session-manager.js"
import { buildAgentCard, createA2ARouter } from "./a2a.js"

export function createApp(sessionManager: SessionManager, pool?: Pool): Hono {
	const app = new Hono()

	app.use(
		"*",
		cors({
			origin: ["http://localhost:3000"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type"],
		}),
	)

	app.get("/health", (c) => c.json({ status: "ok" }))

	// A2A Agent Card — dynamic if pool is available, empty skills fallback otherwise
	app.get("/.well-known/agent.json", async (c) => {
		if (pool) {
			const card = await buildAgentCard(pool)
			return c.json(card)
		}
		return c.json({
			name: "OpenZosma Agent",
			description: "Self-hosted AI agent platform",
			url: `${process.env["PUBLIC_URL"] ?? "http://localhost:4000"}/a2a`,
			version: "1.0.0",
			capabilities: { streaming: true, pushNotifications: true, stateTransitionHistory: true },
			skills: [],
			authentication: { schemes: ["bearer"] },
		})
	})

	// A2A JSON-RPC 2.0 endpoint
	if (pool) {
		app.route("/a2a", createA2ARouter(sessionManager, pool))
	}

	// Create a new session
	app.post("/api/v1/sessions", async (c) => {
		const session = await sessionManager.createSession()
		return c.json({ id: session.id, createdAt: session.createdAt }, 201)
	})

	// Get session details
	app.get("/api/v1/sessions/:id", (c) => {
		const session = sessionManager.getSession(c.req.param("id"))
		if (!session) {
			return c.json({ error: "Session not found" }, 404)
		}
		return c.json({
			id: session.id,
			createdAt: session.createdAt,
			messageCount: session.messages.length,
		})
	})

	// Send a message (non-streaming REST fallback)
	app.post("/api/v1/sessions/:id/messages", async (c) => {
		const session = sessionManager.getSession(c.req.param("id"))
		if (!session) {
			return c.json({ error: "Session not found" }, 404)
		}

		const body = await c.req.json<{ content: string }>()
		if (!body.content) {
			return c.json({ error: "content is required" }, 400)
		}

		const events = []
		for await (const event of sessionManager.sendMessage(c.req.param("id"), body.content)) {
			events.push(event)
		}

		// Collect full response text from message_update events
		const text = events
			.filter((e) => e.type === "message_update" && e.text)
			.map((e) => e.text)
			.join("")

		return c.json({ role: "assistant", content: text })
	})

	// Get messages for a session
	app.get("/api/v1/sessions/:id/messages", (c) => {
		const session = sessionManager.getSession(c.req.param("id"))
		if (!session) {
			return c.json({ error: "Session not found" }, 404)
		}
		return c.json(session.messages)
	})

	return app
}
