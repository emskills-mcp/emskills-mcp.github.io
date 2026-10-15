// Server-only GitHub verification helpers for the submission queue.
// Imported ONLY from inside createServerFn handlers.

export type RepoCheck = {
  repo: string; // normalized "owner/name"
  owner: string;
  name: string;
  defaultBranch: string;
  skillMdPath: string;
  skillMdUrl: string;
  htmlUrl: string;
};

/** Accepts "owner/name", "github.com/owner/name", or a full https URL. */
export function normalizeRepo(input: string): { owner: string; name: string } {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^github\.com\//i, "");
  s = s.replace(/\.git$/i, "").replace(/\/+$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      "Repository must be a GitHub URL or owner/name (e.g. volvox-lab/cryo2d).",
    );
  }
  const [owner, name] = parts;
  const ok = /^[A-Za-z0-9._-]+$/;
  if (!ok.test(owner!) || !ok.test(name!)) {
    throw new Error("Repository owner/name contains invalid characters.");
  }
  return { owner: owner!, name: name! };
}

const CANDIDATE_PATHS = ["SKILL.md", "skill.md", ".github/SKILL.md", "docs/SKILL.md"];

/**
 * Monorepo registries keep one folder per skill, so a repo-root SKILL.md is
 * often absent. When a slug is known, try its folder first.
 */
function candidatePaths(slug?: string): string[] {
  if (!slug) return CANDIDATE_PATHS;
  const s = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!s || !/^[A-Za-z0-9._-]+$/.test(s)) return CANDIDATE_PATHS;
  return [
    `skills/${s}/SKILL.md`,
    `${s}/SKILL.md`,
    `skills/${s}/skill.md`,
    ...CANDIDATE_PATHS,
  ];
}

async function gh(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "emskills-registry",
    },
  });
}

/**
 * Verifies the repository exists, is public, and contains a SKILL.md.
 * Throws a user-facing Error when it does not.
 */
export async function verifyGitHubSkillRepo(
  input: string,
  slug?: string,
): Promise<RepoCheck> {
  const { owner, name } = normalizeRepo(input);

  const repoRes = await gh(`https://api.github.com/repos/${owner}/${name}`);
  if (repoRes.status === 404) {
    throw new Error(
      `GitHub repository ${owner}/${name} was not found, or it is private. The registry only accepts public repositories.`,
    );
  }
  if (repoRes.status === 403 || repoRes.status === 429) {
    throw new Error(
      "GitHub rate-limited the verification request. Please try again in a few minutes.",
    );
  }
  if (!repoRes.ok) {
    throw new Error(
      `Could not verify the repository (GitHub returned ${repoRes.status}).`,
    );
  }

  const repoJson = (await repoRes.json()) as {
    full_name: string;
    html_url: string;
    default_branch: string;
    private: boolean;
    archived?: boolean;
  };
  if (repoJson.private) {
    throw new Error("The repository must be public.");
  }
  if (repoJson.archived) {
    throw new Error("The repository is archived and cannot be submitted.");
  }

  const branch = repoJson.default_branch || "main";

  for (const path of candidatePaths(slug)) {
    const res = await gh(
      `https://api.github.com/repos/${owner}/${name}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    );
    if (res.ok) {
      const file = (await res.json()) as { type?: string; size?: number };
      if (file.type === "file" && (file.size ?? 0) > 0) {
        return {
          repo: repoJson.full_name,
          owner,
          name,
          defaultBranch: branch,
          skillMdPath: path,
          skillMdUrl: `${repoJson.html_url}/blob/${branch}/${path}`,
          htmlUrl: repoJson.html_url,
        };
      }
    }
  }

  throw new Error(
    slug
      ? `No SKILL.md found in ${owner}/${name} at skills/${slug}/SKILL.md, ${slug}/SKILL.md, or the repository root.`
      : `No SKILL.md found in ${owner}/${name}. Add a SKILL.md at the repository root (or in .github/ or docs/) and resubmit.`,
  );
}

/** Fetches the raw SKILL.md text (capped) for on-site rendering. */
export async function fetchSkillMd(
  repoInput: string,
  slug?: string,
): Promise<{ repo: string; path: string; url: string; markdown: string }> {
  const check = await verifyGitHubSkillRepo(repoInput, slug);
  const raw = `https://raw.githubusercontent.com/${check.owner}/${check.name}/${check.defaultBranch}/${check.skillMdPath}`;
  const res = await fetch(raw, { headers: { "User-Agent": "emskills-registry" } });
  if (!res.ok) {
    throw new Error(`Could not read SKILL.md (GitHub returned ${res.status}).`);
  }
  const text = await res.text();
  const MAX = 120_000;
  return {
    repo: check.repo,
    path: check.skillMdPath,
    url: check.skillMdUrl,
    markdown: text.length > MAX ? `${text.slice(0, MAX)}\n\n…truncated…` : text,
  };
}

export type FieldIssue = { field: string; message: string };

/**
 * Non-throwing repo validation used for field-level form errors.
 * `field` is always "repo" — the caller maps it onto the form.
 */
export async function checkRepoField(
  repoInput: string,
): Promise<{ ok: true; check: RepoCheck } | { ok: false; issues: FieldIssue[] }> {
  try {
    return { ok: true, check: await verifyGitHubSkillRepo(repoInput) };
  } catch (e) {
    return {
      ok: false,
      issues: [{ field: "repo", message: e instanceof Error ? e.message : String(e) }],
    };
  }
}
