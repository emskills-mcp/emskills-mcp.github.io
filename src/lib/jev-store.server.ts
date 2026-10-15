// Persists Jev judgments. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scoreQuality, triageSubmission } from "@/lib/jev.server";

export async function runTriageForSubmission(id: string) {
  const { data: s, error } = await supabaseAdmin
    .from("skill_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error("Submission not found");
  const triage = await triageSubmission({ ...s, tags: s.tags ?? [] });
  const { error: upErr } = await supabaseAdmin
    .from("skill_submissions")
    .update({ ai_triage: triage as never, ai_triaged_at: new Date().toISOString() })
    .eq("id", id);
  if (upErr) throw new Error(upErr.message);
  return triage;
}

export async function runQualityForSkill(slug: string) {
  const { data: s, error } = await supabaseAdmin
    .from("skills")
    .select("name, summary, description, skill_md")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error("Skill not found");
  const quality = await scoreQuality(s);
  const { error: upErr } = await supabaseAdmin
    .from("skills")
    .update({ ai_quality: quality as never, ai_quality_at: new Date().toISOString() })
    .eq("slug", slug);
  if (upErr) throw new Error(upErr.message);
  return quality;
}
