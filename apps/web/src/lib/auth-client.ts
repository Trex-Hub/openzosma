import { BASE_URL } from "@/src/lib/constants"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
	baseURL: BASE_URL,
})

export const { signIn, useSession, updateUser, signUp } = authClient
