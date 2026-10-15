ALTER TABLE public.registry_sources
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes integer NOT NULL DEFAULT 360,
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz;

ALTER TABLE public.skill_submissions
  ADD COLUMN IF NOT EXISTS skill_md text;

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS skill_md text;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'github',
  delivery_id text,
  event text,
  repo text,
  ref text,
  status text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook deliveries"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ));

CREATE INDEX IF NOT EXISTS webhook_deliveries_created_idx
  ON public.webhook_deliveries (created_at DESC);