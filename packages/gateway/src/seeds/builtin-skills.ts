import { agentSkillQueries } from "@openzosma/db"
import type pg from "pg"

const BUILTIN_SKILLS = [
	{
		name: "Code Review",
		description: "Security, performance, and error handling checklist for code review",
		content: `When reviewing code, systematically check the following:

**Security**
- No hardcoded secrets, API keys, or passwords
- Input is validated and sanitized at system boundaries
- SQL queries use parameterized statements — never string concatenation
- Authentication and authorization checks are present and correct
- Sensitive data is not logged

**Performance**
- No N+1 query patterns — use joins or batch queries
- Expensive operations are not inside loops
- Indexes exist for queried columns
- Pagination is used for large result sets

**Error Handling**
- All errors are caught and handled appropriately
- Error messages don't expose internal implementation details
- Resources (connections, file handles) are released in all code paths

**Code Quality**
- Functions do one thing and are appropriately sized
- Variable and function names are clear and descriptive
- No dead code or commented-out blocks
- Tests cover the happy path and key edge cases

Provide specific line references for each finding.`,
	},
	{
		name: "SQL Expert",
		description: "Best practices for writing safe, efficient SQL queries",
		content: `Apply these SQL best practices in all database work:

**Safety**
- Always use parameterized queries / prepared statements — never interpolate user input
- Validate and cast types before use in queries
- Use transactions for multi-statement operations that must be atomic

**Performance**
- Add WHERE clauses to avoid full table scans
- Use EXPLAIN / EXPLAIN ANALYZE to verify query plans on large tables
- Prefer JOINs over correlated subqueries for repeated lookups
- Use CTEs (WITH clauses) for readability on complex queries
- Apply LIMIT when the full result set is not needed
- Index columns used in WHERE, JOIN ON, and ORDER BY

**Correctness**
- Be explicit about NULL handling — use IS NULL / IS NOT NULL, not = NULL
- Use COALESCE or NULLIF for safe default values
- Prefer COUNT(*) over COUNT(column) unless NULL exclusion is intentional
- Use RETURNING for getting inserted/updated values without a second query

**Postgres-specific**
- Use gen_random_uuid() for UUID primary keys
- Use TIMESTAMPTZ (not TIMESTAMP) for all timestamps
- Use JSONB (not JSON) for document columns
- Use ON CONFLICT DO UPDATE for upserts`,
	},
	{
		name: "Documentation Writer",
		description: "Structure and clarity standards for technical documentation",
		content: `When writing documentation, follow these principles:

**Structure**
- Start with a one-sentence summary of what this thing does
- Follow with a short "Why / When to use" section for non-obvious components
- Document parameters, return values, and thrown errors
- Include at least one usage example for every public API

**Clarity**
- Write for the reader who will use this in 6 months — including yourself
- Explain the "why" behind non-obvious decisions, not just the "what"
- Use active voice: "Creates a pool" not "A pool is created"
- Avoid jargon; if you must use it, define it on first use

**API Documentation**
- Document every public function, class, and type
- For each parameter: name, type, whether required, default value, constraints
- Document side effects (writes to disk, sends network requests, mutates state)
- Note thread-safety or concurrency assumptions

**Examples**
- Show the simplest possible working example first
- Add a more complex example that shows common real-world use
- Make examples runnable — avoid pseudo-code unless illustrating a concept`,
	},
	{
		name: "Debug Assistant",
		description: "Systematic debugging loop: reproduce → isolate → hypothesize → verify",
		content: `Follow this systematic debugging process:

**1. Reproduce reliably**
- Write the exact steps to reproduce the bug before touching any code
- If you can't reproduce it, you can't fix it
- Capture the exact error message, stack trace, and environment

**2. Isolate the scope**
- Identify the smallest possible code path that triggers the bug
- Use binary search: disable half the code, see if the bug persists
- Check if the bug is environment-specific (dev vs prod, OS, Node version)
- Check recent git changes that could have introduced the regression

**3. Form a hypothesis**
- State a specific, falsifiable hypothesis: "I think X causes Y because Z"
- List the assumptions behind the hypothesis
- Identify the simplest test that would disprove it

**4. Verify and fix**
- Test the hypothesis with a minimal reproduction case
- Fix the root cause, not the symptom
- Add a test that would have caught this bug
- Check if the same bug pattern exists elsewhere in the codebase

**Communication**
- Share the reproduction steps, hypothesis, and fix clearly
- Note any related code that may have the same issue`,
	},
	{
		name: "Security Reviewer",
		description: "OWASP top 10, injection, auth, and secrets review checklist",
		content: `Security review checklist — check each category:

**Injection (OWASP A03)**
- SQL: parameterized queries everywhere, no string interpolation
- Command injection: avoid shell=true / exec with user input; use argument arrays
- XSS: all user-controlled data is escaped before rendering in HTML
- Path traversal: file paths are validated and sandboxed

**Authentication & Authorization (OWASP A01, A07)**
- Authentication is enforced on every protected endpoint
- Authorization checks verify the authenticated user owns/can access the resource
- Passwords are hashed with bcrypt/argon2/scrypt — never stored in plaintext
- Session tokens are cryptographically random and have appropriate expiry
- Sensitive operations require re-authentication

**Cryptography (OWASP A02)**
- TLS is enforced for all connections
- Modern algorithms only: AES-256, RSA-2048+, SHA-256+
- No MD5 or SHA-1 for security-sensitive operations
- Keys and secrets are rotated and revocable

**Secrets & Configuration (OWASP A05)**
- No secrets in source code, config files committed to git, or logs
- Secrets are loaded from environment variables or a secrets manager
- .env files are in .gitignore
- Dependencies are audited for known vulnerabilities (npm audit, etc.)

**Error Handling & Logging (OWASP A09)**
- Error messages don't expose stack traces or internal paths to users
- Sensitive data (passwords, tokens, PII) is never logged
- Failed authentication attempts are logged with rate limiting`,
	},
]

export async function seedBuiltinSkills(pool: pg.Pool): Promise<void> {
	const existing = await agentSkillQueries.listSkills(pool)
	const existingBuiltinNames = new Set(existing.filter((s) => s.isBuiltin).map((s) => s.name))

	for (const skill of BUILTIN_SKILLS) {
		if (!existingBuiltinNames.has(skill.name)) {
			await agentSkillQueries.createSkill(pool, { ...skill, isBuiltin: true })
			console.log(`Seeded built-in skill: ${skill.name}`)
		}
	}
}
