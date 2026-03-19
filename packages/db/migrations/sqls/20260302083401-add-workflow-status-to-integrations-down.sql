DROP INDEX IF EXISTS idx_integrations_workflowstatus;
ALTER TABLE public.integrations DROP COLUMN IF EXISTS workflowstatus;
ALTER TABLE public.integrations DROP COLUMN IF EXISTS workflowrunid;
