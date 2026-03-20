---
applyTo: "**"
---

# OpenZosma Code Review Instructions

You are reviewing pull requests for OpenZosma, a self-hosted AI agent platform. Apply these rules strictly.

## Project Context

- **Monorepo** managed with pnpm workspaces and Turborepo
- **Runtime:** Node.js 22, TypeScript throughout
- **Packages:** `packages/gateway`, `packages/orchestrator`, `packages/agents`, `packages/db`, `packages/auth`, `packages/sandbox`, `packages/a2a`, `packages/grpc`, `packages/sdk`, `packages/adapters/*`, `packages/skills/*`
- **Apps:** `apps/web` (Next.js 16, React 19, Tailwind v4), `apps/mobile` (planned)
- **Database:** PostgreSQL with raw SQL via `pg` driver. No ORM. Migrations via `db-migrate` in `packages/db/`
- **Auth:** better-auth with email+password and Google social only
- **Linter/Formatter:** Biome (tabs, 120 line width, double quotes, semicolons only as needed)
- **Self-hosted, single-tenant:** No `tenant_id` columns. One instance = one organization.

## Code Quality Rules

### TypeScript

- **No `any` types** unless absolutely necessary. If used, require a comment explaining why.
- **No inline imports.** No `await import("./foo.js")`, no `import("pkg").Type` in type positions. All imports must be standard top-level `import` statements.
- **No global or module-level mutable state.** State should live in class instances or function closures.
- Flag unused variables, parameters, and imports.
- Ensure proper error handling -- no swallowed errors, no empty catch blocks without justification.

### Database

- **Parameterized queries only.** Flag any SQL using string interpolation or template literals for values. Only `$1`, `$2`, etc. are acceptable.
- **No ORM patterns.** All database access must use raw SQL via the `pg` driver.
- **Migrations must use `db-migrate` format** (JS boilerplate + `sqls/` folder with `-up.sql` and `-down.sql`).
- Migration SQL files must include both up and down scripts. Flag migrations that cannot be rolled back.
- Check that new tables or columns follow existing naming conventions: gateway tables use `snake_case`, web app tables use `flatcase`.

### Security

- **No secrets in code.** Flag hardcoded API keys, passwords, tokens, or connection strings.
- **No committing `.env` files.** Only `.env.example` should be committed.
- Flag any use of `eval()`, `Function()`, or other dynamic code execution.
- SQL injection: ensure all user input is parameterized, never interpolated.
- Check that auth middleware is applied to protected routes.

### Formatting and Style

- Biome handles formatting. If formatting issues appear in the diff, the author should run `pnpm run lint:fix`.
- Double quotes for strings, tabs for indentation, 120 character line width.
- Semicolons only as needed (ASI-safe style).
- Imports should be organized (Biome `organizeImports` is enabled).

## Code Correctness and Reliability

- Flag suspicious or incorrect logic even if it compiles.
- Check async correctness:
  - Missing `await` on async calls.
  - Unhandled promises (floating promises without `void` or `.catch()`).
  - Misuse of `Promise.all` (e.g., independent promises that should be concurrent but are awaited sequentially, or dependent promises incorrectly parallelized).
- Ensure edge cases are handled: `null`, `undefined`, empty arrays, empty strings, missing optional fields.
- Identify potential race conditions or shared-state issues, especially in WebSocket handlers and session management.
- Check for off-by-one errors, incorrect boolean logic, and unreachable code paths.

## Performance

- Flag N+1 query patterns. If a loop issues one query per iteration, suggest batching.
- Avoid repeated database or API calls inside loops -- fetch once, then process in memory.
- Highlight blocking or synchronous operations in critical paths (e.g., synchronous file I/O in request handlers).
- Flag unnecessary re-renders in React components: missing `useMemo`, `useCallback`, or stable references in dependency arrays.
- Check for unbounded data fetching -- queries without `LIMIT`, streams without backpressure, or responses that grow with data size.

## Architecture Rules

### Package Boundaries

- Packages must not import from other packages' internal files. Only use the public API exported from each package's `index.ts`.
- `apps/web` must not import directly from `packages/gateway` internals. Communication goes through HTTP/WebSocket.
- `packages/agents` defines the `AgentProvider`/`AgentSession` interfaces. Agent implementations must conform to these interfaces.

### No Next.js API Routes for Critical Backend Logic

- Next.js API routes in `apps/web` are acceptable for BFF (backend-for-frontend) patterns: auth, proxying, data formatting.
- Core business logic, agent orchestration, and session management must live in `packages/`.

### Database Schema

- Two schemas: `auth` (managed by better-auth CLI) and `public` (managed by db-migrate).
- Never modify `auth` schema tables directly. Use the better-auth CLI.
- New `public` schema migrations go in `packages/db/migrations/` with timestamp-based names.

## PR Review Checklist

When reviewing, verify:

1. **Type safety:** No new `any` types. No type assertions (`as`) without justification.
2. **No inline imports:** All imports are top-level.
3. **SQL safety:** All queries use parameterized values.
4. **Error handling:** Errors are caught and handled meaningfully, not swallowed.
5. **No secrets:** No hardcoded credentials, keys, or connection strings.
6. **Async correctness:** No missing `await`, no floating promises, no `Promise.all` misuse.
7. **Performance:** No N+1 queries, no repeated DB calls in loops, no blocking I/O in hot paths.
8. **Tests:** New functionality has corresponding tests, or the PR explains why tests are not applicable.
9. **Migrations:** If schema changes are included, both up and down SQL files exist and are correct.
10. **Package boundaries:** No cross-package internal imports.
11. **Naming conventions:** Files, variables, and database columns follow existing conventions.
12. **Commit messages:** Follow `type(scope): description` format. Include `fixes #N` or `closes #N` when applicable.

## Review Tone

- Be direct and technical. No filler or praise.
- Flag issues with specific line references and concrete suggestions.
- Distinguish between blocking issues (must fix) and suggestions (nice to have).
- If something looks intentional but unusual, ask for clarification rather than assuming it is wrong.
