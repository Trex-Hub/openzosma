# Implementation Plan: User-Extensible Agents

> Last updated: 2026-03-20

## Goal

Allow OpenZosma users to customize their agent through the dashboard: choose a model, write custom instructions (skills), toggle tools on/off, and eventually define custom tools -- all without writing code or redeploying.

## Principles

1. **Config flows from DB to agent.** The `agent_configs` table is the source of truth. The gateway loads the config and passes it through to `PiAgentSession`.
2. **Skills are text, not code.** User-authored skills are markdown injected into the system prompt. No code execution, no security risk.
3. **Tools are registered, not discovered.** A `ToolRegistry` maps tool names to factory functions. Agent configs reference tools by name. The platform controls what's available.
4. **Extensions are deploy-time only.** pi-mono's extension system is powerful but unsafe for end-user code. Extensions are installed by the operator, not the user.
5. **Per-session isolation.** Each session gets its own tool instances, skill set, and config. No cross-session leakage.

---

## Layer 1: Agent Config Passthrough

**Priority**: Highest -- unblocks everything else.

### What Changes

1. **`AgentSessionOpts`** gains optional config fields (or accepts an `AgentConfig` object).
2. **`PiAgentSession` constructor** uses the config instead of hardcoded defaults.
3. **Gateway** accepts `agentConfigId` when creating sessions, loads the config from DB, passes it through.
4. **Dashboard** sends the agent config ID when creating conversations.

### Changes by File

| File | Change |
|------|--------|
| `packages/agents/src/types.ts` | Add config fields to `AgentSessionOpts` |
| `packages/agents/src/pi.agent.ts` | Use opts config in constructor |
| `packages/agents/src/pi/model.ts` | Accept provider/model overrides |
| `packages/agents/src/pi/tools.ts` | Accept `toolsEnabled` filter |
| `packages/agents/src/pi/config.ts` | Make system prompt configurable |
| `packages/gateway/src/session-manager.ts` | Load agent config, pass to provider |
| `packages/gateway/src/app.ts` | Accept `agentConfigId` in session creation |
| `packages/gateway/src/ws.ts` | Accept `agentConfigId` in WebSocket messages |
| `apps/web/` | Send `agentConfigId` when creating conversations |

### Proposed AgentSessionOpts

```typescript
interface AgentSessionOpts {
  sessionId: string
  workspaceDir: string

  // Config overrides (all optional, defaults used when absent)
  model?: string
  provider?: string
  systemPrompt?: string
  toolsEnabled?: string[]
  skills?: SkillDefinition[]
  maxTokens?: number
  temperature?: number
  thinkingLevel?: "off" | "low" | "medium" | "high"
}

interface SkillDefinition {
  name: string
  content: string
}
```

### Gateway Session Creation Flow (after)

```
1. Client sends { agentConfigId: "uuid" } in session creation
2. Gateway loads AgentConfig from DB (packages/db)
3. Gateway loads skills for this config (packages/db)
4. Gateway passes config + skills to provider.createSession(opts)
5. PiAgentSession constructor:
   a. Resolves model from opts.provider + opts.model (falls back to env)
   b. Builds tool list from opts.toolsEnabled via ToolRegistry
   c. Formats skills into system prompt
   d. Creates Agent with assembled config
```

### Migration Path

The change is backward-compatible. If no config is provided, the current behavior is preserved (env-based model, all default tools, default system prompt).

---

## Layer 2: Skills System

**Priority**: High -- highest user value with lowest risk.

See [SKILLS.md](./SKILLS.md) for the detailed design.

### Summary

1. ~~New `agent_skills` table in PostgreSQL.~~ **Done** — `agent_skills` and `agent_config_skills` created in migration `20260320031353`.
2. Skills are markdown documents stored in the DB.
3. At session creation, skills are loaded and formatted into the system prompt. *(not yet wired in `PiAgentSession`)*
4. Dashboard provides a skill editor (create, edit, toggle, delete). *(not yet built)*
5. Built-in skill library ships with OpenZosma (clonable, editable). *(not yet seeded)*

---

## Layer 3: Tool Registry

**Priority**: Medium -- enables tool customization.

See [TOOL-REGISTRY.md](./TOOL-REGISTRY.md) for the detailed design.

### Summary

1. `ToolRegistry` class maps tool names to factory functions + metadata.
2. Built-in tools (read, bash, edit, write, grep, find, ls) are registered at startup.
3. `toolsEnabled` on `agent_configs` selects which tools are active.
4. Dashboard shows tool toggles on the agent config page.
5. Future: custom tool definitions (user-defined name, schema, HTTP/shell executor).

---

## Layer 4: Deploy-Time Extensions

**Priority**: Low -- for operators, not end users.

### Summary

1. Extensions are npm packages that export an `ExtensionFactory`.
2. Listed in a config file (e.g., `openzosma.extensions.json`) or env var.
3. Loaded once at process start by the gateway/orchestrator.
4. Extensions register tools (which appear in the ToolRegistry) and hooks.
5. Dashboard shows which extensions are active (read-only for non-admins).

### Config Format

```json
{
  "extensions": [
    {
      "package": "@openzosma/ext-jira",
      "config": {
        "jiraUrl": "https://company.atlassian.net",
        "apiToken": "${JIRA_API_TOKEN}"
      }
    }
  ]
}
```

### Why Not User-Uploadable

pi-mono extensions can:
- Execute arbitrary code via `registerTool`.
- Hook into `beforeToolCall` and modify tool behavior.
- Access the full message history.
- Register commands that interact with the runtime.

Allowing users to upload arbitrary extension code would require full sandboxing (e.g., running extensions inside the OpenShell sandbox). This is possible but significantly more complex and is deferred to a later phase.

---

## Implementation Order

| Phase | What | Effort | Depends On | Status |
|-------|------|--------|------------|--------|
| **DB** | Refactor `agent_configs` to provider-agnostic schema; add `agent_types`, `agent_skills`, `agent_config_skills`, `conversations.agent_config_id` | — | — | ✅ Done (migration `20260320031353`) |
| **1a** | Expand `AgentSessionOpts` + `PiAgentSession` constructor | Small | Nothing | Pending |
| **1b** | Gateway config passthrough (REST + WebSocket) | Small | 1a | Pending |
| **1c** | Dashboard sends `agentConfigId` on conversation create | Small | 1b | Pending |
| **2b** | Skill loading + prompt formatting in `PiAgentSession` | Small | 1a | Pending |
| **2c** | Dashboard skill editor UI | Medium | DB | Pending |
| **3a** | `ToolRegistry` class + built-in registrations | Small | Nothing | Pending |
| **3b** | `PiAgentSession` uses registry for tool resolution | Small | 1a, 3a | Pending |
| **3c** | Dashboard tool toggle UI | Small | 3a | Pending |
| **4a** | `agent_extensions` table + extension loader (deploy-time) | Medium | 3a | Pending |
| **4b** | Dashboard extension status page | Small | 4a | Pending |

Phases 1a, 2a, and 3a are independent and can be done in parallel. The dashboard work (1c, 2c, 3c) can also be parallelized once the backend is ready.

---

## Risks and Open Questions

### Security

- **Tool execution in hosted environments**: Tools like `bash` and `write` execute code and modify the filesystem. In production, these run inside an OpenShell sandbox. In the MVP (no sandbox), they run on the gateway host. Enabling/disabling tools per config is a partial mitigation, but the real security boundary is the sandbox.
- **Custom tool definitions** (future): If users can define tools that call arbitrary HTTP endpoints or shell commands, the platform needs to validate and sandbox those calls. This is deferred.

### Model/Provider API Keys

- Currently, API keys are set via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).
- If users select a model from a provider without a configured key, the session will fail.
- The dashboard should show which providers have keys configured and limit model selection accordingly.
- Future: users bring their own API keys (stored encrypted in the DB, injected per-session).

### Skill Conflicts

- If multiple skills give contradictory instructions, the agent will have to reconcile them based on the system prompt ordering.
- Consider adding skill priority or ordering in the `agent_skills` table.

### Tool Dependencies

- Some tools depend on others (e.g., `edit` assumes you can `read` first).
- The dashboard could show warnings when disabling a tool that others depend on.
- Not a hard blocker -- the agent will just get tool-not-found errors and adapt.

### State Persistence

- Currently, `PiAgentSession` holds messages in memory only.
- The gateway has no reconnection/resume support.
- This is a separate concern from extensibility but affects UX (if you configure an agent, start a session, and the gateway restarts, the session is lost).
