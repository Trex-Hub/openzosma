# Pi-Mono Extensibility Reference

> Last updated: 2026-03-20

This document catalogs every extensibility point in pi-mono that OpenZosma can use to let users customize their agent. Pi-mono is consumed via npm (`@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@mariozechner/pi-coding-agent`). Source lives at `../pi-mono/`.

---

## 1. Agent Class (`pi-agent-core`)

**Source**: `packages/agent/src/agent.ts`

The `Agent` class is the core runtime. It accepts an `AgentOptions` object at construction time.

### AgentOptions

```typescript
interface AgentOptions {
  initialState?: Partial<AgentState>
  convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>
  steeringMode?: "all" | "one-at-a-time"
  followUpMode?: "all" | "one-at-a-time"
  streamFn?: StreamFn
  sessionId?: string
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined
  onPayload?: SimpleStreamOptions["onPayload"]
  thinkingBudgets?: ThinkingBudgets
  transport?: Transport
  maxRetryDelayMs?: number
  toolExecution?: ToolExecutionMode    // "sequential" | "parallel"
  beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | void>
  afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | void>
}
```

### AgentState

```typescript
interface AgentState {
  systemPrompt: string
  model: Model
  thinkingLevel: ThinkingLevel
  tools: AgentTool[]
  messages: AgentMessage[]
  isStreaming: boolean
  streamMessage: AgentMessage | null
  pendingToolCalls: Set<string>
  error?: string
}
```

**Key**: `initialState` lets you set `systemPrompt`, `model`, `thinkingLevel`, and `tools` at construction time. Tools can also be changed at runtime via `agent.setTools(tools: AgentTool[])`.

### Customization Hooks

| Hook | Signature | Purpose |
|------|-----------|---------|
| `beforeToolCall` | `(context, signal?) => Promise<{ block?, reason? } \| void>` | Intercept tool calls before execution. Return `{ block: true, reason: "..." }` to prevent a tool from running. |
| `afterToolCall` | `(context, signal?) => Promise<{ content?, details?, isError? } \| void>` | Inspect or override tool results after execution. Return replacement content to modify what the agent sees. |
| `transformContext` | `(messages, signal?) => Promise<AgentMessage[]>` | Transform the full message history before it is sent to the LLM. Useful for context window management, summarization, or injecting context. |
| `convertToLlm` | `(messages) => Message[]` | Convert agent messages to the wire format for the LLM API. OpenZosma uses pi-coding-agent's `convertToLlm`. |

### BeforeToolCallContext

```typescript
interface BeforeToolCallContext {
  assistantMessage: AgentMessage
  toolCall: ToolCall
  args: Record<string, unknown>
  context: AgentMessage[]
}
```

### AfterToolCallContext

```typescript
interface AfterToolCallContext {
  assistantMessage: AgentMessage
  toolCall: ToolCall
  args: Record<string, unknown>
  result: AgentToolResult
  isError: boolean
  context: AgentMessage[]
}
```

These hooks are the primary mechanism for adding guardrails, logging, or transforming tool behavior without modifying the tools themselves.

---

## 2. Tool System

### AgentTool Interface (`pi-agent-core`)

**Source**: `packages/agent/src/types.ts`

```typescript
interface AgentTool extends Tool {
  label: string
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback,
  ) => Promise<AgentToolResult>
}

interface Tool {
  name: string
  description: string
  parameters: TSchema    // @sinclair/typebox schema
}

interface AgentToolResult<T = unknown> {
  content: (TextContent | ImageContent)[]
  details: T
}

type AgentToolUpdateCallback = (partialResult: AgentToolResult) => void
```

Any object conforming to `AgentTool` can be passed in `initialState.tools`. This is the primary interface for custom tools.

### Built-in Tool Factories (`pi-coding-agent`)

**Source**: `packages/coding-agent/src/core/tools/`

| Factory | Tool Name | Description |
|---------|-----------|-------------|
| `createReadTool(cwd, options?)` | `read` | Read file contents |
| `createBashTool(cwd, options?)` | `bash` | Execute shell commands |
| `createEditTool(cwd, options?)` | `edit` | Edit files (search/replace) |
| `createWriteTool(cwd, options?)` | `write` | Write file contents |
| `createGrepTool(cwd)` | `grep` | Search file contents |
| `createFindTool(cwd)` | `find` | Find files by name pattern |
| `createLsTool(cwd)` | `ls` | List directory contents |

### Pluggable Operations

Several tool factories accept operation interfaces that let you swap the underlying implementation (e.g., for remote/SSH execution):

**ReadOperations**:
```typescript
interface ReadOperations {
  readFile: (path: string) => Promise<string>
  access: (path: string) => Promise<boolean>
  detectImageMimeType?: (path: string) => Promise<string | null>
}
```

**EditOperations**:
```typescript
interface EditOperations {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  access: (path: string) => Promise<boolean>
}
```

**BashOperations**:
```typescript
interface BashOperations {
  exec: (command: string, options: ExecOptions) => Promise<ExecResult>
}
```

**BashSpawnHook**: `(context: SpawnContext) => SpawnContext` -- rewrite command, env, or cwd before execution. Useful for injecting environment variables or wrapping commands.

### Bundle Helpers

| Helper | Tools Included |
|--------|----------------|
| `createCodingTools(cwd, options?)` | read, bash, edit, write |
| `createReadOnlyTools(cwd, options?)` | read, grep, find, ls |
| `createAllTools(cwd, options?)` | All 7 tools as a record |

---

## 3. Extension System (`pi-coding-agent`)

**Source**: `packages/coding-agent/src/core/extensions/`

Extensions are the most powerful extensibility mechanism in pi-mono. They are TypeScript modules that export an `ExtensionFactory` function and can hook into the full agent lifecycle.

### ExtensionFactory

```typescript
type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>
```

The factory receives an `ExtensionAPI` object that provides registration methods.

### ExtensionAPI

```typescript
interface ExtensionAPI {
  // Tool management
  registerTool<TParams>(tool: ToolDefinition<TParams>): void
  setActiveTools(names: string[]): void
  getActiveTools(): string[]
  getAllTools(): AgentTool[]

  // Lifecycle events
  on(event: "session_start", handler: SessionStartHandler): void
  on(event: "agent_start", handler: AgentStartHandler): void
  on(event: "tool_call", handler: ToolCallHandler): void
  on(event: "context", handler: ContextHandler): void
  // ... other lifecycle events

  // CLI integration
  registerCommand(command: CommandDefinition): void
  registerShortcut(shortcut: ShortcutDefinition): void
  registerFlag(flag: FlagDefinition): void

  // UI
  registerMessageRenderer(renderer: MessageRenderer): void
  registerProvider(provider: ProviderDefinition): void

  // Messaging
  sendMessage(message: AgentMessage): void
  sendUserMessage(content: string): void
  appendEntry(entry: Entry): void
}
```

### ToolDefinition (extension-registered tools)

```typescript
interface ToolDefinition<TParams = unknown> extends AgentTool {
  promptSnippet?: string         // Injected into system prompt
  promptGuidelines?: string      // Injected into system prompt
  renderCall?: (args: TParams) => string        // Optional UI rendering
  renderResult?: (result: AgentToolResult) => string  // Optional UI rendering
}
```

### Extension Discovery and Loading

Extensions are discovered on the filesystem:
- `discoverAndLoadExtensions()` -- scans known directories
- `loadExtensionFromFactory(factory, api)` -- loads a single extension
- `ExtensionRunner` -- manages extension lifecycle

### Relevance to OpenZosma

The extension system is designed for CLI/local usage. It discovers `.ts`/`.js` files on the filesystem and loads them at process start. Key considerations for a hosted platform:

1. **Security**: Extensions can register arbitrary tools (code execution), hook into lifecycle events, and modify messages. Running user-uploaded extension code is a significant security risk.
2. **Discovery**: Filesystem-based discovery doesn't map to a multi-session hosted platform.
3. **State**: Extensions are loaded once per process. In OpenZosma, each session needs its own isolated extension state.

**Recommendation**: Use the extension system internally (deploy-time extensions for org-wide capabilities), but do not expose it to end users directly. Instead, provide the same outcomes through controlled interfaces (skills for instructions, tool registry for tools).

---

## 4. Skill System (`pi-coding-agent`)

**Source**: `packages/coding-agent/src/core/skills.ts`

Skills are markdown files that provide domain-specific instructions to the agent. They are the simplest and safest extensibility mechanism.

### Skill Format

Skills are `.md` files with optional YAML frontmatter:

```markdown
---
name: SQL Expert
description: Expertise in SQL query optimization and database design.
disable-model-invocation: false
---

# SQL Expert

You are an expert in SQL. When the user asks about database queries...
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable name |
| `description` | string | Short description |
| `disable-model-invocation` | boolean | If true, the model cannot invoke this skill autonomously |

### Loading

```typescript
function loadSkills(): Skill[]
function loadSkillsFromDir(options: { dir: string }): Skill[]
```

Default directories scanned:
- `~/.pi/agent/skills/`
- `./.pi/skills/` (project-local)
- Custom paths via configuration

### Prompt Injection

```typescript
function formatSkillsForPrompt(skills: Skill[]): string
```

Formats skills as XML-like blocks and appends them to the system prompt:

```xml
<skills>
<skill name="SQL Expert">
You are an expert in SQL...
</skill>
</skills>
```

### Relevance to OpenZosma

Skills are pure text -- no code execution, no security risk. They map cleanly to a database-backed system:
- Store skill content in a `skills` table.
- Load skills at session creation.
- Format and append to the system prompt.
- Users manage skills via the dashboard.

---

## 5. Custom Message Types (Declaration Merging)

**Source**: `packages/agent/src/types.ts`

pi-mono supports extending the message type system via TypeScript declaration merging:

```typescript
interface CustomAgentMessages {
  // Empty by default
}

type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages]
```

Consumers extend it:

```typescript
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    artifact: ArtifactMessage
    notification: NotificationMessage
  }
}
```

This is useful for introducing new message types (e.g., structured artifacts, file references, database query results) without modifying pi-mono.

---

## 6. Runtime Model Mutation

The `Agent` class exposes state mutation methods:

```typescript
agent.setTools(tools: AgentTool[])    // Replace tool set at runtime
agent.setState(partial: Partial<AgentState>)  // Merge partial state
```

This enables mid-session tool changes -- for example, activating a database tool only after the user connects a database.

---

## 7. Pi Package Ecosystem

Pi has a community package registry at [shittycodingagent.ai/packages](https://shittycodingagent.ai/packages). Packages are npm modules tagged `pi-package` and can bundle any combination of extensions, skills, prompts, and themes.

### Package Format

A pi package adds a `pi` key to its `package.json`:

```json
{
  "name": "@foo/pi-tools",
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

Extensions are loaded at runtime via `jiti` (TypeScript-native loader — no compilation step). Skills, prompts, and themes are discovered from conventional directories.

### Installation (CLI)

```
pi install npm:@foo/pi-tools
pi install git:github.com/user/repo
```

### What OpenZosma Can Use Today

| Pi Package Content | Support |
|---|---|
| **Skills** (markdown) | `agent_skills` table — seed the package's skill files as rows |
| **Prompts** (system prompt templates) | `agent_configs.system_prompt` |
| **Themes** | Dashboard concern only, no DB needed |
| **Extensions** (TypeScript code, tools, hooks) | Not yet — needs `agent_extensions` table |

### Planned: `agent_extensions` Schema

When Layer 4 (deploy-time extensions) is implemented, two new tables are needed:

```sql
-- Operator-installed pi packages
CREATE TABLE agent_extensions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL UNIQUE,  -- e.g. '@foo/pi-tools'
  version      TEXT NOT NULL,
  source       TEXT NOT NULL,         -- 'npm' | 'git'
  source_ref   TEXT NOT NULL,         -- npm version tag or git URL
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  metadata     JSONB DEFAULT '{}',    -- mirrors the `pi` key from package.json
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which extensions each agent config has active
CREATE TABLE agent_config_extensions (
  agent_config_id UUID NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  extension_id    UUID NOT NULL REFERENCES agent_extensions(id) ON DELETE CASCADE,
  config          JSONB DEFAULT '{}', -- per-config overrides
  PRIMARY KEY (agent_config_id, extension_id)
);
```

This is purely additive — no existing tables change. Adding it is a new migration on top of `20260320031353`.

### Security Boundary

Pi extensions execute arbitrary TypeScript with full system access. The boundary is:

- **Operator-installed packages** (deploy-time) → safe, operator is trusted
- **User-uploaded packages** → requires sandboxing (WASM/VM isolation), deferred

---

## Summary: Extensibility Surface

| Mechanism | Scope | Security | User-Facing? | OpenZosma Use |
|-----------|-------|----------|--------------|---------------|
| `initialState.tools` | Per-session | Safe (controlled by platform) | Via tool registry | Yes -- core |
| `initialState.systemPrompt` | Per-session | Safe | Via agent config | Yes -- core |
| `initialState.model` | Per-session | Safe | Via agent config | Yes -- core |
| `beforeToolCall` / `afterToolCall` | Per-session | Safe (hook, no execution) | No | Yes -- guardrails |
| `transformContext` | Per-session | Safe | No | Yes -- context management |
| Skills (markdown) | Per-session | Safe (text only) | Yes -- dashboard | Yes -- core |
| Extensions (`ExtensionFactory`) | Per-process | Dangerous (arbitrary code) | No | Deploy-time only |
| Custom messages (declaration merging) | Compile-time | Safe | No | Yes -- for new message types |
| Pluggable operations | Per-tool | Moderate (custom I/O) | No | Yes -- sandbox isolation |
| `agent.setTools()` | Runtime | Safe (controlled by platform) | No | Yes -- dynamic tools |
