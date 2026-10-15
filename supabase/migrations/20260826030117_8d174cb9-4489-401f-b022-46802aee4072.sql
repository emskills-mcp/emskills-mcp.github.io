ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS mcp_endpoint text;
ALTER TABLE public.skill_submissions ADD COLUMN IF NOT EXISTS mcp_endpoint text;