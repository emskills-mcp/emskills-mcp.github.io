CREATE TABLE public.footer_link_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'footer',
  path TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.footer_link_events TO service_role;
ALTER TABLE public.footer_link_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX footer_link_events_created_at_idx ON public.footer_link_events (created_at DESC);
CREATE INDEX footer_link_events_label_idx ON public.footer_link_events (label);