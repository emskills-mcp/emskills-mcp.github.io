DROP POLICY IF EXISTS "submissions_admin_select" ON public.skill_submissions;
DROP POLICY IF EXISTS "submissions_admin_update" ON public.skill_submissions;
DROP POLICY IF EXISTS "submissions_owner_update" ON public.skill_submissions;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);