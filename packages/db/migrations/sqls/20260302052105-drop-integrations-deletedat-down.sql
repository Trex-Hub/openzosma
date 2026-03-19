ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS deletedat TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_integrations_deletedat ON public.integrations(deletedat);
