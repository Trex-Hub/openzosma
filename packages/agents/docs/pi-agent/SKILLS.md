# Skills System Design

> Last updated: 2026-03-20

## Problem

There is no way for users to give the agent domain-specific instructions. The system prompt is hardcoded in `packages/agents/src/pi/config.ts`. The `agent_configs` table has a `skills` column (string array of skill IDs) but there is no `skills` table, no loading logic, and no dashboard UI.

Pi-mono has a skill system (markdown files loaded from the filesystem and formatted into the system prompt), but it is designed for local CLI usage, not a hosted platform.

## What Pi-Mono Does

**Source**: `packages/coding-agent/src/core/skills.ts`

- Skills are `.md` files with optional YAML frontmatter (`name`, `description`, `disable-model-invocation`).
- Loaded from `~/.pi/agent/skills/`, `./.pi/skills/`, or custom paths.
- Formatted via `formatSkillsForPrompt(skills)` into XML-like blocks appended to the system prompt.
- The agent sees skills as part of its instructions -- they shape behavior without adding tools.

Example formatted output:

```xml
<skills>
<skill name="SQL Expert">
You are an expert in SQL query optimization. When writing queries:
- Always use parameterized queries
- Prefer CTEs over subqueries for readability
- Add LIMIT clauses to prevent runaway queries
</skill>
<skill name="Code Review">
When reviewing code, check for:
- Security vulnerabilities (injection, XSS, CSRF)
- Performance issues (N+1 queries, missing indexes)
- Error handling (uncaught promises, missing try/catch)
</skill>
</skills>
```

## Design

### Database Schema

> **Status**: Implemented in migration `20260320031353-refactor-agent-configs`.

`agent_skills` and `agent_config_skills` are live. The old `agent_configs.skills text[]` column has been removed.

```sql
CREATE TABLE agent_skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  content       TEXT NOT NULL,
  is_builtin    BOOLEAN NOT NULL DEFAULT false,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_config_skills (
  agent_config_id  UUID NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  skill_id         UUID NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_config_id, skill_id)
);
```

**`agent_skills`**: Global skill definitions. Skills can be built-in (shipped with OpenZosma, `is_builtin = true`) or user-created.

**`agent_config_skills`**: Junction table linking skills to agent configs. A skill can be shared across multiple configs. The `enabled` flag and `sort_order` are per-config overrides.

### Why a Separate Table (Not Inline JSONB)

The old `agent_configs.skills` column stored `string[]` (skill IDs). This was adequate for referencing skills but not for storing them. A separate table allows:

- Sharing skills across agent configs.
- Editing a skill once and having all configs pick up the change.
- Querying skills independently (list, search, filter).
- Tracking built-in vs. user-created.
- Versioning (future: add a `version` column or `skill_versions` table).

### TypeScript Types

```typescript
interface Skill {
  id: string
  name: string
  description: string | null
  content: string
  isBuiltin: boolean
  enabled: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

interface AgentConfigSkill {
  agentConfigId: string
  skillId: string
  enabled: boolean
  sortOrder: number
}

interface ResolvedSkill {
  name: string
  content: string
}
```

### DB Queries

> **Status**: Implemented in `packages/db/src/queries/agent-skills.ts`. TypeScript types (`AgentSkill`, `AgentConfigSkill`, `ResolvedSkill`) are in `packages/db/src/types.ts` and exported from `packages/db/src/index.ts` as `agentSkillQueries`.

```typescript
// packages/db/src/queries/agent-skills.ts

async function createSkill(pool: Pool, skill: {
  name: string
  description?: string
  content: string
  isBuiltin?: boolean
}): Promise<Skill>

async function getSkill(pool: Pool, id: string): Promise<Skill | null>

async function listSkills(pool: Pool): Promise<Skill[]>

async function updateSkill(pool: Pool, id: string, updates: Partial<{
  name: string
  description: string | null
  content: string
  enabled: boolean
  sortOrder: number
}>): Promise<Skill | null>

async function deleteSkill(pool: Pool, id: string): Promise<void>

async function getSkillsForConfig(pool: Pool, agentConfigId: string): Promise<ResolvedSkill[]>
// Loads skills joined through agent_config_skills, filtered by enabled, ordered by sort_order.

async function setConfigSkills(pool: Pool, agentConfigId: string, skillIds: string[]): Promise<void>
// Replaces the skill set for a config (upserts agent_config_skills rows).
```

### Prompt Formatting

A function in `packages/agents/` that takes resolved skills and produces a system prompt suffix:

```typescript
function formatSkillsForPrompt(skills: ResolvedSkill[]): string {
  if (skills.length === 0) return ""

  const blocks = skills
    .map((s) => `<skill name="${escapeXml(s.name)}">\n${s.content}\n</skill>`)
    .join("\n\n")

  return `\n\n<skills>\n${blocks}\n</skills>`
}
```

This is appended to the base system prompt (either the default or the agent config's custom `systemPrompt`).

### Session Creation Flow

```
1. Gateway receives agentConfigId
2. Load AgentConfig from DB
3. Load skills: getSkillsForConfig(pool, agentConfig.id)
4. Build system prompt:
   base = agentConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
   full = base + formatSkillsForPrompt(skills)
5. Pass full system prompt in AgentSessionOpts
6. PiAgentSession uses it in Agent({ initialState: { systemPrompt: full } })
```

---

## Built-in Skill Library

OpenZosma ships with a set of built-in skills that users can enable/disable per agent config. These are seeded into the `agent_skills` table on first run (or via a migration/seed script).

### Proposed Built-in Skills

| Name | Description | Content Summary |
|------|-------------|-----------------|
| **Code Review** | Systematic code review checklist | Security, performance, error handling, readability |
| **SQL Expert** | SQL query writing and optimization | Parameterized queries, CTEs, LIMIT, EXPLAIN |
| **Documentation Writer** | Technical documentation standards | Structure, clarity, examples, API docs |
| **Debug Assistant** | Systematic debugging approach | Reproduce, isolate, hypothesize, verify |
| **Security Reviewer** | Security-focused analysis | OWASP top 10, injection, auth, secrets |
| **Data Analyst** | Data analysis and visualization | Pandas patterns, chart selection, statistical methods |

### Seed Script

```typescript
const BUILTIN_SKILLS = [
  {
    name: "Code Review",
    description: "Systematic code review following best practices.",
    content: `When reviewing code, follow this checklist:
...`,
    isBuiltin: true,
  },
  // ...
]

async function seedBuiltinSkills(pool: Pool): Promise<void> {
  for (const skill of BUILTIN_SKILLS) {
    const existing = await pool.query(
      "SELECT id FROM agent_skills WHERE name = $1 AND is_builtin = true",
      [skill.name],
    )
    if (existing.rows.length === 0) {
      await createSkill(pool, skill)
    }
  }
}
```

Built-in skills have `is_builtin = true`. They can be disabled but not deleted or edited by users. Users can clone a built-in skill to create an editable copy.

---

## Dashboard UI

### Agent Config Page (`/agents/:id`)

A "Skills" section with:

1. **Active skills list**: Skills currently enabled for this config, draggable for reordering.
2. **Add skill**: Dropdown/modal showing available skills (both built-in and user-created).
3. **Create skill**: Button to create a new skill (opens the skill editor).
4. **Toggle**: Each skill has an enable/disable toggle.
5. **Preview**: Clicking a skill shows its content in a read-only view.

### Skill Editor (`/agents/:id/skills/:skillId` or modal)

1. **Name** and **description** fields.
2. **Content**: Markdown editor (e.g., CodeMirror or a simple textarea with preview).
3. **Save** / **Delete** buttons.
4. Built-in skills show a "Clone" button instead of "Edit".

### Skills Library Page (`/skills`)

Optional standalone page listing all skills:
- Filter by built-in vs. user-created.
- Search by name/description.
- Bulk operations (delete, enable/disable across configs).

---

## Gateway API Endpoints

```
GET    /api/v1/skills                 List all skills
POST   /api/v1/skills                 Create a skill
GET    /api/v1/skills/:id             Get a skill
PUT    /api/v1/skills/:id             Update a skill
DELETE /api/v1/skills/:id             Delete a skill (user-created only)

GET    /api/v1/agent-configs/:id/skills       List skills for a config
PUT    /api/v1/agent-configs/:id/skills       Set skills for a config (array of skill IDs)
```

---

## Open Questions

### Skill Versioning

Should skills be versioned? If a user edits a skill mid-session, should active sessions pick up the change? Options:

1. **No versioning**: Active sessions keep the skill content from when they started. New sessions get the latest. (Simplest, recommended for MVP.)
2. **Versioning**: `skill_versions` table, sessions reference a specific version. Enables rollback and audit trail.

### Skill Size Limits

Large skills consume system prompt tokens. Consider:
- A character limit per skill (e.g., 10,000 characters).
- A total skill token budget per agent config.
- Displaying estimated token usage in the dashboard.

### Skill Variables / Templates

Should skills support variable interpolation? For example:

```markdown
You are assisting with the {{project_name}} project. The primary language is {{language}}.
```

This adds complexity but enables reusable skill templates. Deferred to a later phase.

### Conditional Skills

Pi-mono supports `disable-model-invocation` to prevent the model from activating a skill autonomously. In a hosted platform, all skills are always active (they're in the system prompt). Conditional activation would require the agent to decide at runtime which skills to use -- this maps more to a RAG-style approach (retrieve relevant skills per message) and is deferred.
