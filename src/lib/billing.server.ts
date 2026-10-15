// Server-only API-key, usage and publisher-verification helpers.
// Imported ONLY inside server-function handlers or server routes.
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};


export type RunRow = {
  id: string;
  skill_slug: string;
  tool_call: string | null;
  mode: string;
  status: string;
  duration_ms: number;
  created_at: string;
};

export type VerificationRow = {
  id: string;
  user_id: string;
  org: string;
  contact_email: string;
  evidence_url: string | null;
  notes: string | null;
  status: string;
  badge: string;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type CertifiedPublisher = {
  org: string;
  badge: "verified" | "certified";
  skills: { slug: string; name: string; technique: string }[];
};

// ---------- API keys ----------

export function hashKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function mintKey(): { secret: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const secret = `ems_live_${raw}`;
  return { secret, prefix: secret.slice(0, 12), hash: hashKey(secret) };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiKeyRow[];
}

export async function createApiKeyRow(userId: string, name: string) {
  const { secret, prefix, hash } = mintKey();
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({ user_id: userId, name, key_prefix: prefix, key_hash: hash })
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { key: data as ApiKeyRow, secret };
}

export async function revokeApiKeyRow(userId: string, id: string) {
  const { error } = await supabaseAdmin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Rotation = revoke the old secret and mint a fresh one under the same name,
 * so agents can be re-pointed without losing the key's identity in the list.
 */
export async function rotateApiKeyRow(userId: string, id: string) {
  const { data: old, error: readErr } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, revoked_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!old) throw new Error("Key not found.");
  if (old.revoked_at) throw new Error("Key is already revoked — create a new one instead.");

  await revokeApiKeyRow(userId, id);
  return createApiKeyRow(userId, old.name);
}

/**
 * Fair-use ceilings for the free platform. These are abuse guards, not a paid
 * plan: nothing is charged and nothing is sold when they are reached.
 */
export const FAIR_USE = {
  monthlyRuns: 10_000,
  requestsPerMinute: 60,
  activeKeys: 10,
} as const;

/** Runs used in the current calendar month, against the fair-use ceiling. */
export async function getMonthlyQuota(userId: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const { count, error } = await supabaseAdmin
    .from("mcp_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  if (error) throw new Error(error.message);
  const used = count ?? 0;
  return {
    used,
    limit: FAIR_USE.monthlyRuns,
    remaining: Math.max(0, FAIR_USE.monthlyRuns - used),
    requestsPerMinute: FAIR_USE.requestsPerMinute,
    activeKeyLimit: FAIR_USE.activeKeys,
    periodStart: start.toISOString().slice(0, 10),
    resetsAt: resetsAt.toISOString().slice(0, 10),
  };
}

/** Resolves an inbound `ems_live_*` key to its owner, constant-time on the hash. */
export async function resolveApiKey(secret: string) {
  const hash = hashKey(secret);
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, key_hash, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!data) return null;
  const a = Buffer.from(data.key_hash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (data.revoked_at) return null;
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { id: data.id as string, userId: data.user_id as string };
}

// ---------- Usage ----------

export async function logRun(entry: {
  userId: string | null;
  apiKeyId?: string | null;
  skillSlug: string;
  toolCall: string;
  mode: string;
  status: string;
  durationMs: number;
  error?: string | null;
}) {
  await supabaseAdmin.from("mcp_runs").insert({
    user_id: entry.userId,
    api_key_id: entry.apiKeyId ?? null,
    skill_slug: entry.skillSlug,
    tool_call: entry.toolCall,
    mode: entry.mode,
    status: entry.status,
    duration_ms: entry.durationMs,
    error: entry.error ?? null,
  });
}

export type UsageSeries = { day: string; runs: number; errors: number }[];

export async function getUsage(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("mcp_runs")
    .select("id, skill_slug, tool_call, mode, status, duration_ms, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RunRow[];

  const byDay = new Map<string, { runs: number; errors: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { runs: 0, errors: 0 });
  }
  let totalMs = 0;
  const bySkill = new Map<string, number>();
  const byEndpoint = new Map<string, { runs: number; errors: number; ms: number }>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    const bucket = byDay.get(d);
    if (bucket) {
      bucket.runs += 1;
      if (r.status !== "ok") bucket.errors += 1;
    }
    totalMs += r.duration_ms;
    bySkill.set(r.skill_slug, (bySkill.get(r.skill_slug) ?? 0) + 1);

    const endpoint = `${r.skill_slug}/${r.tool_call ?? "—"}`;
    const e = byEndpoint.get(endpoint) ?? { runs: 0, errors: 0, ms: 0 };
    e.runs += 1;
    if (r.status !== "ok") e.errors += 1;
    e.ms += r.duration_ms;
    byEndpoint.set(endpoint, e);
  }

  return {
    series: [...byDay.entries()].map(([day, v]) => ({ day, ...v })) as UsageSeries,
    recent: rows.slice(0, 20),
    totals: {
      runs: rows.length,
      errors: rows.filter((r) => r.status !== "ok").length,
      avgMs: rows.length ? Math.round(totalMs / rows.length) : 0,
    },
    topSkills: [...bySkill.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug, runs]) => ({ slug, runs })),
    topEndpoints: [...byEndpoint.entries()]
      .sort((a, b) => b[1].runs - a[1].runs)
      .slice(0, 8)
      .map(([endpoint, v]) => ({
        endpoint,
        slug: endpoint.split("/")[0]!,
        tool: endpoint.slice(endpoint.indexOf("/") + 1),
        runs: v.runs,
        errors: v.errors,
        avgMs: Math.round(v.ms / v.runs),
      })),
  };
}

/**
 * Per-key activity: run counts, error counts, latency and last-used time,
 * plus the most recent individual runs attributed to each key.
 */
export async function getApiKeyActivity(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [keys, runs] = await Promise.all([
    listApiKeys(userId),
    supabaseAdmin
      .from("mcp_runs")
      .select("id, api_key_id, skill_slug, tool_call, mode, status, duration_ms, error, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const rows = (runs.data ?? []) as (RunRow & { api_key_id: string | null; error: string | null })[];

  const agg = new Map<string, { runs: number; errors: number; ms: number; lastRunAt: string | null }>();
  for (const r of rows) {
    const id = r.api_key_id ?? "unattributed";
    const a = agg.get(id) ?? { runs: 0, errors: 0, ms: 0, lastRunAt: null };
    a.runs += 1;
    if (r.status !== "ok") a.errors += 1;
    a.ms += r.duration_ms;
    if (!a.lastRunAt || r.created_at > a.lastRunAt) a.lastRunAt = r.created_at;
    agg.set(id, a);
  }

  const perKey = keys.map((k) => {
    const a = agg.get(k.id);
    return {
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      revokedAt: k.revoked_at,
      createdAt: k.created_at,
      runs: a?.runs ?? 0,
      errors: a?.errors ?? 0,
      avgMs: a && a.runs ? Math.round(a.ms / a.runs) : 0,
      // last_used_at is stamped on every authenticated call, even ones that
      // never reach a run; fall back to it when there is no logged run.
      lastUsedAt: a?.lastRunAt ?? k.last_used_at,
    };
  });

  const nameById = new Map(keys.map((k) => [k.id, k.name] as const));
  const events = rows.slice(0, 25).map((r) => ({
    id: r.id,
    keyId: r.api_key_id,
    keyName: r.api_key_id ? (nameById.get(r.api_key_id) ?? "deleted key") : "session (no key)",
    skillSlug: r.skill_slug,
    toolCall: r.tool_call,
    status: r.status,
    durationMs: r.duration_ms,
    error: r.error,
    createdAt: r.created_at,
  }));

  const unattributed = agg.get("unattributed");
  return {
    days,
    perKey,
    events,
    unattributedRuns: unattributed?.runs ?? 0,
  };
}

// ---------- Publisher verification ----------

export async function getVerification(userId: string): Promise<VerificationRow | null> {
  const { data } = await supabaseAdmin
    .from("publisher_verifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as VerificationRow) ?? null;
}

export async function requestVerificationRow(args: {
  userId: string;
  org: string;
  contactEmail: string;
  evidenceUrl?: string | undefined;
  notes?: string | undefined;
}) {
  const existing = await getVerification(args.userId);
  if (existing && existing.status === "pending") {
    return { ok: false as const, message: "You already have a verification request under review." };
  }
  const { error } = await supabaseAdmin.from("publisher_verifications").insert({
    user_id: args.userId,
    org: args.org,
    contact_email: args.contactEmail,
    evidence_url: args.evidenceUrl ?? null,
    notes: args.notes ?? null,
  });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, message: "Verification request submitted — reviews take 2–3 business days." };
}

export async function listPendingVerifications(): Promise<VerificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("publisher_verifications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VerificationRow[];
}

export async function reviewVerificationRow(args: {
  id: string;
  reviewerId: string;
  action: "approve" | "reject";
  badge?: "verified" | "certified";
  notes?: string;
}): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("publisher_verifications")
    .select("id, user_id, org, status")
    .eq("id", args.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Certification request not found.");
  if (data.status !== "pending") throw new Error("This certification request was already reviewed.");

  const badge = args.action === "approve" ? (args.badge ?? "verified") : "community";
  const { error: updateError } = await supabaseAdmin
    .from("publisher_verifications")
    .update({
      status: args.action === "approve" ? "verified" : "rejected",
      badge,
      reviewer_notes: args.notes ?? null,
      reviewed_by: args.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", args.id);
  if (updateError) throw new Error(updateError.message);

  const { error: skillError } = await supabaseAdmin
    .from("skills")
    .update({ verified_badge: badge })
    .eq("submitted_by", data.user_id);
  if (skillError) throw new Error(skillError.message);
}

export async function listCertifiedPublishers(): Promise<CertifiedPublisher[]> {
  const { data: verifications, error } = await supabaseAdmin
    .from("publisher_verifications")
    .select("user_id, org, badge, reviewed_at")
    .eq("status", "verified")
    .in("badge", ["verified", "certified"])
    .order("reviewed_at", { ascending: false });
  if (error) throw new Error(error.message);

  const latestByUser = new Map<string, { userId: string; org: string; badge: "verified" | "certified" }>();
  for (const row of verifications ?? []) {
    if (!latestByUser.has(row.user_id)) {
      latestByUser.set(row.user_id, {
        userId: row.user_id,
        org: row.org,
        badge: row.badge === "certified" ? "certified" : "verified",
      });
    }
  }
  if (latestByUser.size === 0) return [];

  const { data: skills, error: skillsError } = await supabaseAdmin
    .from("skills")
    .select("slug, name, technique, submitted_by")
    .in("submitted_by", [...latestByUser.keys()])
    .order("name", { ascending: true });
  if (skillsError) throw new Error(skillsError.message);

  return [...latestByUser.values()].map((publisher) => ({
    org: publisher.org,
    badge: publisher.badge,
    skills: (skills ?? [])
      .filter((skill) => skill.submitted_by === publisher.userId)
      .map((skill) => ({ slug: skill.slug, name: skill.name, technique: skill.technique })),
  }));
}


/** Resolves a Supabase access token to a user id, or null. Never throws. */
export async function userFromBearer(token: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}
