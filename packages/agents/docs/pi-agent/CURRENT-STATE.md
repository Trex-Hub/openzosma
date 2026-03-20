# Current State of the Agent Package

> Last updated: 2026-03-20

## Overview

`@openzosma/agents` is the package that wraps [pi-mono](https://github.com/nicholasgasior/pi-mono)'s `Agent` class into OpenZosma's session model. It provides a `PiAgentProvider` that creates `PiAgentSession` instances, each backed by a pi-agent-core `Agent` with a fixed set of tools, a fixed model, and a fixed system prompt.

There is **no runtime configurability**. Every session gets the same agent.

## Package Structure

```
packages/agents/
├── package.json
├── src/
│   ├── index.ts          # Public exports (types + PiAgentProvider)
│   ├── types.ts           # AgentStreamEvent, AgentMessage, AgentSession, AgentProvider interfaces
│   ├── pi.agent.ts        # PiAgentSession + PiAgentProvider implementation
│   └── pi/
│       ├── config.ts      # PROVIDER_PREFERENCE, DEFAULT_MODELS, DEFAULT_SYSTEM_PROMPT
│       ├── model.ts       # resolveModel() -- env-var-based model/provider resolution
│       └── tools.ts       # createDefaultTools() -- fixed set of 7 coding tools
└── docs/
    └── pi-agent/          # (this documentation)
```

## Key Interfaces

### AgentProvider

```typescript
interface AgentProvider {
  readonly id: string
  readonly name: string
  createSession(opts: AgentSessionOpts): AgentSession
}
```

Factory that creates sessions. Currently the only implementation is `PiAgentProvider` (id: `"openzosma-agent"`).

### AgentSession

```typescript
interface AgentSession {
  sendMessage(content: string, signal?: AbortSignal): AsyncGenerator<AgentStreamEvent>
  getMessages(): AgentMessage[]
}
```

A single conversation session. Holds an in-memory message history and wraps the pi-agent-core `Agent.prompt()` call into an async generator of `AgentStreamEvent`.

### AgentSessionOpts

```typescript
interface AgentSessionOpts {
  sessionId: string
  workspaceDir: string
}
```

This is the **only configuration surface** for session creation. No model, no tools, no system prompt, no skills -- everything is hardcoded in `PiAgentSession`'s constructor.

### AgentStreamEvent

A discriminated union of event types emitted during a turn:

| Type | Fields | Description |
|------|--------|-------------|
| `turn_start` | `id` | Agent turn begins |
| `turn_end` | `id` | Agent turn ends |
| `message_start` | `id` | Assistant message begins |
| `message_update` | `id`, `text` | Text delta from assistant |
| `message_end` | `id` | Assistant message ends |
| `thinking_update` | `id`, `text` | Thinking/reasoning delta |
| `tool_call_start` | `toolCallId`, `toolName`, `toolArgs` | Tool invocation begins |
| `tool_call_update` | `toolCallId`, `toolName` | Tool execution in progress |
| `tool_call_end` | `toolCallId`, `toolName`, `toolResult`, `isToolError` | Tool invocation ends |
| `error` | `error` | Error during turn |

## How a Session is Created

### 1. PiAgentSession constructor (`pi.agent.ts`)

```typescript
constructor(opts: AgentSessionOpts) {
    const toolList = [...createDefaultTools(opts.workspaceDir)]
    const { model } = resolveModel()

    this.agent = new Agent({
        initialState: {
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            model,
            thinkingLevel: "off",
            tools: toolList,
        },
        convertToLlm,
        getApiKey: (provider: string) => getEnvApiKey(provider),
    })
}
```

Everything is derived from environment variables and hardcoded defaults:

- **Tools**: Always the same 7 tools from `createDefaultTools()`.
- **Model**: Resolved from `OPENZOSMA_MODEL_PROVIDER` / `OPENZOSMA_MODEL_ID` env vars, or auto-detected from available API keys.
- **System prompt**: Hardcoded string in `config.ts`.
- **Thinking**: Always `"off"`.

### 2. Tool creation (`pi/tools.ts`)

```typescript
function createDefaultTools(workspaceDir: string) {
  return [
    createReadTool(workspaceDir),
    createBashTool(workspaceDir),
    createEditTool(workspaceDir),
    createWriteTool(workspaceDir),
    createGrepTool(workspaceDir),
    createFindTool(workspaceDir),
    createLsTool(workspaceDir),
  ]
}
```

All 7 tools from `@mariozechner/pi-coding-agent`. No way to add, remove, or configure individual tools.

### 3. Model resolution (`pi/model.ts`)

Priority order:
1. Explicit `OPENZOSMA_MODEL_PROVIDER` + `OPENZOSMA_MODEL_ID` env vars.
2. Auto-detect from available API keys using `PROVIDER_PREFERENCE` order (Anthropic > OpenAI > Google > Groq > xAI > Mistral).
3. Fall back to first available model from any provider.

Default models per provider:

| Provider | Default Model |
|----------|---------------|
| Anthropic | `claude-sonnet-4-20250514` |
| OpenAI | `gpt-4o` |
| Google | `gemini-2.5-flash-preview-05-20` |
| Groq | `llama-3.3-70b-versatile` |
| xAI | `grok-3` |
| Mistral | `mistral-large-latest` |

## How the Gateway Uses the Agent Package

### Session Manager (`packages/gateway/src/session-manager.ts`)

The gateway holds a single `PiAgentProvider` instance and creates sessions on demand:

```typescript
createSession(id?: string): Session {
    const agentSession = this.provider.createSession({
        sessionId: session.id,
        workspaceDir: sessionDir,
    })
    // ...
}
```

No agent config ID, no model override, no tool selection. The session manager does not interact with the `agent_configs` table at all.

### WebSocket handler (`packages/gateway/src/ws.ts`)

The dashboard connects via WebSocket to `ws://localhost:4000/ws`. Messages include a `sessionId` (which is the conversation UUID from the dashboard's PostgreSQL). Sessions are auto-created on first message if they don't exist.

### REST endpoints (`packages/gateway/src/app.ts`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/sessions` | POST | Create session (no config accepted) |
| `/api/v1/sessions/:id` | GET | Get session status |
| `/api/v1/sessions/:id/messages` | POST | Send message |
| `/api/v1/sessions/:id/messages` | GET | List messages |

None of these accept agent configuration parameters.

## Database Schema (migration `20260320031353-refactor-agent-configs`)

The schema was refactored to be provider-agnostic. Runtime-specific parameters (model, tools, temperature, etc.) are no longer top-level columns — they live in a `config` JSONB blob, validated at the app layer using the schema registered in `agent_types`.

### `agent_types`

Registry of known agent runtimes. Adding a new agent type (OpenClaw, etc.) is a data change, not a schema change.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (e.g., `"pi-agent"`, `"openclaw"`) |
| `name` | text | Human-readable label |
| `description` | text | Optional description |
| `config_schema` | jsonb | JSON Schema for validating type-specific config blobs |
| `is_available` | boolean | Can be disabled without deleting |
| `created_at` | timestamptz | |

Seeded at migration time with `pi-agent`.

### `agent_configs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | text | Owning org (nullable until org scoping is enforced) |
| `agent_type_id` | text | FK → `agent_types.id` |
| `name` | text | Config name |
| `description` | text | Optional description |
| `system_prompt` | text | Custom system prompt (universal across all agent types) |
| `config` | jsonb | Type-specific parameters — for pi-agent: `model`, `provider`, `tools_enabled`, `max_tokens`, `temperature`, `thinking_level` |
| `is_default` | boolean | One default config per org |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

TypeScript type in `packages/db/src/types.ts`:

```typescript
interface AgentConfig {
    id: string
    organizationId: string | null
    agentTypeId: string
    name: string
    description: string | null
    systemPrompt: string | null
    config: Record<string, unknown>
    isDefault: boolean
    createdAt: Date
    updatedAt: Date
}
```

Full CRUD queries exist in `packages/db/src/queries/agent-configs.ts`. `listAgentConfigs` accepts an optional `organizationId` filter.

### `agent_skills` and `agent_config_skills`

See [SKILLS.md](./SKILLS.md) for the full design. Both tables are created by this migration.

### `conversations.agent_config_id`

Added by this migration. FK → `agent_configs.id ON DELETE SET NULL`. Records which agent config handled a given conversation.

### Dashboard hardcoding

The dashboard still hardcodes `agentid: "dbchatagent"` and `agentname: "DB Chat Agent"` in both the sidebar new-chat handler (`apps/web/src/components/organisms/chat-sidebar.tsx`) and the chat page (`apps/web/src/app/(application)/chat/page.tsx`). This value is stored as a conversation participant but never resolved to an actual agent config.

## Gaps

1. **No config passthrough**: `AgentSessionOpts` does not carry model, tools, system prompt, or skill information.
2. **No tool registry**: Tools are hardcoded in `createDefaultTools`. No way to select or extend.
3. **No skill loading**: `agent_skills` / `agent_config_skills` tables exist but skill loading logic in `PiAgentSession` is not implemented.
4. **No dashboard UI**: No `/agents` page. No way to create or manage agent configs from the UI.
5. **No gateway integration**: Gateway REST/WebSocket routes don't accept or resolve `agentConfigId`.
6. **No extension loading**: pi-mono's extension system (`ExtensionFactory`) is not used. No `agent_extensions` table yet — see [PI-MONO-EXTENSIBILITY.md](./PI-MONO-EXTENSIBILITY.md) for the planned design.

## Dependencies

```json
{
    "@mariozechner/pi-agent-core": "^0.60.0",
    "@mariozechner/pi-ai": "^0.60.0",
    "@mariozechner/pi-coding-agent": "^0.60.0",
    "@sinclair/typebox": "^0.34.48"
}
```

Source locations in pi-mono (sibling repo at `../pi-mono/`):

| What | Location |
|------|----------|
| Agent class | `packages/agent/src/agent.ts` |
| AgentTool type | `packages/agent/src/types.ts` |
| AgentEvent types | `packages/agent/src/types.ts:199-214` |
| Tool factories | `packages/coding-agent/src/core/tools/*.ts` |
| Extension system | `packages/coding-agent/src/core/extensions/` |
| Skill loading | `packages/coding-agent/src/core/skills.ts` |
