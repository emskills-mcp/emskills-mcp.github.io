-- ---------- API keys ----------
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX api_keys_hash_idx ON public.api_keys(key_hash);
CREATE INDEX api_keys_user_idx ON public.api_keys(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_owner_select ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY api_keys_owner_insert ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY api_keys_owner_update ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY api_keys_owner_delete ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- MCP run log ----------
CREATE TABLE public.mcp_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  skill_slug text NOT NULL,
  tool_call text,
  mode text NOT NULL DEFAULT 'live',
  status text NOT NULL DEFAULT 'ok',
  duration_ms integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 1,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mcp_runs_user_created_idx ON public.mcp_runs(user_id, created_at DESC);
GRANT SELECT ON public.mcp_runs TO authenticated;
GRANT ALL ON public.mcp_runs TO service_role;
ALTER TABLE public.mcp_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_runs_owner_select ON public.mcp_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- Entitlements ----------
CREATE TABLE public.entitlements (
  user_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'inactive',
  featured_slots integer NOT NULL DEFAULT 0,
  private_skills boolean NOT NULL DEFAULT false,
  credits_balance integer NOT NULL DEFAULT 0,
  monthly_run_quota integer NOT NULL DEFAULT 100,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entitlements_customer_idx ON public.entitlements(stripe_customer_id);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY entitlements_owner_select ON public.entitlements FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- Invoices ----------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_invoice_id text NOT NULL UNIQUE,
  number text,
  amount_due integer NOT NULL DEFAULT 0,
  amount_paid integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'draft',
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user_idx ON public.invoices(user_id, created_at DESC);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_owner_select ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- Credit ledger ----------
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  balance_after integer,
  reason text NOT NULL,
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_user_idx ON public.credit_ledger(user_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_ledger_owner_select ON public.credit_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- Publisher verification ----------
CREATE TABLE public.publisher_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org text NOT NULL,
  contact_email text NOT NULL,
  evidence_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  badge text NOT NULL DEFAULT 'community',
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publisher_verifications_user_idx ON public.publisher_verifications(user_id);
GRANT SELECT, INSERT ON public.publisher_verifications TO authenticated;
GRANT ALL ON public.publisher_verifications TO service_role;
ALTER TABLE public.publisher_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY pubver_owner_select ON public.publisher_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pubver_owner_insert ON public.publisher_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- Badge fields on registry ----------
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS verified_badge text NOT NULL DEFAULT 'community';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.skill_submissions ADD COLUMN IF NOT EXISTS verified_badge text NOT NULL DEFAULT 'community';

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER api_keys_set_updated_at BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER entitlements_set_updated_at BEFORE UPDATE ON public.entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pubver_set_updated_at BEFORE UPDATE ON public.publisher_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();