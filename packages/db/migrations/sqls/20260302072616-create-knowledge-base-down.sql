DROP TABLE IF EXISTS public.knowledgechunks;
DROP TABLE IF EXISTS public.knowledgesources;

-- Note: We do not DROP EXTENSION vector here because other tables/extensions
-- may depend on it. Remove manually if truly no longer needed.
