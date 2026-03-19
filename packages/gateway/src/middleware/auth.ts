import type { MiddlewareHandler } from "hono"
import type { Pool } from "@openzosma/db"
import type { Auth } from "@openzosma/auth"
import { validateApiKey } from "@openzosma/auth"

/**
 * Auth middleware for /api/v1/* routes.
 *
 * Supports two auth schemes checked in order:
 *  1. API key — `Authorization: Bearer ozk_*`. Validated via SHA-256 hash
 *     lookup. If the header is present and starts with `ozk_` but is invalid,
 *     the request is rejected immediately (no fallback to session cookie).
 *  2. Better Auth session cookie — parsed by Better Auth's `getSession`.
 *
 * On success, sets context variables:
 *  - `userId` (string)      — set when authenticated via session cookie
 *  - `apiKeyId` (string)    — set when authenticated via API key
 *  - `apiKeyScopes` (string[]) — scopes granted to the API key
 */
export function createAuthMiddleware(auth: Auth, pool: Pool): MiddlewareHandler {
	return async (c, next) => {
		const authHeader = c.req.header("Authorization")

		if (authHeader) {
			const token = authHeader.replace(/^Bearer\s+/i, "")

			if (token.startsWith("ozk_")) {
				const result = await validateApiKey(pool, token)
				if (result.valid) {
					c.set("apiKeyId", result.keyId)
					c.set("apiKeyScopes", result.scopes)
					return next()
				}
				return c.json({ error: { code: "INVALID_API_KEY", message: "Invalid or expired API key" } }, 401)
			}
		}

		const session = await auth.api.getSession({ headers: c.req.raw.headers })
		if (session) {
			c.set("userId", session.user.id)
			return next()
		}

		return c.json({ error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, 401)
	}
}
