import { format } from "date-fns"

export const DATABASE_URL: string =
	process.env.DATABASE_URL ?? "postgresql://openzosma:openzosma@localhost:5432/openzosma"

export const BASE_URL: string = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"

export const LAST_LEGAL_UPDATE_DATE: string = format(new Date(2025, 10, 27), "MMMM d, yyyy")

export const IS_DEV = process.env.NODE_ENV === "development"

export const GATEWAY_URL: string = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000"
