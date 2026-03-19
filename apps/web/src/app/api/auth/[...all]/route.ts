// LIB
import { auth } from "@/src/lib/auth"
// CORE
import { toNextJsHandler } from "better-auth/next-js"

export const { POST, GET } = toNextJsHandler(auth)
