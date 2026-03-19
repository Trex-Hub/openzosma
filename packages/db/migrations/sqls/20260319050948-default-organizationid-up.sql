-- Add DEFAULT 'default' to organizationid on all tables that have it.
-- This supports the "one instance = one org" model where organizationid
-- is no longer provided by the application layer.

-- conversations
ALTER TABLE public.conversations ALTER COLUMN organizationid SET DEFAULT 'default';
UPDATE public.conversations SET organizationid = 'default' WHERE organizationid IS NULL;

-- integrations
ALTER TABLE public.integrations ALTER COLUMN organizationid SET DEFAULT 'default';
UPDATE public.integrations SET organizationid = 'default' WHERE organizationid IS NULL;

-- integrations.teamid also needs a default (no longer provided)
ALTER TABLE public.integrations ALTER COLUMN teamid SET DEFAULT 'default';
UPDATE public.integrations SET teamid = 'default' WHERE teamid IS NULL;

-- knowledgesources
ALTER TABLE public.knowledgesources ALTER COLUMN organizationid SET DEFAULT 'default';
UPDATE public.knowledgesources SET organizationid = 'default' WHERE organizationid IS NULL;

-- knowledgechunks
ALTER TABLE public.knowledgechunks ALTER COLUMN organizationid SET DEFAULT 'default';
UPDATE public.knowledgechunks SET organizationid = 'default' WHERE organizationid IS NULL;
