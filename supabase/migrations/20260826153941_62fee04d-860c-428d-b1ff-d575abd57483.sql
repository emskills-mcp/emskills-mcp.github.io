CREATE TABLE public.skill_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_slug text NOT NULL,
  version text NOT NULL,
  snapshot jsonb NOT NULL,
  skill_md text,
  source_repo text,
  source_sha text,
  origin text NOT NULL DEFAULT 'approval',
  change_summary text,
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  submission_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.skill_versions TO service_role;
GRANT SELECT ON public.skill_versions TO authenticated;

ALTER TABLE public.skill_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view skill version history"
ON public.skill_versions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
));

CREATE INDEX skill_versions_slug_created_idx
ON public.skill_versions (skill_slug, created_at DESC);