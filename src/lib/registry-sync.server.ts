// Server-only: imports skills from the GitHub registry repository into the
// moderated review queue. Imported ONLY inside createServerFn handlers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { techniques, categories } from "@/data/skills";
import {
  REGISTRY_PATH_PREFIX,
  REGISTRY_REPO,
  REQUIRED_SECTIONS,
} from "@/lib/skill-template";

export type RegistrySource = {
  id: string;
  repo: string;
  branch: string;
  path_prefix: string;
  last_synced_at: string | null;
  last_sync_summary: string | null;
  created_by: string | null;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_webhook_at: string | null;
};

export type SyncItem = {
  slug: string;
  path: string;
  status: "queued" | "updated" | "unchanged" | "published" | "error";
  message?: string;
  problems?: string[];
};

export type SyncResult = {
  repo: string;
  branch: string;
  scanned: number;
  items: SyncItem[];
  note?: string;
};

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "emskills-registry",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function gh<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404) {
      throw new Error(
        `Repository or branch not found (404). Check the owner/name and branch, and that the repo is public or GITHUB_TOKEN has access.`,
      );
    }
    if (res.status === 403 && body.includes("rate limit")) {
      throw new Error(
        "GitHub rate limit reached for anonymous requests. Add a GITHUB_TOKEN secret to raise the limit.",
      );
    }
    throw new Error(`GitHub request failed [${res.status}] ${url}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function normalizeRepoInput(input: string): string {
  let s = input.trim();
  s = s
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Repository must be a GitHub URL or owner/name (e.g. ${REGISTRY_REPO}).`);
  }
  const ok = /^[A-Za-z0-9._-]+$/;
  if (!ok.test(parts[0]!) || !ok.test(parts[1]!)) {
    throw new Error("Repository owner/name contains invalid characters.");
  }
  return `${parts[0]}/${parts[1]}`;
}

// ---- Source config ----

export async function getRegistrySource(): Promise<RegistrySource | null> {
  const { data, error } = await supabaseAdmin
    .from("registry_sources")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RegistrySource) ?? null;
}

export async function setRegistrySource(args: {
  repo: string;
  branch?: string | undefined;
  pathPrefix?: string | undefined;
  autoSyncEnabled?: boolean | undefined;
  syncIntervalMinutes?: number | undefined;
  userId: string;
}): Promise<RegistrySource> {
  const repo = normalizeRepoInput(args.repo);
  const meta = await gh<{ default_branch: string; private: boolean }>(
    `https://api.github.com/repos/${repo}`,
  );
  const branch = args.branch?.trim() || meta.default_branch || "main";
  const pathPrefix = (args.pathPrefix?.trim() || REGISTRY_PATH_PREFIX).replace(
    /^\/+|\/+$/g,
    "",
  );

  const existing = await getRegistrySource();
  const payload = {
    repo,
    branch,
    path_prefix: pathPrefix,
    created_by: args.userId,
    updated_at: new Date().toISOString(),
    ...(args.autoSyncEnabled !== undefined
      ? { auto_sync_enabled: args.autoSyncEnabled }
      : {}),
    ...(args.syncIntervalMinutes !== undefined
      ? {
          sync_interval_minutes: Math.max(
            15,
            Math.min(10080, Math.round(args.syncIntervalMinutes)),
          ),
        }
      : {}),
  };

  const query = existing
    ? supabaseAdmin
        .from("registry_sources")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : supabaseAdmin.from("registry_sources").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as RegistrySource;
}

// ---- Parsing + strict validation ----

type Parsed = {
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
  tags: string[];
  mcp_endpoint: string | null;
};

/** Minimal YAML front-matter reader: scalars, folded blocks and lists. */
export function parseFrontMatter(md: string): Record<string, string | string[]> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md.trimStart());
  if (!match) return {};
  const out: Record<string, string | string[]> = {};
  const lines = match[1]!.split(/\r?\n/);
  let currentKey: string | null = null;
  let folding: { key: string; parts: string[] } | null = null;

  const flushFold = () => {
    if (folding) {
      out[folding.key] = folding.parts.join(" ").replace(/\s+/g, " ").trim();
      folding = null;
    }
  };

  for (const line of lines) {
    if (folding) {
      if (/^\s{2,}\S/.test(line)) {
        folding.parts.push(line.trim());
        continue;
      }
      flushFold();
    }
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      const prev = out[currentKey];
      const arr = Array.isArray(prev) ? prev : [];
      arr.push(unquote(listItem[1]!));
      out[currentKey] = arr;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1]!.toLowerCase();
    const raw = kv[2]!.trim();
    currentKey = key;
    if (raw === ">" || raw === "|" || raw === ">-" || raw === "|-") {
      folding = { key, parts: [] };
    } else if (!raw) {
      out[key] = [];
    } else if (raw.startsWith("[") && raw.endsWith("]")) {
      out[key] = raw
        .slice(1, -1)
        .split(",")
        .map((v) => unquote(v.trim()))
        .filter(Boolean);
    } else {
      out[key] = unquote(raw);
    }
  }
  flushFold();
  return out;
}

function unquote(v: string) {
  return v.replace(/^['"]|['"]$/g, "").trim();
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(", ");
  return "";
}

function firstParagraph(md: string): string {
  const body = md.replace(/^---[\s\S]*?---/, "");
  const para = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith("#") && !p.startsWith("```"));
  return (para ?? "").replace(/\s+/g, " ").slice(0, 600);
}

const TECHNIQUE_CODES = techniques.map((t) => t.code as string);
const CATEGORY_NAMES = categories.map((c) => c.name);

function matchEnum(value: string, allowed: string[]): string | null {
  const v = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const hit = allowed.find((a) => a.toLowerCase().replace(/[\s_-]+/g, "") === v);
  return hit ?? null;
}

export type ValidationOutcome =
  | { ok: true; parsed: Parsed; warnings: string[] }
  | { ok: false; problems: string[] };

/**
 * Strict validator for an imported SKILL.md. Returns every problem at once with
 * the field name and what a fix looks like, so contributors can fix one commit.
 */
export function validateSkillFolder(args: {
  slug: string;
  markdown: string;
  json: Record<string, unknown> | null;
  sourceRepo: string;
  path: string;
}): ValidationOutcome {
  const problems: string[] = [];
  const warnings: string[] = [];

  const trimmed = args.markdown.trim();
  if (!trimmed) {
    return { ok: false, problems: [`${args.path} is empty.`] };
  }
  if (!/^---\r?\n/.test(trimmed)) {
    return {
      ok: false,
      problems: [
        "Missing YAML front matter. SKILL.md must start with a '---' line, the metadata keys, then a closing '---'.",
      ],
    };
  }

  const fm = parseFrontMatter(args.markdown);
  const j = args.json ?? {};
  const pick = (key: string, ...alts: string[]): string => {
    for (const k of [key, ...alts]) {
      const fromJson = j[k];
      if (typeof fromJson === "string" && fromJson.trim()) return fromJson.trim();
      const s = str(fm[k]).trim();
      if (s) return s;
    }
    return "";
  };

  // slug
  const declaredSlug = pick("slug").toLowerCase();
  if (!declaredSlug) {
    problems.push(`slug: missing. Add "slug: ${args.slug}" (must match the folder name).`);
  } else if (declaredSlug !== args.slug) {
    problems.push(
      `slug: "${declaredSlug}" does not match the folder name "${args.slug}". Rename the folder or fix the slug.`,
    );
  }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(args.slug)) {
    problems.push(
      `slug: "${args.slug}" must be lowercase kebab-case, 3–50 characters, letters/digits/hyphens only.`,
    );
  }

  // name
  const name = pick("name", "title");
  if (!name) problems.push('name: missing. Add a human-readable name, e.g. "Cryo-EM 2D class triage".');
  else if (name.length > 80) problems.push(`name: ${name.length} characters — keep it under 80.`);

  // technique
  const techniqueRaw = pick("technique", "modality");
  let technique = "";
  if (!techniqueRaw) {
    problems.push(`technique: missing. Use one of: ${TECHNIQUE_CODES.join(", ")}.`);
  } else {
    const hit = matchEnum(techniqueRaw, TECHNIQUE_CODES);
    if (!hit) {
      problems.push(
        `technique: "${techniqueRaw}" is not a registry technique. Use one of: ${TECHNIQUE_CODES.join(", ")}.`,
      );
    } else {
      technique = hit;
      if (hit !== techniqueRaw) warnings.push(`technique normalised to "${hit}".`);
    }
  }

  // category
  const categoryRaw = pick("category");
  let category = "";
  if (!categoryRaw) {
    problems.push(`category: missing. Use one of: ${CATEGORY_NAMES.join(", ")}.`);
  } else {
    const hit = matchEnum(categoryRaw, CATEGORY_NAMES);
    if (!hit) {
      problems.push(
        `category: "${categoryRaw}" is not a registry category. Use one of: ${CATEGORY_NAMES.join(", ")}.`,
      );
    } else {
      category = hit;
      if (hit !== categoryRaw) warnings.push(`category normalised to "${hit}".`);
    }
  }

  // kind
  const kindRaw = pick("kind", "type");
  let kind = "";
  if (!kindRaw) {
    problems.push('kind: missing. Use "MCP server" or "SKILL.md".');
  } else if (/mcp/i.test(kindRaw)) {
    kind = "MCP server";
  } else if (/skill/i.test(kindRaw)) {
    kind = "SKILL.md";
  } else {
    problems.push(`kind: "${kindRaw}" is not recognised. Use "MCP server" or "SKILL.md".`);
  }

  // summary
  const summary = pick("summary") || firstParagraph(args.markdown);
  if (!summary) {
    problems.push("summary: missing. Add a one-sentence summary (20–200 characters).");
  } else if (summary.length < 20) {
    problems.push(`summary: only ${summary.length} characters — write at least 20.`);
  } else if (summary.length > 200) {
    problems.push(`summary: ${summary.length} characters — trim to 200 or fewer.`);
  }

  // version
  const version = pick("version");
  if (!version) problems.push('version: missing. Add a semantic version such as "0.1.0".');
  else if (!/^v?\d+\.\d+(\.\d+)?([-+][\w.]+)?$/.test(version)) {
    problems.push(`version: "${version}" is not semantic. Use MAJOR.MINOR.PATCH, e.g. 0.1.0.`);
  }

  // license
  const license = pick("license");
  if (!license) {
    problems.push('license: missing. Add an SPDX id such as "MIT" or "Apache-2.0".');
  } else if (/^(unspecified|none|tbd)$/i.test(license)) {
    problems.push(`license: "${license}" is not acceptable. Use a real SPDX id such as MIT.`);
  }

  // runtime
  const runtime = pick("runtime");
  if (!runtime) {
    problems.push('runtime: missing. Add the execution environment, e.g. "python 3.11".');
  }

  // tool_call
  const toolCall = pick("tool_call", "toolcall", "tool");
  if (!toolCall) {
    problems.push(
      `tool_call: missing. Add the canonical tool name agents invoke, e.g. "${args.slug.replace(/-/g, "_")}".`,
    );
  } else if (!/^[a-z][a-z0-9_]{1,60}$/.test(toolCall)) {
    problems.push(`tool_call: "${toolCall}" must be snake_case (lowercase letters, digits, underscores).`);
  }

  // mcp endpoint
  const endpointRaw = pick("mcp_endpoint", "endpoint");
  let mcpEndpoint: string | null = null;
  if (endpointRaw) {
    if (!/^https:\/\//i.test(endpointRaw)) {
      problems.push(`mcp_endpoint: "${endpointRaw}" must be an https:// URL.`);
    } else {
      mcpEndpoint = endpointRaw;
    }
  } else if (kind === "MCP server") {
    warnings.push("no mcp_endpoint declared — the skill page will not offer a hosted run.");
  }

  // body sections
  const body = args.markdown.replace(/^---[\s\S]*?---/, "");
  for (const section of REQUIRED_SECTIONS) {
    const re = new RegExp(`^#{1,3}\\s*${section}\\b`, "im");
    if (!re.test(body)) {
      problems.push(`body: missing a "## ${section}" section.`);
    }
  }
  if (body.replace(/\s+/g, " ").trim().length < 120) {
    problems.push("body: too short — document scope, safety and usage in prose.");
  }

  // tags
  const tagsRaw = (Array.isArray(j["tags"]) ? (j["tags"] as unknown[]) : fm["tags"]) ?? [];
  const tags = (Array.isArray(tagsRaw) ? tagsRaw : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
  if (tags.length === 0) warnings.push("no tags declared — discovery will be weaker.");

  if (problems.length) return { ok: false, problems };

  const parsed: Parsed = {
    slug: args.slug,
    name,
    technique,
    kind,
    summary,
    description: pick("description") || firstParagraph(args.markdown) || summary,
    org: pick("org", "organisation", "organization", "publisher") || args.sourceRepo.split("/")[0]!,
    repo: pick("repo", "repository") || args.sourceRepo,
    version: version.replace(/^v/, ""),
    license,
    runtime,
    tool_call: toolCall,
    category,
    tags,
    mcp_endpoint: mcpEndpoint,
  };
  return { ok: true, parsed, warnings };
}

// ---- Sync ----

type TreeEntry = { path: string; type: string; sha: string };

/**
 * Scans `<pathPrefix>/<slug>/SKILL.md` folders in the source repo and creates
 * or refreshes a pending submission for each one. Nothing is published here —
 * approval still happens in the review queue.
 */
export async function syncRegistryRepo(args: {
  reviewerId: string;
  onlySlugs?: string[] | undefined;
}): Promise<SyncResult> {
  const source = await getRegistrySource();
  if (!source) {
    throw new Error("No registry repository configured yet. Set one first.");
  }
  const { repo, branch, path_prefix: prefix } = source;

  let tree: { tree: TreeEntry[] } = { tree: [] };
  let note: string | undefined;
  try {
    tree = await gh<{ tree: TreeEntry[] }>(
      `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/409/.test(msg) || /empty/i.test(msg)) {
      note = `${repo} has no commits yet — push a first skill folder under "${prefix}/" and sync again.`;
    } else {
      throw e;
    }
  }

  const pattern = new RegExp(
    `^${prefix ? `${prefix}/` : ""}([A-Za-z0-9._-]+)/(SKILL\\.md|skill\\.md)$`,
  );
  const folders = tree.tree
    .filter((e) => e.type === "blob")
    .map((e) => ({ entry: e, m: pattern.exec(e.path) }))
    .filter((x): x is { entry: TreeEntry; m: RegExpExecArray } => Boolean(x.m))
    .filter((x) => !args.onlySlugs || args.onlySlugs.includes(x.m[1]!));

  if (!note && folders.length === 0 && tree.tree.length > 0) {
    const strays = tree.tree.filter((e) => /SKILL\.md$/i.test(e.path)).map((e) => e.path);
    note = strays.length
      ? `Found SKILL.md outside the expected layout: ${strays
          .slice(0, 5)
          .join(", ")}. Each skill needs "${prefix}/<slug>/SKILL.md".`
      : `No SKILL.md files found. Expected "${prefix}/<slug>/SKILL.md" on branch ${branch}.`;
  }

  const items: SyncItem[] = [];

  for (const { entry, m } of folders) {
    const slug = m[1]!.toLowerCase();
    try {
      const { data: existingSkill } = await supabaseAdmin
        .from("skills")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();

      const { data: openSub } = await supabaseAdmin
        .from("skill_submissions")
        .select("id, source_sha")
        .eq("source_repo", repo)
        .eq("source_path", entry.path)
        .eq("status", "pending")
        .maybeSingle();

      if (openSub && (openSub as { source_sha: string | null }).source_sha === entry.sha) {
        items.push({ slug, path: entry.path, status: "unchanged" });
        continue;
      }

      const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path}`;
      const mdRes = await fetch(rawUrl, { headers: ghHeaders() });
      if (!mdRes.ok) throw new Error(`Could not read ${entry.path} (${mdRes.status}).`);
      const markdown = (await mdRes.text()).slice(0, 200_000);

      const jsonUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path.replace(
        /(SKILL|skill)\.md$/,
        "skill.json",
      )}`;
      let json: Record<string, unknown> | null = null;
      const jsonRes = await fetch(jsonUrl, { headers: ghHeaders() });
      if (jsonRes.ok) {
        const text = await jsonRes.text();
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          items.push({
            slug,
            path: entry.path,
            status: "error",
            message: "skill.json is present but is not valid JSON.",
          });
          continue;
        }
      }

      const outcome = validateSkillFolder({
        slug,
        markdown,
        json,
        sourceRepo: repo,
        path: entry.path,
      });
      if (!outcome.ok) {
        items.push({
          slug,
          path: entry.path,
          status: "error",
          message: `${outcome.problems.length} validation problem${outcome.problems.length === 1 ? "" : "s"}.`,
          problems: outcome.problems,
        });
        continue;
      }

      const payload = {
        ...outcome.parsed,
        submitter_id: args.reviewerId,
        status: "pending",
        source: "repo",
        source_repo: repo,
        source_path: entry.path,
        source_sha: entry.sha,
        skill_md: markdown,
      };

      if (openSub) {
        const { error } = await supabaseAdmin
          .from("skill_submissions")
          .update(payload)
          .eq("id", (openSub as { id: string }).id);
        if (error) throw new Error(error.message);
        items.push({
          slug,
          path: entry.path,
          status: "updated",
          ...(outcome.warnings.length ? { problems: outcome.warnings } : {}),
        });
      } else {
        const { data: created, error } = await supabaseAdmin
          .from("skill_submissions")
          .insert(payload)
          .select("id, slug, name, technique, kind, org, repo")
          .single();
        if (error) throw new Error(error.message);
        // Repo-sourced submissions land in the same queue — tell admins too.
        try {
          const { notifyAdminsOfSubmission } = await import("@/lib/notify.server");
          await notifyAdminsOfSubmission({
            id: created.id,
            slug: created.slug,
            name: created.name,
            technique: created.technique,
            kind: created.kind,
            org: created.org,
            repo: created.repo,
            origin: `repository sync — ${repo}`,
          });
        } catch (e) {
          console.error("sync submission notification failed", e);
        }
        items.push({
          slug,
          path: entry.path,
          status: existingSkill ? "published" : "queued",
          ...(existingSkill
            ? { message: "Already published — queued as an update for review." }
            : {}),
          ...(outcome.warnings.length ? { problems: outcome.warnings } : {}),
        });
      }
    } catch (e) {
      items.push({
        slug,
        path: entry.path,
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const summary = `${items.filter((i) => i.status === "queued").length} new, ${
    items.filter((i) => i.status === "updated").length
  } updated, ${items.filter((i) => i.status === "unchanged").length} unchanged, ${
    items.filter((i) => i.status === "error").length
  } failed`;

  // Keep published star counts in sync with the real GitHub repositories.
  try {
    const { refreshSkillStars } = await import("@/lib/db.server");
    await refreshSkillStars();
  } catch (e) {
    console.error("star refresh failed", e);
  }

  await supabaseAdmin
    .from("registry_sources")
    .update({ last_synced_at: new Date().toISOString(), last_sync_summary: summary })
    .eq("id", source.id);


  return { repo, branch, scanned: folders.length, items, ...(note ? { note } : {}) };
}

/** Runs a sync only when auto-sync is on and the interval has elapsed. */
export async function syncIfDue(): Promise<
  { ran: false; reason: string } | ({ ran: true } & SyncResult)
> {
  const source = await getRegistrySource();
  if (!source) return { ran: false, reason: "no source configured" };
  if (!source.auto_sync_enabled) return { ran: false, reason: "auto-sync disabled" };

  const last = source.last_synced_at ? new Date(source.last_synced_at).getTime() : 0;
  const dueAt = last + source.sync_interval_minutes * 60_000;
  if (Date.now() < dueAt) {
    return { ran: false, reason: `next sync due ${new Date(dueAt).toISOString()}` };
  }
  const result = await syncRegistryRepo({
    reviewerId: source.created_by ?? "00000000-0000-0000-0000-000000000000",
  });
  return { ran: true, ...result };
}

// ---- Webhook status ----

export type WebhookDelivery = {
  id: string;
  delivery_id: string | null;
  event: string | null;
  repo: string | null;
  ref: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

export async function recordWebhookDelivery(row: {
  deliveryId?: string | null;
  event?: string | null;
  repo?: string | null;
  ref?: string | null;
  status: string;
  message?: string | null;
}) {
  await supabaseAdmin.from("webhook_deliveries").insert({
    provider: "github",
    delivery_id: row.deliveryId ?? null,
    event: row.event ?? null,
    repo: row.repo ?? null,
    ref: row.ref ?? null,
    status: row.status,
    message: row.message ?? null,
  });
}

export async function getWebhookStatus(): Promise<{
  secretConfigured: boolean;
  tokenConfigured: boolean;
  cronSecretConfigured: boolean;
  deliveries: WebhookDelivery[];
  lastWebhookAt: string | null;
}> {
  const source = await getRegistrySource();
  const { data, error } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, delivery_id, event, repo, ref, status, message, created_at")
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw new Error(error.message);
  return {
    secretConfigured: Boolean(process.env["GITHUB_WEBHOOK_SECRET"]),
    tokenConfigured: Boolean(process.env["GITHUB_TOKEN"]),
    cronSecretConfigured: Boolean(process.env["LOVABLE_CRON_SECRET"]),
    deliveries: (data ?? []) as WebhookDelivery[],
    lastWebhookAt: source?.last_webhook_at ?? null,
  };
}
