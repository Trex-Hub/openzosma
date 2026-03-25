import { betterAuth } from "better-auth"
import pg from "pg"

export interface AuthConfig {
	dbPool: pg.Pool
	secret: string
	baseUrl: string
	github?: {
		clientId: string
		clientSecret: string
	}
	google?: {
		clientId: string
		clientSecret: string
	}
	sessionExpiresIn?: number
	sessionUpdateAge?: number
}

/**
 * Better Auth field mappings. The Better Auth migration creates columns with
 * all-lowercase names (e.g. "emailverified", "createdat"). These mappings
 * must match the actual column names in the auth schema tables.
 */
const FIELD_MAPPINGS = {
	user: {
		modelName: "users" as const,
		fields: {
			emailVerified: "emailverified",
			createdAt: "createdat",
			updatedAt: "updatedat",
		},
	},
	session: {
		modelName: "sessions" as const,
		fields: {
			expiresAt: "expiresat",
			createdAt: "createdat",
			updatedAt: "updatedat",
			ipAddress: "ipaddress",
			userAgent: "useragent",
			userId: "userid",
		},
	},
	account: {
		modelName: "accounts" as const,
		fields: {
			accountId: "accountid",
			providerId: "providerid",
			userId: "userid",
			accessToken: "accesstoken",
			refreshToken: "refreshtoken",
			idToken: "idtoken",
			accessTokenExpiresAt: "accesstokenexpiresat",
			refreshTokenExpiresAt: "refreshtokenexpiresat",
			createdAt: "createdat",
			updatedAt: "updatedat",
		},
	},
	verification: {
		modelName: "verifications" as const,
		fields: {
			expiresAt: "expiresat",
			createdAt: "createdat",
			updatedAt: "updatedat",
		},
	},
}

export const createAuth = (config: AuthConfig) => {
	const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}

	if (config.github) {
		socialProviders.github = config.github
	}
	if (config.google) {
		socialProviders.google = config.google
	}

	return betterAuth({
		database: config.dbPool,
		baseURL: config.baseUrl,
		secret: config.secret,
		emailAndPassword: { enabled: true },
		socialProviders,
		...FIELD_MAPPINGS,
		session: {
			...FIELD_MAPPINGS.session,
			expiresIn: config.sessionExpiresIn ?? 60 * 60 * 24 * 7,
			updateAge: config.sessionUpdateAge ?? 60 * 60 * 24,
		},
	})
}

/**
 * Create a Better Auth instance from environment variables.
 * Creates a dedicated pg.Pool with search_path=auth,public so that
 * Better Auth can find its tables in the auth schema.
 */
export const createAuthFromEnv = () => {
	const connectionString = process.env.DATABASE_URL
	const poolConfig: pg.PoolConfig = connectionString
		? { connectionString, options: "-c search_path=auth,public" }
		: {
				host: process.env.DB_HOST ?? "localhost",
				port: Number.parseInt(process.env.DB_PORT ?? "5432"),
				database: process.env.DB_NAME ?? "openzosma",
				user: process.env.DB_USER ?? "openzosma",
				password: process.env.DB_PASS ?? "openzosma",
				options: "-c search_path=auth,public",
			}

	const authPool = new pg.Pool(poolConfig)

	return createAuth({
		dbPool: authPool,
		secret: process.env.AUTH_SECRET ?? "change-me-in-production",
		baseUrl: process.env.AUTH_URL ?? "http://localhost:4000",
		github:
			process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
				? {
						clientId: process.env.GITHUB_CLIENT_ID,
						clientSecret: process.env.GITHUB_CLIENT_SECRET,
					}
				: undefined,
		google:
			process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
				? {
						clientId: process.env.GOOGLE_CLIENT_ID,
						clientSecret: process.env.GOOGLE_CLIENT_SECRET,
					}
				: undefined,
	})
}
