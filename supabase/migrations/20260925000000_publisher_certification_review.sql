-- Record who reviewed publisher certifications and when.
ALTER TABLE public.publisher_verifications
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS publisher_verifications_public_directory_idx
  ON public.publisher_verifications (status, badge, reviewed_at DESC);

-- Review metadata remains service-role/admin only; no new public RLS policy is added.
