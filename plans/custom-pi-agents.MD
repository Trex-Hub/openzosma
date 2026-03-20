# Custom Pi Agents from Dashboard

> Last updated: 2026-03-20
> Branch: feat/issue-#6

## Goal

Allow users to create, configure, and manage custom pi agents entirely through the OpenZosma dashboard — choosing a model/provider, writing a custom system prompt, toggling tools on/off, and attaching skills — without any code changes or redeployment.

---

## Current State

Everything is hardcoded. Every conversation gets the same agent:


| What          | Where                                                        | Value                              |
| ------------- | ------------------------------------------------------------ | ---------------------------------- |
| Model         | `packages/agents/src/pi/model.ts` → `resolveModel()`         | Auto-detected from env API keys    |
| System prompt | `packages/agents/src/pi/config.ts` → `DEFAULT_SYSTEM_PROMPT` | Hardcoded string                   |
| Tools         | `packages/agents/src/pi/tools.ts` → `createDefaultTools()`   | All 7 tools, always                |
| Skills        | nowhere                                                      | Not implemented                    |
| Agent config  | `packages/gateway/src/session-manager.ts`                    | No config accepted                 |
| Dashboard     | `apps/web/src/components/organisms/chat-sidebar.tsx:54`      | Hardcodes `agentid: "dbchatagent"` |


The DB schema **is** ready. Migration `20260320031353-refactor-agent-configs` created:

- `agent_types` — registry of runtimes (pi-agent seeded)
- `agent_configs` — provider-agnostic config with `config JSONB` blob
- `agent_skills` + `agent_config_skills` — skills system
- `conversations.agent_config_id` — links conversations to their config

The DB query layer is implemented in `packages/db/src/queries/`.

What is missing is everything between the DB and the running agent.

---

## Architecture After This Work

```
Dashboard
  └── POST /api/conversations { agentConfigId }
        └── Next.js API route → stores conversation with agent_config_id
              └── WebSocket message { sessionId, content }
                    └── Gateway ws.ts → session-manager.ts
                          └── Load AgentConfig + Skills from DB
                                └── PiAgentSession(opts with model, systemPrompt, tools, skills)
                                      └── pi-agent-core Agent
```

---

## Phase 1 — Agent Config Passthrough (Backend)

**Files to change**: `packages/agents/src/types.ts`, `packages/agents/src/pi.agent.ts`, `packages/agents/src/pi/model.ts`, `packages/agents/src/pi/tools.ts`, `packages/gateway/src/session-manager.ts`, `packages/gateway/src/ws.ts`, `packages/gateway/src/app.ts`

### 1a. Expand `AgentSessionOpts`

`packages/agents/src/types.ts` — add optional config fields:

```typescript
export interface SkillDefinition {
  name: string
  content: string
}

export interface AgentSessionOpts {
  sessionId: string
  workspaceDir: string

  // All optional — fall back to env/hardcoded defaults when absent
  model?: string
  provider?: string
  systemPrompt?: string
  toolsEnabled?: string[]   // e.g. ["read", "bash", "edit", "write", "grep", "find", "ls"]
  skills?: SkillDefinition[]
  thinkingLevel?: "off" | "low" | "medium" | "high"
  maxTokens?: number
  temperature?: number
}
```

### 1b. Update `PiAgentSession` constructor

`packages/agents/src/pi.agent.ts` — use opts instead of hardcoded values:

```typescript
constructor(opts: AgentSessionOpts) {
  const { model } = resolveModel(opts.provider, opts.model)

  const toolList = buildToolList(opts.workspaceDir, opts.toolsEnabled)

  const basePrompt = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
  const fullPrompt = opts.skills?.length
    ? basePrompt + formatSkillsForPrompt(opts.skills)
    : basePrompt

  this.agent = new Agent({
    initialState: {
      systemPrompt: fullPrompt,
      model,
      thinkingLevel: opts.thinkingLevel ?? "off",
      tools: toolList,
    },
    convertToLlm,
    getApiKey: (provider: string) => getEnvApiKey(provider),
  })
}
```

### 1c. Update `resolveModel()`

`packages/agents/src/pi/model.ts` — accept override params:

```typescript
// Before
export function resolveModel(): { model: Model }

// After
export function resolveModel(providerOverride?: string, modelOverride?: string): { model: Model }
// If both overrides are set, construct the Model directly from them.
// Otherwise fall through to the existing env-var auto-detection logic.
```

### 1d. Add `buildToolList()` to tools.ts

`packages/agents/src/pi/tools.ts` — filter by name:

```typescript
const ALL_TOOL_NAMES = ["read", "bash", "edit", "write", "grep", "find", "ls"] as const
export type ToolName = (typeof ALL_TOOL_NAMES)[number]

export function buildToolList(workspaceDir: string, enabled?: string[]) {
  const all = {
    read:  createReadTool(workspaceDir),
    bash:  createBashTool(workspaceDir),
    edit:  createEditTool(workspaceDir),
    write: createWriteTool(workspaceDir),
    grep:  createGrepTool(workspaceDir),
    find:  createFindTool(workspaceDir),
    ls:    createLsTool(workspaceDir),
  }
  if (!enabled) return Object.values(all)
  return enabled.filter((n): n is ToolName => n in all).map((n) => all[n])
}
```

### 1e. Add `formatSkillsForPrompt()` to agents package

`packages/agents/src/pi/skills.ts` (new file):

```typescript
import type { SkillDefinition } from "../types.js"

function escapeXml(s: string) {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """)
}

export function formatSkillsForPrompt(skills: SkillDefinition[]): string {
  if (skills.length === 0) return ""
  const blocks = skills
    .map((s) => `<skill name="${escapeXml(s.name)}">\n${s.content}\n</skill>`)
    .join("\n\n")
  return `\n\n<skills>\n${blocks}\n</skills>`
}
```

### 1f. Update Gateway: load config before creating session

`packages/gateway/src/session-manager.ts` — inject DB pool, accept config:

```typescript
// SessionManager needs access to the DB to load agent configs.
// Constructor takes an optional Pool.

import type { Pool } from "pg"
import { agentConfigQueries, agentSkillQueries } from "@openzosma/db"

export class SessionManager {
  constructor(
    provider?: AgentProvider,
    private db?: Pool,  // <-- new
  ) { ... }

  async createSession(id?: string, agentConfigId?: string): Promise<Session> {
    // ...existing id dedup logic...

    let agentOpts: AgentSessionOpts = { sessionId: session.id, workspaceDir: sessionDir }

    if (agentConfigId && this.db) {
      const config = await agentConfigQueries.getAgentConfig(this.db, agentConfigId)
      if (config) {
        const skills = await agentSkillQueries.getSkillsForConfig(this.db, agentConfigId)
        const piConfig = config.config as Record<string, unknown>

        agentOpts = {
          ...agentOpts,
          provider:       typeof piConfig.provider === "string" ? piConfig.provider : undefined,
          model:          typeof piConfig.model === "string" ? piConfig.model : undefined,
          toolsEnabled:   Array.isArray(piConfig.tools_enabled) ? piConfig.tools_enabled as string[] : undefined,
          thinkingLevel:  typeof piConfig.thinking_level === "string" ? piConfig.thinking_level as any : undefined,
          systemPrompt:   config.systemPrompt ?? undefined,
          skills:         skills,  // ResolvedSkill[] is compatible with SkillDefinition[]
        }
      }
    }

    const agentSession = this.provider.createSession(agentOpts)
    // ...
  }
}
```

> Note: `createSession` becomes async. Update all callers.

### 1g. Accept `agentConfigId` in WebSocket messages

`packages/gateway/src/ws.ts` — extend the `message` type:

```typescript
// WsClientMessage (in types.ts):
// { type: "message", sessionId: string, content: string, agentConfigId?: string }

if (msg.type === "message") {
  // Pass agentConfigId through to session creation
  await sessionManager.ensureSession(msg.sessionId, msg.agentConfigId)
  void streamResponse(...)
}
```

Add `ensureSession(id, agentConfigId?)` as the async variant of `createSession` for the WS path.

### 1h. Accept `agentConfigId` in REST session creation

`packages/gateway/src/app.ts`:

```typescript
app.post("/api/v1/sessions", async (c) => {
  const body = await c.req.json<{ agentConfigId?: string }>().catch(() => ({}))
  const session = await sessionManager.createSession(undefined, body.agentConfigId)
  return c.json({ id: session.id, createdAt: session.createdAt }, 201)
})
```

---

## Phase 2 — Gateway API for Agent Configs and Skills

**Files to change**: `packages/gateway/src/app.ts`

Add CRUD endpoints so the dashboard can manage agent configs and skills. These proxy directly to the DB query layer.

```
GET    /api/v1/agent-configs                  List all configs
POST   /api/v1/agent-configs                  Create a config
GET    /api/v1/agent-configs/:id              Get a config
PUT    /api/v1/agent-configs/:id              Update a config
DELETE /api/v1/agent-configs/:id              Delete a config

GET    /api/v1/agent-configs/:id/skills       List skills attached to config
PUT    /api/v1/agent-configs/:id/skills       Set skills for config (array of skill IDs)

GET    /api/v1/skills                         List all skills
POST   /api/v1/skills                         Create a skill
GET    /api/v1/skills/:id                     Get a skill
PUT    /api/v1/skills/:id                     Update a skill
DELETE /api/v1/skills/:id                     Delete a skill (user-created only)

GET    /api/v1/agent-types                    List available agent types
```

Keep all handlers thin — call `agentConfigQueries.*` / `agentSkillQueries.*` directly, return the result. No business logic in the route handlers.

---

## Phase 3 — Dashboard: Agents Page

**New routes in `apps/web/src/app/(application)/`**:

```
/agents                    AgentsListPage
/agents/new                CreateAgentPage
/agents/[id]               AgentDetailPage (settings + skills + tools)
/agents/[id]/skills/new    CreateSkillPage
/agents/[id]/skills/[sid]  EditSkillPage
```

**New API routes in `apps/web/src/app/api/`**:

```
/api/agent-configs         → proxy to gateway /api/v1/agent-configs
/api/agent-configs/[id]    → proxy to gateway /api/v1/agent-configs/:id
/api/agent-configs/[id]/skills  → proxy to gateway
/api/skills                → proxy to gateway /api/v1/skills
/api/skills/[id]           → proxy to gateway /api/v1/skills/:id
/api/agent-types           → proxy to gateway /api/v1/agent-types
```

### AgentsListPage (`/agents`)

- Table/card list of all agent configs (name, description, type badge, default indicator).
- "New Agent" button → `/agents/new`.
- Click a row → `/agents/[id]`.

### CreateAgentPage (`/agents/new`)

Form fields:

- **Name** (required)
- **Description** (optional)
- **Agent Type** — dropdown populated from `GET /api/agent-types` (currently only "Pi Agent")
- **Model** — dropdown: provider + model ID (populate from a hardcoded list matching `DEFAULT_MODELS` in config.ts, filtered to providers with configured API keys)
- **System Prompt** — textarea with placeholder showing `DEFAULT_SYSTEM_PROMPT`
- **Set as default** — checkbox

On submit: `POST /api/agent-configs` → redirect to `/agents/[id]`.

### AgentDetailPage (`/agents/[id]`)

Three sections in a tabbed layout:

**Tab 1 — Settings**

- Name, description (inline editable)
- Model selector (provider + model ID dropdowns)
- System prompt textarea
- Thinking level selector: off / low / medium / high
- "Set as default" toggle
- Save button → `PUT /api/agent-configs/:id`

**Tab 2 — Tools**

- Toggle list of all 7 tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`
- Each toggle maps to a name in `tools_enabled[]` inside `config` JSONB
- Brief description under each tool name
- Warning banner when `bash` or `write` is enabled (code execution note)
- Save button updates config via `PUT /api/agent-configs/:id`

**Tab 3 — Skills**

- List of skills currently attached to this config (ordered by `sort_order`)
- Each row: skill name, description, enabled toggle, drag handle for reorder, remove button
- "Add Skill" button → modal showing all available skills (built-in + user-created), searchable
- "Create Skill" button → `/agents/[id]/skills/new`
- Save button → `PUT /api/agent-configs/:id/skills` with ordered array of skill IDs

### Skill Editor (`/agents/[id]/skills/new` and `/agents/[id]/skills/[sid]`)

- **Name** field
- **Description** field
- **Content** — markdown textarea (or CodeMirror with markdown mode)
- Preview panel rendering the markdown
- Save button
- Built-in skills: show "Clone" button (creates a copy) instead of edit fields

---

## Phase 4 — Dashboard: Wire Conversation Creation to Agent Config

**File**: `apps/web/src/components/organisms/chat-sidebar.tsx`

Currently hardcodes `agentid: "dbchatagent"`. Change to resolve the default agent config from the DB and send its real ID.

**Before** (`chat-sidebar.tsx:53`):

```typescript
body: JSON.stringify({
  title: "New Conversation",
  agentid: "dbchatagent",
  agentname: "DB Chat Agent",
})
```

**After**:

```typescript
// Fetch default agent config on sidebar mount (once)
const { data: defaultConfig } = useSWR("/api/agent-configs/default", fetcher)

// In handlenewchat:
body: JSON.stringify({
  title: "New Conversation",
  agentConfigId: defaultConfig?.id ?? null,
})
```

Add `GET /api/agent-configs/default` → returns the config where `is_default = true` for the current org.

Also update the Next.js `POST /api/conversations` handler to store `agentConfigId` in `conversations.agent_config_id`.

**File**: `apps/web/src/app/(application)/chat/[conversationid]/page.tsx`

Load the conversation's `agent_config_id` and pass it in the WebSocket `message` payload:

```typescript
// When sending a message over WebSocket:
ws.send(JSON.stringify({
  type: "message",
  sessionId: conversationId,
  content: input,
  agentConfigId: conversation.agentConfigId,  // <-- new
}))
```

This ensures the gateway uses the right config when auto-creating the session on first message.

---

## Phase 5 — Seed Built-in Skills

**New file**: `packages/db/src/seeds/builtin-skills.ts`

Seed the `agent_skills` table with built-in skills on gateway startup (idempotent — skip if name already exists with `is_builtin = true`).

Proposed built-ins:


| Name                 | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| Code Review          | Security, performance, error handling checklist |
| SQL Expert           | Parameterized queries, CTEs, LIMIT, EXPLAIN     |
| Documentation Writer | Structure, clarity, API doc standards           |
| Debug Assistant      | Reproduce → isolate → hypothesize → verify loop |
| Security Reviewer    | OWASP top 10, injection, auth, secrets          |


Call `seedBuiltinSkills(pool)` from the gateway `index.ts` on startup before the HTTP server starts.

---

## Implementation Order


| Step   | What                                          | Depends On | Effort |
| ------ | --------------------------------------------- | ---------- | ------ |
| **1a** | Expand `AgentSessionOpts`                     | —          | XS     |
| **1b** | Update `PiAgentSession` constructor           | 1a         | S      |
| **1c** | Update `resolveModel()` to accept overrides   | 1a         | XS     |
| **1d** | Add `buildToolList()`                         | 1a         | XS     |
| **1e** | Add `formatSkillsForPrompt()`                 | 1a         | XS     |
| **1f** | Gateway `SessionManager` loads config from DB | 1a–1e      | S      |
| **1g** | WS handler passes `agentConfigId`             | 1f         | XS     |
| **1h** | REST session creation accepts `agentConfigId` | 1f         | XS     |
| **2**  | Gateway CRUD endpoints for configs + skills   | 1f         | S      |
| **3a** | Dashboard agents list + create pages          | 2          | M      |
| **3b** | Agent detail page: settings + tools tabs      | 2          | M      |
| **3c** | Agent detail page: skills tab                 | 2          | M      |
| **3d** | Skill editor pages                            | 2          | S      |
| **4**  | Wire conversation creation to agentConfigId   | 1f, 3      | S      |
| **5**  | Seed built-in skills                          | 2          | S      |


Steps 1a–1e are independent of each other and can be done in a single pass. Step 1f is the gate for everything gateway-related. Dashboard work (3–4) can begin once step 2 is done.

---

## Key Files Reference


| File                                                            | Role                         | Change Needed                                         |
| --------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------- |
| `packages/agents/src/types.ts`                                  | `AgentSessionOpts` interface | Add config fields                                     |
| `packages/agents/src/pi.agent.ts`                               | `PiAgentSession` constructor | Use opts config                                       |
| `packages/agents/src/pi/model.ts`                               | `resolveModel()`             | Accept overrides                                      |
| `packages/agents/src/pi/tools.ts`                               | Tool factory                 | Add `buildToolList()`                                 |
| `packages/agents/src/pi/skills.ts`                              | Skill prompt formatter       | New file                                              |
| `packages/agents/src/index.ts`                                  | Public exports               | Export `SkillDefinition`                              |
| `packages/gateway/src/session-manager.ts`                       | Session creation             | Inject DB pool, load config                           |
| `packages/gateway/src/ws.ts`                                    | WebSocket handler            | Pass `agentConfigId`                                  |
| `packages/gateway/src/app.ts`                                   | REST routes                  | Config/skill CRUD + agentConfigId in session creation |
| `packages/gateway/src/index.ts`                                 | Gateway startup              | Pass DB pool to SessionManager, seed built-ins        |
| `packages/db/src/seeds/builtin-skills.ts`                       | Built-in skill seeding       | New file                                              |
| `apps/web/src/app/(application)/agents/`                        | Agents UI                    | New route group                                       |
| `apps/web/src/app/api/agent-configs/`                           | API proxy routes             | New                                                   |
| `apps/web/src/app/api/skills/`                                  | API proxy routes             | New                                                   |
| `apps/web/src/components/organisms/chat-sidebar.tsx`            | New chat button              | Replace hardcoded agentid                             |
| `apps/web/src/app/(application)/chat/[conversationid]/page.tsx` | Chat page                    | Send agentConfigId over WS                            |


---

## What Is Already Done

- DB migration `20260320031353-refactor-agent-configs` (applied)
  - `agent_types` table with `pi-agent` seeded
  - `agent_configs` refactored to JSONB `config` blob
  - `agent_skills` + `agent_config_skills` tables
  - `conversations.agent_config_id` FK
- DB query layer: `packages/db/src/queries/agent-configs.ts`, `agent-types.ts`, `agent-skills.ts`
- DB types: `AgentType`, `AgentConfig`, `AgentSkill`, `AgentConfigSkill`, `ResolvedSkill`
- All exported from `packages/db/src/index.ts`

---

## Constraints and Notes

- **Backward compatibility**: All `AgentSessionOpts` additions are optional. If no `agentConfigId` is provided, behavior is identical to today (env-based model, all tools, default prompt, no skills).
- **API key availability**: The model selector in the dashboard should only show providers that have API keys configured. Read from `GET /api/v1/agent-types` or a separate `/api/v1/providers` endpoint that checks env vars.
- **Tool safety**: `bash` and `write` execute code and modify the filesystem. In production these run inside the OpenShell sandbox. The dashboard should show a warning when enabling them in a config.
- **Built-in skills**: `is_builtin = true` skills are not deletable or editable by users. The dashboard shows a "Clone" button that creates a user-owned copy.
- **Session state**: Sessions are currently in-memory in the gateway. If the gateway restarts, the in-memory session is lost but the conversation record in PostgreSQL persists. The `agentConfigId` is stored on the conversation, so a reconnect could re-create the session with the correct config. Full reconnect/resume support is a separate concern.
- **Organizations**: `agent_configs.organization_id` is nullable and not enforced yet. All configs are currently shared. Org-scoping is additive later.

