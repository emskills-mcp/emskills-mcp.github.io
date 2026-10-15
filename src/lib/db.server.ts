// Server-only data helpers for the skills registry.
// Imported ONLY inside createServerFn handlers (dynamic import) so this
// module never ships to the client bundle.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Skill, Technique } from "@/data/skills";

export type SkillRow = {
  id: string;
  slug: string;
  name: string;
  technique: string;
  kind: string;
  summary: string;
  description: string;
  org: string;
  repo: string;
  version: string;
  stars: number;
  downloads: number;
  license: string;
  runtime: string;
  tool_call: string;
  category: string;
  tags: string[] | null;
  updated_at: string | null;
  verified_badge?: string | null;
  mcp_endpoint?: string | null;
  ai_quality?: unknown;

  submitted_by: string | null;
  published_at: string;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  slug: string;
  name: string;
  technique: string;
  kind: string;
  summary: string;
  description: string;
  org: string;
  repo: string;
  version: string;
  license: string;
  runtime: string;
  tool_call: string;
  category: string;
  tags: string[] | null;
  submitter_id: string;
  status: string;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  mcp_endpoint?: string | null;
  source?: string | null;
  source_repo?: string | null;
  source_path?: string | null;
  source_sha?: string | null;
  skill_md?: string | null;
  ai_triage?: import("@/lib/jev.server").Triage | null;
  ai_triaged_at?: string | null;
};


export function mapSkillRow(row: SkillRow): Skill {
  return {
    slug: row.slug,
    name: row.name,
    technique: row.technique as Technique,
    kind: row.kind as Skill["kind"],
    summary: row.summary,
    description: row.description,
    org: row.org,
    repo: row.repo,
    version: row.version,
    stars: row.stars,
    downloads: row.downloads,
    license: row.license,
    runtime: row.runtime,
    toolCall: row.tool_call,
    category: row.category,
    tags: row.tags ?? [],
    updated: row.updated_at ?? "",
    verifiedBadge: row.verified_badge ?? "community",
    mcpEndpoint: row.mcp_endpoint ?? null,
    quality: (row.ai_quality as Skill["quality"]) ?? null,
  };
}

export async function listPublishedSkills(): Promise<Skill[]> {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select("*")
    .order("stars", { ascending: false });
  if (error) throw new Error(`Failed to load skills: ${error.message}`);
  return (data ?? []).map((r) => mapSkillRow(r as SkillRow));
}

export async function getPublishedSkill(slug: string): Promise<Skill | null> {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load skill: ${error.message}`);
  return data ? mapSkillRow(data as SkillRow) : null;
}

export async function getRelatedSkills(
  technique: string,
  excludeSlug: string,
): Promise<Skill[]> {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select("*")
    .eq("technique", technique)
    .neq("slug", excludeSlug)
    .limit(3);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapSkillRow(r as SkillRow));
}

/** Admin check via the service-role client (bypasses RLS on user_roles). */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function listPendingSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("skill_submissions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SubmissionRow[];
}

export async function approveSubmission(
  id: string,
  reviewerId: string,
  notes?: string,
): Promise<void> {
  const { data: sub, error } = await supabaseAdmin
    .from("skill_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) throw new Error("Submission not found");

  const s = sub as SubmissionRow;

  const { data: verification } = await supabaseAdmin
    .from("publisher_verifications")
    .select("badge")
    .eq("user_id", s.submitter_id)
    .eq("org", s.org)
    .eq("status", "verified")
    .in("badge", ["verified", "certified"])
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const publisherBadge = verification?.badge === "certified" ? "certified" : verification?.badge === "verified" ? "verified" : "community";

  // Snapshot which fields the approval actually changes, for the history entry.
  const { data: prevRow } = await supabaseAdmin
    .from("skills")
    .select("*")
    .eq("slug", s.slug)
    .maybeSingle();
  const previousFields = diffChangedFields(
    prevRow as Record<string, unknown> | null,
    s as unknown as Record<string, unknown>,
  );

  const { error: insErr } = await supabaseAdmin.from("skills").upsert(
    {
      slug: s.slug,
      name: s.name,
      technique: s.technique,
      kind: s.kind,
      summary: s.summary,
      description: s.description,
      org: s.org,
      repo: s.repo,
      version: s.version,
      license: s.license,
      runtime: s.runtime,
      tool_call: s.tool_call,
      category: s.category,
      tags: s.tags ?? [],
      verified_badge: publisherBadge,
      submitted_by: s.submitter_id,
      skill_md: s.skill_md ?? null,
      updated_at: new Date().toISOString().slice(0, 10),
    },
    { onConflict: "slug" },
  );
  if (insErr) throw new Error(insErr.message);

  await recordSkillVersion({
    slug: s.slug,
    version: s.version,
    origin: s.source === "repo" ? "sync" : "approval",
    submissionId: s.id,
    createdBy: reviewerId,
    changedFields: previousFields,
  });

  const { error: upErr } = await supabaseAdmin
    .from("skill_submissions")
    .update({
      status: "approved",
      reviewer_notes: notes ?? null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (upErr) throw new Error(upErr.message);
}

export async function rejectSubmission(
  id: string,
  reviewerId: string,
  notes?: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("skill_submissions")
    .update({
      status: "rejected",
      reviewer_notes: notes ?? null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Registry stats (real counts) ----

export type RegistryStats = {
  skills: number;
  servers: number;
  techniques: number;
  orgs: number;
  pending: number;
};

export async function getRegistryStats(): Promise<RegistryStats> {
  const [{ count: skills }, { count: servers }, { count: pending }, { data: rows }] =
    await Promise.all([
      supabaseAdmin.from("skills").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("skills")
        .select("id", { count: "exact", head: true })
        .eq("kind", "MCP server"),
      supabaseAdmin
        .from("skill_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin.from("skills").select("technique, org"),
    ]);
  const list = (rows ?? []) as { technique: string; org: string }[];
  return {
    skills: skills ?? 0,
    servers: servers ?? 0,
    pending: pending ?? 0,
    techniques: new Set(list.map((r) => r.technique)).size,
    orgs: new Set(list.map((r) => r.org)).size,
  };
}

// ---- Admin audit trail ----

export type ReviewAuditRow = {
  id: string;
  submission_id: string;
  submission_slug: string;
  submission_name: string;
  action: string;
  notes: string | null;
  reviewer_id: string;
  reviewer_email: string | null;
  created_at: string;
};

async function reviewerEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function recordReview(args: {
  submissionId: string;
  slug: string;
  name: string;
  action: "approve" | "reject";
  notes?: string | undefined;
  reviewerId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("submission_reviews").insert({
    submission_id: args.submissionId,
    submission_slug: args.slug,
    submission_name: args.name,
    action: args.action,
    notes: args.notes ?? null,
    reviewer_id: args.reviewerId,
    reviewer_email: await reviewerEmail(args.reviewerId),
  });
  if (error) throw new Error(error.message);
}

export async function listReviewAudit(limit = 50): Promise<ReviewAuditRow[]> {
  const { data, error } = await supabaseAdmin
    .from("submission_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewAuditRow[];
}

export async function getSubmissionById(id: string): Promise<SubmissionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("skill_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubmissionRow) ?? null;
}

export async function getSkillEndpoint(slug: string): Promise<{ repo: string; tool: string; endpoint: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select("repo, tool_call, mcp_endpoint")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { repo: string; tool_call: string; mcp_endpoint: string | null };
  return { repo: row.repo, tool: row.tool_call, endpoint: row.mcp_endpoint };
}

// ---- Review diff: pending submission vs what is currently published ----

export type SubmissionDiff = {
  slug: string;
  isNew: boolean;
  fields: { field: string; before: string | null; after: string | null; changed: boolean }[];
  beforeMd: string;
  afterMd: string;
};

const DIFF_FIELDS = [
  "name",
  "technique",
  "category",
  "kind",
  "version",
  "license",
  "runtime",
  "tool_call",
  "org",
  "repo",
  "summary",
  "description",
  "tags",
] as const;

export async function getSubmissionDiff(id: string): Promise<SubmissionDiff> {
  const { data: sub, error } = await supabaseAdmin
    .from("skill_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) throw new Error("Submission not found");
  const s = sub as SubmissionRow;

  const { data: live } = await supabaseAdmin
    .from("skills")
    .select("*")
    .eq("slug", s.slug)
    .maybeSingle();
  const current = (live ?? null) as (SkillRow & { skill_md?: string | null }) | null;

  const value = (row: Record<string, unknown> | null, field: string): string | null => {
    if (!row) return null;
    const v = row[field];
    if (v == null) return null;
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  };

  const fields = DIFF_FIELDS.map((field) => {
    const before = value(current as Record<string, unknown> | null, field);
    const after = value(s as unknown as Record<string, unknown>, field);
    return { field, before, after, changed: (before ?? "") !== (after ?? "") };
  });

  return {
    slug: s.slug,
    isNew: !current,
    fields,
    beforeMd: current?.skill_md ?? "",
    afterMd: s.skill_md ?? "",
  };
}

// ---- Version history ----

export type SkillVersionRow = {
  id: string;
  skill_slug: string;
  version: string;
  snapshot: Record<string, SnapshotValue>;
  skill_md: string | null;
  source_repo: string | null;
  source_sha: string | null;
  origin: string;
  change_summary: string | null;
  changed_fields: string[] | null;
  submission_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type SnapshotValue = string | number | boolean | null | string[];

const VERSIONED_FIELDS = [
  "name",
  "technique",
  "category",
  "kind",
  "summary",
  "description",
  "org",
  "repo",
  "version",
  "license",
  "runtime",
  "tool_call",
  "tags",
  "mcp_endpoint",
  "verified_badge",
  "skill_md",
] as const;

function normalizeValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** Field names whose value differs between the published row and the incoming one. */
export function diffChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): string[] {
  if (!before) return ["(new skill)"];
  return VERSIONED_FIELDS.filter(
    (f) => normalizeValue(before[f]) !== normalizeValue(after[f]),
  );
}

/** Writes an immutable snapshot of the currently published skill row. */
export async function recordSkillVersion(args: {
  slug: string;
  version: string;
  origin: "approval" | "sync" | "rollback";
  submissionId?: string | null;
  createdBy?: string | null;
  changedFields?: string[];
  changeSummary?: string | null;
}): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("skills")
    .select("*")
    .eq("slug", args.slug)
    .maybeSingle();
  if (!row) return;
  const r = row as Record<string, unknown>;

  const snapshot: Record<string, SnapshotValue> = {};
  for (const f of VERSIONED_FIELDS) snapshot[f] = (r[f] ?? null) as SnapshotValue;

  const changed = args.changedFields ?? [];
  const summary =
    args.changeSummary ??
    (changed.length === 0
      ? "No field changes"
      : changed[0] === "(new skill)"
        ? "First published version"
        : `${changed.length} field${changed.length === 1 ? "" : "s"} changed: ${changed.join(", ")}`);

  const { error } = await supabaseAdmin.from("skill_versions").insert({
    skill_slug: args.slug,
    version: args.version,
    snapshot: snapshot as unknown as never,
    skill_md: (r["skill_md"] as string | null) ?? null,
    source_repo: (r["repo"] as string | null) ?? null,
    source_sha: null,
    origin: args.origin,
    change_summary: summary,
    changed_fields: changed,
    submission_id: args.submissionId ?? null,
    created_by: args.createdBy ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function listSkillVersions(slug: string): Promise<SkillVersionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("skill_versions")
    .select("*")
    .eq("skill_slug", slug)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillVersionRow[];
}

/** Slugs that have history, with their entry count, for the admin picker. */
export async function listVersionedSkills(): Promise<
  { slug: string; name: string; version: string; entries: number; lastChange: string }[]
> {
  const { data, error } = await supabaseAdmin
    .from("skill_versions")
    .select("skill_slug, version, created_at, snapshot")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const map = new Map<string, { slug: string; name: string; version: string; entries: number; lastChange: string }>();
  for (const raw of data ?? []) {
    const row = raw as {
      skill_slug: string;
      version: string;
      created_at: string;
      snapshot: Record<string, SnapshotValue>;
    };
    const existing = map.get(row.skill_slug);
    if (existing) {
      existing.entries += 1;
      continue;
    }
    map.set(row.skill_slug, {
      slug: row.skill_slug,
      name: String(row.snapshot?.["name"] ?? row.skill_slug),
      version: row.version,
      entries: 1,
      lastChange: row.created_at,
    });
  }
  return [...map.values()];
}

/** Restores a historical snapshot onto the live skill and logs the rollback. */
export async function rollbackSkillToVersion(
  versionId: string,
  reviewerId: string,
): Promise<{ slug: string; version: string }> {
  const { data, error } = await supabaseAdmin
    .from("skill_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Version not found");
  const v = data as SkillVersionRow;

  const { data: liveRow } = await supabaseAdmin
    .from("skills")
    .select("*")
    .eq("slug", v.skill_slug)
    .maybeSingle();
  if (!liveRow) throw new Error("That skill is no longer published.");

  const changed = diffChangedFields(
    liveRow as Record<string, unknown>,
    v.snapshot,
  );
  if (changed.length === 0) {
    throw new Error("That version is identical to what is currently published.");
  }

  const patch: Record<string, SnapshotValue> = {};
  for (const f of VERSIONED_FIELDS) {
    if (f in v.snapshot) patch[f] = v.snapshot[f] ?? null;
  }
  patch["updated_at"] = new Date().toISOString().slice(0, 10);

  const { error: upErr } = await supabaseAdmin
    .from("skills")
    .update(patch as never)
    .eq("slug", v.skill_slug);
  if (upErr) throw new Error(upErr.message);

  await recordSkillVersion({
    slug: v.skill_slug,
    version: v.version,
    origin: "rollback",
    createdBy: reviewerId,
    changedFields: changed,
    changeSummary: `Rolled back to the ${new Date(v.created_at).toISOString().slice(0, 16).replace("T", " ")} snapshot (v${v.version}) — restored: ${changed.join(", ")}`,
  });

  return { slug: v.skill_slug, version: v.version };
}

// ---- Real GitHub star counts ----

/**
 * Pulls the live stargazer count for every distinct source repository and
 * writes it onto the published skills, so the UI never shows made-up numbers.
 */
export async function refreshSkillStars(): Promise<{ repo: string; stars: number }[]> {
  const { data, error } = await supabaseAdmin.from("skills").select("repo");
  if (error) throw new Error(error.message);
  const repos = [...new Set((data ?? []).map((r) => (r as { repo: string }).repo))];

  const results: { repo: string; stars: number }[] = [];
  for (const repo of repos) {
    const path = repo
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "");
    try {
      const res = await fetch(`https://api.github.com/repos/${path}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "emskills-registry" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { stargazers_count?: number };
      const stars = Number(json.stargazers_count ?? 0);
      await supabaseAdmin.from("skills").update({ stars }).eq("repo", repo);
      results.push({ repo, stars });
    } catch (e) {
      console.error("star refresh failed for", repo, e);
    }
  }
  return results;
}
