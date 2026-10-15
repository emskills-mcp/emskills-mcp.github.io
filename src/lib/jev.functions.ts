import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { isAdmin } = await import("@/lib/db.server");
  if (!(await isAdmin(userId))) throw new Error("Unauthorized");
}

/** Server helper: triage one submission row and persist the result. */
export const triageSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ ids: z.array(z.string()).min(1).max(25) }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runTriageForSubmission } = await import("@/lib/jev-store.server");
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of data.ids) {
      try {
        await runTriageForSubmission(id);
        results.push({ id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ id, ok: false, error: msg });
        // Credit / access problems affect every item — stop the batch.
        const status = (e as { status?: number }).status;
        if (status === 402 || status === 403 || status === 401) break;
      }
    }
    return results;
  });

export const scoreSkillQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ slug: z.string().optional() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runQualityForSkill } = await import("@/lib/jev-store.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slugs = data.slug
      ? [data.slug]
      : ((await supabaseAdmin.from("skills").select("slug")).data ?? []).map((r) => r.slug);
    let scored = 0;
    const errors: string[] = [];
    for (const slug of slugs) {
      try {
        await runQualityForSkill(slug);
        scored++;
      } catch (e) {
        errors.push(`${slug}: ${e instanceof Error ? e.message : String(e)}`);
        const status = (e as { status?: number }).status;
        if (status === 402 || status === 403 || status === 401) break;
      }
    }
    return { scored, total: slugs.length, errors };
  });

export const smartRankSkills = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ query: z.string().trim().min(2).max(300), slugs: z.array(z.string()).max(30) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { listPublishedSkills } = await import("@/lib/db.server");
    const { rerankSkills } = await import("@/lib/jev.server");
    const all = await listPublishedSkills();
    const bySlug = new Map(all.map((s) => [s.slug, s]));
    const candidates = data.slugs
      .map((s) => bySlug.get(s))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        summary: s.summary,
        technique: s.technique,
        tags: s.tags,
        toolCall: s.toolCall,
      }));
    if (candidates.length === 0) return { technique: "any", ranking: [] };
    try {
      return await rerankSkills(data.query, candidates);
    } catch (e) {
      return { technique: "any", ranking: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

export const gradeTestRun = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        slug: z.string().min(1),
        args: z.string().max(4000),
        output: z.string().min(1).max(20000),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getPublishedSkill } = await import("@/lib/db.server");
    const skill = await getPublishedSkill(data.slug);
    if (!skill) throw new Error("Skill not found.");
    const { gradeRun } = await import("@/lib/jev.server");
    return gradeRun({
      name: skill.name,
      summary: skill.summary,
      tool: skill.toolCall,
      args: data.args,
      output: data.output,
    });
  });
