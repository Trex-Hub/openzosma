-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Knowledge Sources ────────────────────────────────────────────────────────
-- Tracks where knowledge came from: an integration DB analysis, user-uploaded
-- document, or any future source type.

CREATE TABLE public.knowledgesources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizationid  TEXT NOT NULL,
  integrationid   TEXT,                -- nullable: only set for integration-derived knowledge
  sourcetype      TEXT NOT NULL,       -- 'integration' | 'document' | 'upload'
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'ready' | 'error'
  metadata        JSONB DEFAULT '{}',
  fileurl         TEXT,                -- for uploaded files (S3/R2 URL)
  filename        TEXT,
  mediatype       TEXT,
  sizebytes       BIGINT,
  createdby       TEXT NOT NULL,
  createdat       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedat       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat       TIMESTAMPTZ
);

CREATE INDEX idx_knowledgesources_organizationid ON public.knowledgesources (organizationid);
CREATE INDEX idx_knowledgesources_integrationid ON public.knowledgesources (integrationid);
CREATE INDEX idx_knowledgesources_sourcetype ON public.knowledgesources (sourcetype);
CREATE INDEX idx_knowledgesources_deletedat ON public.knowledgesources (deletedat);

-- ─── Knowledge Chunks (Vector Embeddings) ─────────────────────────────────────
-- The actual vector embeddings, linked to a knowledge source.
-- Uses OpenAI text-embedding-3-small (1536 dimensions).

CREATE TABLE public.knowledgechunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizationid  TEXT NOT NULL,
  sourceid        UUID NOT NULL,       -- references knowledgesources.id (no FK constraint)
  chunkindex      INTEGER NOT NULL,
  totalchunks     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  embedding       vector(1536) NOT NULL,
  metadata        JSONB DEFAULT '{}',
  createdat       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat       TIMESTAMPTZ
);

-- Similarity search index (IVFFlat for pgvector)
CREATE INDEX idx_knowledgechunks_embedding ON public.knowledgechunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Composite index for org + source lookups and cleanup
CREATE INDEX idx_knowledgechunks_org_source ON public.knowledgechunks (organizationid, sourceid);

-- Filter by deletedat
CREATE INDEX idx_knowledgechunks_deletedat ON public.knowledgechunks (deletedat);
