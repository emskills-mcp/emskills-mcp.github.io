DROP TABLE IF EXISTS public.registry_sources;

CREATE TABLE public.registry_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo text NOT NULL,
  branch text NOT NULL DEFAULT '',
  path_prefix text NOT NULL DEFAULT 'skills',
  last_synced_at timestamptz,
  last_sync_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo)
);

GRANT SELECT ON public.registry_sources TO authenticated;
GRANT ALL ON public.registry_sources TO service_role;
ALTER TABLE public.registry_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view registry sources"
  ON public.registry_sources FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ));

ALTER TABLE public.skill_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'form',
  ADD COLUMN IF NOT EXISTS source_repo text,
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS source_sha text;

CREATE INDEX IF NOT EXISTS skill_submissions_source_path_idx
  ON public.skill_submissions (source_repo, source_path);