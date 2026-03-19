CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizationid TEXT NOT NULL,
  teamid TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'postgresql',
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'inactive',
  createdby TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE INDEX idx_integrations_organizationid ON public.integrations(organizationid);
CREATE INDEX idx_integrations_teamid ON public.integrations(teamid);
CREATE INDEX idx_integrations_type ON public.integrations(type);
CREATE INDEX idx_integrations_deletedat ON public.integrations(deletedat);
