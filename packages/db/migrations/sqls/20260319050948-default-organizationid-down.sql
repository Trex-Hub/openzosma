-- Revert: remove DEFAULT 'default' from organizationid / teamid columns

ALTER TABLE public.conversations ALTER COLUMN organizationid DROP DEFAULT;
ALTER TABLE public.integrations ALTER COLUMN organizationid DROP DEFAULT;
ALTER TABLE public.integrations ALTER COLUMN teamid DROP DEFAULT;
ALTER TABLE public.knowledgesources ALTER COLUMN organizationid DROP DEFAULT;
ALTER TABLE public.knowledgechunks ALTER COLUMN organizationid DROP DEFAULT;
