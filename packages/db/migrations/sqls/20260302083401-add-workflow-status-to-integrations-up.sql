-- Add workflow tracking columns to integrations
ALTER TABLE public.integrations ADD COLUMN workflowrunid TEXT;
ALTER TABLE public.integrations ADD COLUMN workflowstatus TEXT NOT NULL DEFAULT 'idle';

-- Index for filtering by workflow status
CREATE INDEX idx_integrations_workflowstatus ON public.integrations (workflowstatus);
