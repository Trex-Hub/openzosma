import { DATABASE_URL } from "@/src/lib/constants"
import { Pool } from "pg"

/**
 * Shared PostgreSQL connection pool for custom table queries (public schema).
 */
export const pool = new Pool({
	connectionString: DATABASE_URL,
})
