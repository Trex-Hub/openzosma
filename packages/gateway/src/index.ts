import { serve } from "@hono/node-server"
import { WebSocketServer } from "ws"
import { createPool } from "@openzosma/db"
import { createApp } from "./app.js"
import { SessionManager } from "./session-manager.js"
import { handleWebSocket } from "./ws.js"

const PORT = Number(process.env.GATEWAY_PORT) || 4000
const HOST = process.env.GATEWAY_HOST || "0.0.0.0"

// Pool is optional: when DATABASE_URL / DB_* vars are not set (e.g. bare MVP
// dev without Postgres) the gateway still starts and A2A routes return empty skills.
const pool = process.env["DATABASE_URL"] ?? process.env["DB_HOST"] ? createPool() : undefined

const sessionManager = new SessionManager(undefined, pool)
const app = createApp(sessionManager, pool)

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
	console.log(`Gateway listening on ${HOST}:${PORT}`)
})

// Attach WebSocket server using noServer mode
const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (request, socket, head) => {
	if (request.url === "/ws") {
		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit("connection", ws, request)
		})
	} else {
		socket.destroy()
	}
})

wss.on("connection", (ws) => {
	handleWebSocket(ws, sessionManager)
})
