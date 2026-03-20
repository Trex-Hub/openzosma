-- ─── 1. Agent Types Registry ──────────────────────────────────────────────────
-- Decouples agent_configs from any specific runtime (pi-agent, openclaw, etc.)

CREATE TABLE agent_types (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  config_schema JSONB,           -- JSON Schema for validating type-specific config blobs
  is_available  BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed built-in agent types
INSERT INTO agent_types (id, name, description, config_schema) VALUES
(
  'pi-agent',
  'Pi Agent',
  'Pi Agent powered by pi-mono. Supports filesystem tools, shell execution, and LLM-based reasoning.',
  '{
    "type": "object",
    "properties": {
      "model":          { "type": "string" },
      "provider":       { "type": "string" },
      "tools_enabled":  { "type": "array", "items": { "type": "string" } },
      "max_tokens":     { "type": "integer" },
      "temperature":    { "type": "number" },
      "thinking_level": { "type": "string", "enum": ["off", "low", "medium", "high"] }
    }
  }'
);

-- ─── 2. Migrate agent_configs to provider-agnostic shape ──────────────────────

-- Add new columns (nullable first so existing rows are safe during migration)
ALTER TABLE agent_configs
  ADD COLUMN organization_id TEXT,
  ADD COLUMN agent_type_id   TEXT REFERENCES agent_types(id),
  ADD COLUMN config          JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN is_default      BOOLEAN NOT NULL DEFAULT false;

-- Pack existing pi-agent-specific columns into the config JSONB
UPDATE agent_configs SET
  agent_type_id = 'pi-agent',
  config = jsonb_build_object(
    'model',         model,
    'provider',      provider,
    'tools_enabled', tools_enabled,
    'max_tokens',    max_tokens,
    'temperature',   temperature
  );

-- Now enforce NOT NULL on agent_type_id
ALTER TABLE agent_configs
  ALTER COLUMN agent_type_id SET NOT NULL;

-- Drop the pi-agent-specific top-level columns
ALTER TABLE agent_configs
  DROP COLUMN model,
  DROP COLUMN provider,
  DROP COLUMN tools_enabled,
  DROP COLUMN skills,
  DROP COLUMN max_tokens,
  DROP COLUMN temperature;

-- ─── 3. Link conversations to the agent config that handled them ───────────────

ALTER TABLE conversations
  ADD COLUMN agent_config_id UUID REFERENCES agent_configs(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_agent_config_id ON public.conversations(agent_config_id);

-- ─── 4. Skills system ─────────────────────────────────────────────────────────
-- Skills are markdown text injected into the system prompt.
-- Agent-type-agnostic: any agent that has a system prompt can use skills.

CREATE TABLE agent_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  content     TEXT NOT NULL,
  is_builtin  BOOLEAN NOT NULL DEFAULT false,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table: which skills are attached to which agent config
CREATE TABLE agent_config_skills (
  agent_config_id UUID NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  skill_id        UUID NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_config_id, skill_id)
);

CREATE INDEX idx_agent_config_skills_skill_id ON agent_config_skills(skill_id);
