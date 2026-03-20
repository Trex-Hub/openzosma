-- Reverse of 20260320031353-refactor-agent-configs-up

-- ─── 4. Drop skills tables ────────────────────────────────────────────────────
DROP TABLE IF EXISTS agent_config_skills;
DROP TABLE IF EXISTS agent_skills;

-- ─── 3. Remove agent_config_id from conversations ─────────────────────────────
DROP INDEX IF EXISTS idx_conversations_agent_config_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS agent_config_id;

-- ─── 2. Restore agent_configs to original shape ───────────────────────────────

ALTER TABLE agent_configs
  ADD COLUMN model         TEXT,
  ADD COLUMN provider      TEXT,
  ADD COLUMN tools_enabled JSONB DEFAULT '[]',
  ADD COLUMN skills        JSONB DEFAULT '[]',
  ADD COLUMN max_tokens    INTEGER DEFAULT 4096,
  ADD COLUMN temperature   REAL DEFAULT 0.7;

-- Restore values from config JSONB for pi-agent rows
UPDATE agent_configs SET
  model         = config->>'model',
  provider      = config->>'provider',
  tools_enabled = COALESCE(config->'tools_enabled', '[]'::jsonb),
  max_tokens    = COALESCE((config->>'max_tokens')::integer, 4096),
  temperature   = COALESCE((config->>'temperature')::real, 0.7)
WHERE agent_type_id = 'pi-agent';

-- Sentinel fallback for any non-pi-agent rows
UPDATE agent_configs SET
  model    = 'unknown',
  provider = 'unknown'
WHERE model IS NULL;

ALTER TABLE agent_configs
  ALTER COLUMN model SET NOT NULL,
  ALTER COLUMN provider SET NOT NULL;

-- Drop new columns
ALTER TABLE agent_configs
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS agent_type_id,
  DROP COLUMN IF EXISTS config,
  DROP COLUMN IF EXISTS is_default;

-- ─── 1. Drop agent_types ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS agent_types;
