import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Public reads (no auth) ----

export const getPublishedSkills = createServerFn({ method: "GET" }).handler(
  async () => {
    const { listPublishedSkills } = await import("@/lib/db.server");
    return listPublishedSkills();
  },
);

export const getSkillBySlug = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { getPublishedSkill, getRelatedSkills } = await import("@/lib/db.server");
    const skill = await getPublishedSkill(data.slug);
    if (!skill) return { skill: null, related: [] };
    const related = await getRelatedSkills(skill.technique, skill.slug);
    return { skill, related };
  });

/**
 * Public snapshot history for one published skill — powers the version
 * dropdown on the detail page. Strips bookkeeping columns, keeps the data
 * needed to render a version and diff it against the live entry.
 */
export const getSkillVersions = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    const { getPublishedSkill, listSkillVersions } = await import("@/lib/db.server");
    // Only expose history for skills that are actually live.
    if (!(await getPublishedSkill(data.slug))) return [];
    const rows = await listSkillVersions(data.slug);
    return rows.map((v) => ({
      id: v.id,
      version: v.version,
      origin: v.origin,
      changeSummary: v.change_summary,
      changedFields: v.changed_fields ?? [],
      skillMd: v.skill_md,
      snapshot: v.snapshot,
      createdAt: v.created_at,
    }));
  });

// ---- Authenticated: submit + view own ----

const submissionSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2),
  technique: z.string().min(2),
  kind: z.enum(["SKILL.md", "MCP server"]),
  summary: z.string().min(10),
  description: z.string().min(10),
  org: z.string().min(1),
  repo: z.string().min(3),
  version: z.string().min(1),
  license: z.string().min(1),
  runtime: z.string().min(1),
  tool_call: z.string().min(1),
  category: z.string().min(1),
  mcp_endpoint: z.string().trim().max(300).optional().default(""),
  tags: z.array(z.string()).default([]),
});

export type SubmitResult =
  | { ok: true; repo: string; skillMdPath: string }
  | { ok: false; fieldErrors: Record<string, string>; message: string };

export const submitSkill = createServerFn({ method: "POST" })
  .inputValidator((raw) => submissionSchema.parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const { checkRepoField } = await import("@/lib/github.server");
    const { getPublishedSkill } = await import("@/lib/db.server");

    const fieldErrors: Record<string, string> = {};

    // Slug must be unique against the live registry.
    if (await getPublishedSkill(data.slug)) {
      fieldErrors['slug'] = `The slug "${data.slug}" is already published in the registry.`;
    }
    const { data: dupe } = await context.supabase
      .from("skill_submissions")
      .select("id")
      .eq("slug", data.slug)
      .eq("status", "pending")
      .maybeSingle();
    if (dupe) fieldErrors['slug'] = `A pending submission already claims "${data.slug}".`;

    if (data.mcp_endpoint) {
      try {
        const u = new URL(data.mcp_endpoint);
        if (u.protocol !== "https:") fieldErrors['mcp_endpoint'] = "Endpoint must use https.";
      } catch {
        fieldErrors['mcp_endpoint'] = "Endpoint must be a full URL, e.g. https://host/mcp";
      }
    }

    // Server-side gate: repo must exist, be public, and ship a SKILL.md.
    const repoCheck = await checkRepoField(data.repo);
    if (!repoCheck.ok) {
      for (const issue of repoCheck.issues) fieldErrors[issue.field] = issue.message;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        fieldErrors,
        message: "Submission rejected — fix the highlighted fields and resubmit.",
      };
    }

    const check = (repoCheck as { ok: true; check: { repo: string; skillMdPath: string } }).check;
    const { data: inserted, error } = await context.supabase
      .from("skill_submissions")
      .insert({
        ...data,
        mcp_endpoint: data.mcp_endpoint || null,
        repo: check.repo,
        submitter_id: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      return {
        ok: false,
        fieldErrors: {},
        message: error.message,
      };
    }
    // AI triage for the review queue — best-effort, never blocks the submission.
    try {
      const { runTriageForSubmission } = await import("@/lib/jev-store.server");
      await runTriageForSubmission(inserted.id);
    } catch (e) {
      console.error("submission triage failed", e);
    }
    // Tell admins there is something in the queue — never block the submission.
    try {
      const { notifyAdminsOfSubmission } = await import("@/lib/notify.server");
      await notifyAdminsOfSubmission({
        id: inserted.id,
        slug: data.slug,
        name: data.name,
        technique: data.technique,
        kind: data.kind,
        org: data.org,
        repo: check.repo,
        origin: "manual submission",
      });
    } catch (e) {
      console.error("submission notification failed", e);
    }

    return { ok: true, repo: check.repo, skillMdPath: check.skillMdPath };
  });

/** Pre-flight repo check used by the contribute form (field-level, non-throwing). */
export const verifySkillRepo = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ repo: z.string().min(3) }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { checkRepoField } = await import("@/lib/github.server");
    const res = await checkRepoField(data.repo);
    if (!res.ok) return { ok: false as const, message: res.issues[0]!.message };
    return {
      ok: true as const,
      repo: res.check.repo,
      skillMdPath: res.check.skillMdPath,
      skillMdUrl: res.check.skillMdUrl,
    };
  });

// ---- Public: stats, SKILL.md preview, MCP run ----

export const getRegistryStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getRegistryStats } = await import("@/lib/db.server");
  return getRegistryStats();
});

export const getSkillReadme = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { getSkillEndpoint } = await import("@/lib/db.server");
    const { fetchSkillMd } = await import("@/lib/github.server");
    const skill = await getSkillEndpoint(data.slug);
    if (!skill) return { ok: false as const, error: "Skill not found." };
    try {
      const doc = await fetchSkillMd(skill.repo, data.slug);
      return { ok: true as const, ...doc };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Executes the skill's tool against its registered MCP endpoint (or preflights the manifest). */
export const runSkillTool = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({ slug: z.string().min(1), args: z.string().max(4000).optional() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getSkillEndpoint } = await import("@/lib/db.server");
    const skill = await getSkillEndpoint(data.slug);
    if (!skill) throw new Error("Skill not found.");

    // A skill may declare its own mcp_endpoint in SKILL.md. When it does not,
    // the registry's own hosted MCP server executes the tool, so Run always
    // performs a real JSON-RPC call.
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const forwardedProto = getRequestHeader("x-forwarded-proto");
    const host = getRequestHeader("host");
    const origin =
      getRequestHeader("origin") ??
      (host ? `${forwardedProto ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : null);
    const endpoint =
      skill.endpoint ?? (origin ? `${origin}/api/public/mcp/${data.slug}` : null);
    if (!endpoint) {
      return {
        ok: false,
        mode: "live" as const,
        endpoint: null,
        tool: skill.tool,
        logs: [{ t: 0, level: "error" as const, msg: "could not resolve an MCP endpoint" }],
        output: null,
        error: "No MCP endpoint could be resolved for this skill.",
      };
    }



    let args: Record<string, unknown> = {};
    if (data.args && data.args.trim()) {
      try {
        const parsed: unknown = JSON.parse(data.args);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Arguments must be a JSON object.");
        }
        args = parsed as Record<string, unknown>;
      } catch (e) {
        return {
          ok: false,
          mode: "live" as const,
          endpoint,
          tool: skill.tool,
          logs: [
            {
              t: 0,
              level: "error" as const,
              msg: `invalid arguments JSON — ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          output: null,
          error: "Arguments must be a valid JSON object.",
        };
      }
    }

    const auth = getRequestHeader("authorization");
    const { logRun, userFromBearer, resolveApiKey } = await import("@/lib/billing.server");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    // Agents authenticate with an ems_live_ API key; the web app sends a
    // Supabase session token. Attribute the run to whichever is present.
    const viaKey = token?.startsWith("ems_live_") ? await resolveApiKey(token) : null;
    const userId = viaKey ? viaKey.userId : token ? await userFromBearer(token) : null;

    const { runLiveTool } = await import("@/lib/mcp-run.server");
    const started = Date.now();
    const result = await runLiveTool(endpoint, skill.tool, args);


    // Usage accounting for the dashboard — best-effort, never fails the run.
    try {
      await logRun({
        userId,
        apiKeyId: viaKey?.id ?? null,
        skillSlug: data.slug,
        toolCall: skill.tool,
        mode: result.mode,
        status: result.ok ? "ok" : "error",
        durationMs: Date.now() - started,
        error: result.error,
      });
    } catch {
      /* usage logging is non-critical */
    }

    return result;
  });

export const getMySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("skill_submissions")
      .select("*")
      .eq("submitter_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---- Admin: review queue + bootstrap ----

export const getPendingSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin, listPendingSubmissions } = await import("@/lib/db.server");
    const admin = await isAdmin(context.userId);
    if (!admin) throw new Error("Unauthorized");
    return listPendingSubmissions();
  });

const reviewSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

export const reviewSubmission = createServerFn({ method: "POST" })
  .inputValidator((raw) => reviewSchema.parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const {
      isAdmin,
      approveSubmission,
      rejectSubmission,
      getSubmissionById,
      recordReview,
    } = await import("@/lib/db.server");
    const admin = await isAdmin(context.userId);
    if (!admin) throw new Error("Unauthorized");

    const sub = await getSubmissionById(data.id);
    if (!sub) throw new Error("Submission not found");

    if (data.action === "approve") {
      await approveSubmission(data.id, context.userId, data.notes);
      // Public quality scores — best-effort, never blocks publishing.
      try {
        const { runQualityForSkill } = await import("@/lib/jev-store.server");
        await runQualityForSkill(sub.slug);
      } catch (e) {
        console.error("quality scoring failed", e);
      }
    } else {
      await rejectSubmission(data.id, context.userId, data.notes);
    }
    await recordReview({
      submissionId: data.id,
      slug: sub.slug,
      name: sub.name,
      action: data.action,
      notes: data.notes ?? undefined,
      reviewerId: context.userId,
    });

    // Let the contributor know the outcome — email must not fail the review.
    try {
      const { notifySubmitterOfDecision } = await import("@/lib/notify.server");
      await notifySubmitterOfDecision({
        submissionId: data.id,
        submitterId: sub.submitter_id ?? null,
        slug: sub.slug,
        name: sub.name,
        decision: data.action,
        notes: data.notes ?? undefined,
      });
    } catch (e) {
      console.error("decision notification failed", e);
    }

    return { ok: true };
  });

/** One-time: promotes the first signed-in user to admin if none exists yet. */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    if (data && data.length > 0) throw new Error("An admin already exists.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin } = await import("@/lib/db.server");
    return { isAdmin: await isAdmin(context.userId) };
  });

export const getReviewAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin, listReviewAudit } = await import("@/lib/db.server");
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");
    return listReviewAudit(50);
  });
