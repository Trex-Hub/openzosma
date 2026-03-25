# Testing Auth — End-to-End Verification

Manual verification steps for the Better Auth + RBAC + API key auth implementation per Phase 3 spec.

## Prerequisites

```bash
# 1. Start infrastructure
docker compose up -d postgres

# 2. Run migrations (creates public schema tables)
pnpm db:migrate

# 3. Run Better Auth migration (creates auth schema tables: users, sessions, accounts, etc.)
cd packages/db && npx tsx src/migrate-auth.ts

# 4. Start the gateway (with DB so auth is wired in)
cd packages/gateway && npx tsx src/index.ts
```

Confirm the gateway logs `Gateway listening on 0.0.0.0:4000` and does NOT say `Sandbox mode: local` without also creating the auth instance (you should see no auth-related errors).

---

## 1. Public Routes (No Auth Required)

These should work without any credentials.

```bash
# Health check
curl http://localhost:4000/health
# Expected: {"status":"ok"}

# Agent Card
curl http://localhost:4000/.well-known/agent.json
# Expected: JSON agent card
```

---

## 2. Unauthenticated Requests Rejected

All `/api/v1/*` routes must return 401 without credentials.

```bash
curl -s http://localhost:4000/api/v1/sessions | jq
# Expected: {"error":{"code":"AUTH_REQUIRED","message":"Authentication required"}}

curl -s http://localhost:4000/api/v1/agents | jq
# Expected: {"error":{"code":"AUTH_REQUIRED","message":"Authentication required"}}

curl -s http://localhost:4000/api/v1/api-keys | jq
# Expected: {"error":{"code":"AUTH_REQUIRED","message":"Authentication required"}}
```

---

## 3. Better Auth — Sign Up & Sign In

### 3a. Sign up a new user (email/password)

```bash
curl -s -X POST http://localhost:4000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"testpass123","name":"Admin User"}' | jq
# Expected: user object with id, email, name
```

### 3b. Sign in and capture the session cookie

```bash
curl -s -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@test.com","password":"testpass123"}' | jq
# Expected: session + user object. Cookie saved to cookies.txt
```

### 3c. Get session (verify cookie works)

```bash
curl -s http://localhost:4000/api/auth/session -b cookies.txt | jq
# Expected: {"session":{...},"user":{"id":"...","email":"admin@test.com",...}}
```

---

## 4. Session Auth — Accessing Protected Routes

Use the session cookie from step 3b.

```bash
# Create a session
curl -s -X POST http://localhost:4000/api/v1/sessions \
  -b cookies.txt | jq
# Expected: 201 with {"id":"...","createdAt":"..."}

# List sessions (GET)
SESSION_ID=<id from above>
curl -s http://localhost:4000/api/v1/sessions/$SESSION_ID \
  -b cookies.txt | jq
# Expected: session details

# Delete session
curl -s -X DELETE http://localhost:4000/api/v1/sessions/$SESSION_ID \
  -b cookies.txt | jq
# Expected: {"ok":true}
```

---

## 5. RBAC Enforcement

### 5a. Set user role to "member" in the database

```bash
psql $DATABASE_URL -c "UPDATE auth.users SET role = 'member' WHERE email = 'admin@test.com';"
```

Re-sign in to get a fresh session:

```bash
curl -s -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@test.com","password":"testpass123"}' > /dev/null
```

### 5b. Member can create/read sessions

```bash
curl -s -X POST http://localhost:4000/api/v1/sessions -b cookies.txt | jq
# Expected: 201 (member has sessions:write)

curl -s http://localhost:4000/api/v1/agents -b cookies.txt | jq
# Expected: 200 (member has agent_configs:read)
```

### 5c. Member cannot delete sessions

```bash
SESSION_ID=<id from above>
curl -s -X DELETE http://localhost:4000/api/v1/sessions/$SESSION_ID \
  -b cookies.txt | jq
# Expected: 403 {"error":{"code":"FORBIDDEN","message":"Insufficient permissions for sessions:delete"}}
```

### 5d. Member cannot manage API keys

```bash
curl -s http://localhost:4000/api/v1/api-keys -b cookies.txt | jq
# Expected: 403 {"error":{"code":"FORBIDDEN","message":"Insufficient permissions for api_keys:read"}}

curl -s -X POST http://localhost:4000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"test"}' | jq
# Expected: 403 {"error":{"code":"FORBIDDEN","message":"Insufficient permissions for api_keys:write"}}
```

### 5e. Promote to admin and verify full access

```bash
psql $DATABASE_URL -c "UPDATE auth.users SET role = 'admin' WHERE email = 'admin@test.com';"
```

Re-sign in, then:

```bash
curl -s -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@test.com","password":"testpass123"}' > /dev/null

# Admin can manage API keys
curl -s http://localhost:4000/api/v1/api-keys -b cookies.txt | jq
# Expected: 200 {"keys":[...]}

# Admin can delete sessions
curl -s -X DELETE http://localhost:4000/api/v1/sessions/$SESSION_ID \
  -b cookies.txt | jq
# Expected: 200 {"ok":true}
```

---

## 6. API Key Auth

### 6a. Create an API key (as admin)

```bash
curl -s -X POST http://localhost:4000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"test-key","scopes":["sessions:read","sessions:write"]}' | jq
# Expected: 201 {"id":"...","key":"ozk_..."}
# SAVE the key value — it is only shown once.
```

```bash
API_KEY=<ozk_... from above>
```

### 6b. API key authenticates successfully

```bash
curl -s -X POST http://localhost:4000/api/v1/sessions \
  -H "Authorization: Bearer $API_KEY" | jq
# Expected: 201 (sessions:write scope is present)

curl -s http://localhost:4000/api/v1/sessions/<id> \
  -H "Authorization: Bearer $API_KEY" | jq
# Expected: 200 (sessions:read scope is present)
```

### 6c. Scope enforcement — missing scope is rejected

```bash
# The key only has sessions:read and sessions:write — not sessions:delete
curl -s -X DELETE http://localhost:4000/api/v1/sessions/<id> \
  -H "Authorization: Bearer $API_KEY" | jq
# Expected: 403 {"error":{"code":"FORBIDDEN","message":"API key missing required scope: sessions:delete"}}

# The key has no agent_configs scope
curl -s http://localhost:4000/api/v1/agents \
  -H "Authorization: Bearer $API_KEY" | jq
# Expected: 403 {"error":{"code":"FORBIDDEN","message":"API key missing required scope: agent_configs:read"}}
```

### 6d. Invalid API key is rejected

```bash
curl -s http://localhost:4000/api/v1/sessions \
  -H "Authorization: Bearer ozk_invalid_key_here" | jq
# Expected: 401 {"error":{"code":"INVALID_API_KEY","message":"Invalid or expired API key"}}
```

### 6e. Create a key with all scopes

```bash
curl -s -X POST http://localhost:4000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"full-access","scopes":["sessions:read","sessions:write","sessions:delete","agent_configs:read","api_keys:read","api_keys:write","api_keys:delete","usage:read"]}' | jq
# Use this key to verify all routes are accessible with full scopes.
```

---

## 7. API Key Lifecycle

```bash
# List all keys (as admin via cookie)
curl -s http://localhost:4000/api/v1/api-keys -b cookies.txt | jq
# Expected: list of keys with id, name, keyPrefix, scopes, lastUsedAt

# Delete a key
KEY_ID=<id from list>
curl -s -X DELETE http://localhost:4000/api/v1/api-keys/$KEY_ID \
  -b cookies.txt | jq
# Expected: {"ok":true}

# Verify deleted key no longer works
curl -s http://localhost:4000/api/v1/sessions \
  -H "Authorization: Bearer $API_KEY" | jq
# Expected: 401 INVALID_API_KEY
```

---

## 8. Sign Out

```bash
curl -s -X POST http://localhost:4000/api/auth/sign-out -b cookies.txt | jq
# Expected: success

# Session cookie should no longer work
curl -s http://localhost:4000/api/v1/sessions -b cookies.txt | jq
# Expected: 401 AUTH_REQUIRED
```

---

## Phase 3 Auth Checklist

| Requirement | Spec Reference | How to Verify |
|---|---|---|
| Better Auth routes at `/api/auth/*` | PHASE-3 lines 94-101 | Steps 3a-3c |
| Auth middleware on `/api/v1/*` | PHASE-3 line 347 | Step 2 |
| Session cookie auth | PHASE-3 line 347 | Step 4 |
| API key auth (`ozk_*` prefix) | PHASE-3 lines 103-113 | Step 6 |
| Invalid API key → 401 | PHASE-3 line 375 | Step 6d |
| RBAC (admin vs member) | PHASE-3 line 375 | Step 5 |
| `FORBIDDEN` error code | PHASE-3 line 375 | Steps 5c, 5d, 6c |
| API key scope enforcement | PHASE-3 lines 103-113 | Step 6c |
| API key CRUD routes | PHASE-3 lines 103-113 | Steps 6a, 7 |
| Sign out invalidates session | PHASE-3 line 99 | Step 8 |
