import { BASE_URL, DATABASE_URL } from "@/src/lib/constants"
import { betterAuth } from "better-auth"
import { Pool } from "pg"

export const auth = betterAuth({
	baseURL: BASE_URL,
	trustedOrigins: [BASE_URL],
	database: new Pool({
		connectionString: DATABASE_URL,
		options: "-c search_path=auth,public",
	}),
	user: {
		modelName: "users",
		fields: {
			emailVerified: "emailverified",
			createdAt: "createdat",
			updatedAt: "updatedat",
		},
	},
	session: {
		modelName: "sessions",
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
		modelName: "accounts",
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
		modelName: "verifications",
		fields: {
			expiresAt: "expiresat",
			createdAt: "createdat",
			updatedAt: "updatedat",
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: {
		google: {
			prompt: "select_account",
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
})
