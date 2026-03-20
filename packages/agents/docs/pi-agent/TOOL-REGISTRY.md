# Tool Registry Design

> Last updated: 2026-03-19

## Problem

Tools are hardcoded in `packages/agents/src/pi/tools.ts`. Every session gets the same 7 tools regardless of agent config. There is no way to:
- Toggle tools on/off per agent config.
- Add new tool implementations without modifying `createDefaultTools`.
- Expose tool metadata (name, label, description) to the dashboard.

## Design

### ToolRegistry Class

A registry that maps string tool names to factory functions and metadata. Registered at startup, queried at session creation.

```typescript
import type { AgentTool } from "@mariozechner/pi-agent-core"

interface ToolRegistration {
  name: string
  label: string
  description: string
  category: ToolCategory
  factory: ToolFactory
  dependsOn?: string[]
}

type ToolFactory = (workspaceDir: string) => AgentTool

type ToolCategory = "filesystem" | "execution" | "search" | "custom"

class ToolRegistry {
  private tools = new Map<string, ToolRegistration>()

  register(registration: ToolRegistration): void {
    if (this.tools.has(registration.name)) {
      throw new Error(`Tool "${registration.name}" is already registered.`)
    }
    this.tools.set(registration.name, registration)
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name)
  }

  list(): ToolRegistration[] {
    return Array.from(this.tools.values())
  }

  listByCategory(category: ToolCategory): ToolRegistration[] {
    return this.list().filter((t) => t.category === category)
  }

  createTools(workspaceDir: string, enabledNames?: string[]): AgentTool[] {
    const registrations = enabledNames
      ? enabledNames.map((name) => {
          const reg = this.tools.get(name)
          if (!reg) throw new Error(`Unknown tool: "${name}"`)
          return reg
        })
      : Array.from(this.tools.values())

    return registrations.map((reg) => reg.factory(workspaceDir))
  }

  toManifest(): ToolManifestEntry[] {
    return this.list().map((reg) => ({
      name: reg.name,
      label: reg.label,
      description: reg.description,
      category: reg.category,
      dependsOn: reg.dependsOn ?? [],
    }))
  }
}

interface ToolManifestEntry {
  name: string
  label: string
  description: string
  category: ToolCategory
  dependsOn: string[]
}
```

### Built-in Registrations

```typescript
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from "@mariozechner/pi-coding-agent"

function registerBuiltinTools(registry: ToolRegistry): void {
  registry.register({
    name: "read",
    label: "Read Files",
    description: "Read the contents of files in the workspace.",
    category: "filesystem",
    factory: (cwd) => createReadTool(cwd),
  })

  registry.register({
    name: "write",
    label: "Write Files",
    description: "Create or overwrite files in the workspace.",
    category: "filesystem",
    factory: (cwd) => createWriteTool(cwd),
  })

  registry.register({
    name: "edit",
    label: "Edit Files",
    description: "Make targeted edits to existing files using search and replace.",
    category: "filesystem",
    factory: (cwd) => createEditTool(cwd),
    dependsOn: ["read"],
  })

  registry.register({
    name: "bash",
    label: "Shell",
    description: "Execute shell commands in the workspace.",
    category: "execution",
    factory: (cwd) => createBashTool(cwd),
  })

  registry.register({
    name: "grep",
    label: "Search Contents",
    description: "Search file contents using regular expressions.",
    category: "search",
    factory: (cwd) => createGrepTool(cwd),
  })

  registry.register({
    name: "find",
    label: "Find Files",
    description: "Find files by name or glob pattern.",
    category: "search",
    factory: (cwd) => createFindTool(cwd),
  })

  registry.register({
    name: "ls",
    label: "List Directory",
    description: "List directory contents.",
    category: "search",
    factory: (cwd) => createLsTool(cwd),
  })
}
```

### Usage in PiAgentSession

```typescript
class PiAgentSession implements AgentSession {
  constructor(opts: AgentSessionOpts, registry: ToolRegistry) {
    const tools = registry.createTools(opts.workspaceDir, opts.toolsEnabled)
    // ... rest of construction
  }
}
```

### Gateway Integration

The gateway exposes a tool manifest endpoint so the dashboard can render tool toggles:

```
GET /api/v1/tools -> ToolManifestEntry[]
```

This returns the list of registered tools with their names, labels, descriptions, and categories. The dashboard uses this to render checkboxes on the agent config page.

### File Layout

```
packages/agents/src/
├── registry/
│   ├── tool-registry.ts     # ToolRegistry class
│   ├── builtin.ts           # registerBuiltinTools()
│   └── types.ts             # ToolRegistration, ToolFactory, ToolCategory, etc.
├── pi/
│   ├── config.ts
│   ├── model.ts
│   └── tools.ts             # Simplified to use registry (or removed)
└── ...
```

---

## Future: Custom Tool Definitions

Once the registry is in place, users could define custom tools via the dashboard. These would be stored in a `custom_tools` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | text | Tool name (must be unique per instance) |
| `label` | text | Human-readable label |
| `description` | text | Description shown to the LLM |
| `parameters` | jsonb | JSON Schema for tool parameters |
| `executor_type` | text | `"http"` or `"shell"` |
| `executor_config` | jsonb | URL + headers (http) or command template (shell) |
| `created_at` | timestamptz | |

### HTTP Executor Example

```json
{
  "name": "lookup_customer",
  "label": "Customer Lookup",
  "description": "Look up a customer by email address.",
  "parameters": {
    "type": "object",
    "properties": {
      "email": { "type": "string", "description": "Customer email address" }
    },
    "required": ["email"]
  },
  "executor_type": "http",
  "executor_config": {
    "method": "GET",
    "url": "https://api.internal.example.com/customers?email={{email}}",
    "headers": { "Authorization": "Bearer ${CUSTOMER_API_TOKEN}" }
  }
}
```

The registry would wrap these into `AgentTool` instances at session creation, validating the schema and executing HTTP/shell calls within the sandbox.

### Security Considerations

- HTTP executors should only be allowed to call whitelisted domains (configured per-instance or validated by the sandbox network policy).
- Shell executors should only run inside the sandbox (never on the gateway host).
- Parameter injection must be sanitized to prevent command injection in shell executors and SSRF in HTTP executors.
- Custom tools should be flagged as `category: "custom"` and optionally require admin approval.
