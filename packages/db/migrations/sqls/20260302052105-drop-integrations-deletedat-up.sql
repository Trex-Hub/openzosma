DROP INDEX IF EXISTS idx_integrations_deletedat;
ALTER TABLE public.integrations DROP COLUMN IF EXISTS deletedat;
