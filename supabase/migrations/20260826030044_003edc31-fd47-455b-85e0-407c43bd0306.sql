CREATE TABLE public.submission_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.skill_submissions(id) ON DELETE CASCADE,
  submission_slug text NOT NULL,
  submission_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','reject')),
  notes text,
  reviewer_id uuid NOT NULL,
  reviewer_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX submission_reviews_created_at_idx ON public.submission_reviews (created_at DESC);
CREATE INDEX submission_reviews_submission_id_idx ON public.submission_reviews (submission_id);

GRANT ALL ON public.submission_reviews TO service_role;

ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;
-- No policies: the audit trail is readable only through admin-verified server code (service role).