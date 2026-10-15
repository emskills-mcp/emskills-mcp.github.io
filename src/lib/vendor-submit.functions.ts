import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VendorSubmitResult =
  | { ok: true; slug: string; warnings: string[] }
  | { ok: false; problems: string[] };

/** Vendor pastes/uploads a SKILL.md; it is validated and queued for review. */
export const submitVendorSkillMd = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        markdown: z.string().min(20).max(100_000),
        org: z.string().trim().max(120).optional().default(""),
      })
      .parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<VendorSubmitResult> => {
    const { parseFrontMatter, validateSkillFolder } = await import("@/lib/registry-sync.server");
    const { getPublishedSkill } = await import("@/lib/db.server");

    const fm = parseFrontMatter(data.markdown);
    const slug = (typeof fm["slug"] === "string" ? fm["slug"] : "").toLowerCase().trim();
    const repoFm = typeof fm["repo"] === "string" ? fm["repo"] : "";
    const sourceRepo = repoFm || `${data.org || "vendor"}/skill`;

    const outcome = validateSkillFolder({
      slug: slug || "missing-slug",
      markdown: data.markdown,
      json: null,
      sourceRepo,
      path: "SKILL.md",
    });
    if (!outcome.ok) return { ok: false, problems: outcome.problems };
    const p = outcome.parsed;

    if (await getPublishedSkill(p.slug)) {
      return { ok: false, problems: [`slug: "${p.slug}" is already published in the registry.`] };
    }
    const { data: dupe } = await context.supabase
      .from("skill_submissions")
      .select("id")
      .eq("slug", p.slug)
      .eq("status", "pending")
      .maybeSingle();
    if (dupe) return { ok: false, problems: [`slug: a pending submission already claims "${p.slug}".`] };

    const { data: inserted, error } = await context.supabase
      .from("skill_submissions")
      .insert({
        ...p,
        org: data.org || p.org,
        submitter_id: context.userId,
        source: "vendor",
        skill_md: data.markdown,
      })
      .select("id")
      .single();
    if (error) return { ok: false, problems: [error.message] };

    try {
      const { runTriageForSubmission } = await import("@/lib/jev-store.server");
      await runTriageForSubmission(inserted.id);
    } catch (e) {
      console.error("vendor triage failed", e);
    }
    try {
      const { notifyAdminsOfSubmission } = await import("@/lib/notify.server");
      await notifyAdminsOfSubmission({
        id: inserted.id,
        slug: p.slug,
        name: p.name,
        technique: p.technique,
        kind: p.kind,
        org: data.org || p.org,
        repo: p.repo,
        origin: "vendor SKILL.md upload",
      });
    } catch (e) {
      console.error("vendor notification failed", e);
    }
    return { ok: true, slug: p.slug, warnings: outcome.warnings };
  });
