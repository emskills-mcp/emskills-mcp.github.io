// Server-only execution engine behind the registry-hosted MCP server.
// A tool call is executed by a real model that is grounded in the skill's
// published SKILL.md, so the run reflects the actual manifest, not a stub.

type Completion = { ok: true; text: string; model: string } | { ok: false; why: string };
type Provider = {
  id: string;
  run: (system: string, user: string) => Promise<Completion>;
};

function httpWhy(status: number): string {
  if (status === 429) return "rate limit reached";
  if (status === 529) return "overloaded";
  if (status === 401 || status === 403) return "credential rejected";
  return `HTTP ${status}`;
}

// OpenAI-compatible chat completions: GitHub Models, Cloudflare Workers AI and
// Hugging Face Inference Providers all speak this shape.
function openAiCompatible(url: string, token: string, model: string): Provider["run"] {
  return async (system, user) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, why: httpWhy(res.status) };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true, text, model } : { ok: false, why: "empty completion" };
  };
}

/** Providers enabled by env vars, in preference order (MCP_PROVIDER_ORDER overrides). */
function configuredProviders(): Provider[] {
  const env = process.env;
  const all: Record<string, Provider | null> = {
    anthropic: env["ANTHROPIC_API_KEY"]
      ? {
          id: "anthropic",
          run: async (system, user) => {
            const model = "claude-sonnet-5-5";
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": env["ANTHROPIC_API_KEY"]!,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                max_tokens: 1024,
                system,
                messages: [{ role: "user", content: user }],
              }),
            });
            if (!res.ok) return { ok: false, why: httpWhy(res.status) };
            const json = (await res.json()) as { content?: { type: string; text?: string }[] };
            const text = json.content?.find((b) => b.type === "text")?.text?.trim();
            return text ? { ok: true, text, model } : { ok: false, why: "empty completion" };
          },
        }
      : null,
    github: env["GITHUB_MODELS_TOKEN"]
      ? {
          id: "github",
          run: openAiCompatible(
            "https://models.github.ai/inference/chat/completions",
            env["GITHUB_MODELS_TOKEN"],
            env["GITHUB_MODELS_MODEL"] || "openai/gpt-4.1-mini",
          ),
        }
      : null,
    cloudflare:
      env["CLOUDFLARE_ACCOUNT_ID"] && env["CLOUDFLARE_API_TOKEN"]
        ? {
            id: "cloudflare",
            run: openAiCompatible(
              `https://api.cloudflare.com/client/v4/accounts/${env["CLOUDFLARE_ACCOUNT_ID"]}/ai/v1/chat/completions`,
              env["CLOUDFLARE_API_TOKEN"],
              env["CLOUDFLARE_MODEL"] || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            ),
          }
        : null,
    huggingface: env["HF_TOKEN"]
      ? {
          id: "huggingface",
          run: openAiCompatible(
            "https://router.huggingface.co/v1/chat/completions",
            env["HF_TOKEN"],
            env["HF_MODEL"] || "meta-llama/Llama-3.3-70B-Instruct",
          ),
        }
      : null,
  };
  const order = (env["MCP_PROVIDER_ORDER"] || "anthropic,github,cloudflare,huggingface")
    .split(",")
    .map((s) => s.trim());
  return order.map((id) => all[id]).filter((p): p is Provider => Boolean(p));
}

export type HostedSkill = {
  slug: string;
  name: string;
  technique: string;
  kind: string;
  summary: string;
  description: string;
  version: string;
  runtime: string;
  tool_call: string;
  repo: string;
  license: string;
};

export type Execution = {
  text: string;
  model: string | null;
  grounded: boolean; // true when the live SKILL.md was loaded
};

/** Loads the published SKILL.md so the model follows the real procedure. */
async function loadManifest(skill: HostedSkill): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("skills")
      .select("skill_md")
      .eq("slug", skill.slug)
      .maybeSingle();
    const stored = (data as { skill_md?: string | null } | null)?.skill_md;
    if (stored && stored.trim()) return stored;
  } catch {
    /* fall through to GitHub */
  }
  try {
    const { fetchSkillMd } = await import("@/lib/github.server");
    const doc = await fetchSkillMd(skill.repo, skill.slug);
    return doc.markdown;
  } catch {
    return null;
  }
}

function fallback(skill: HostedSkill, args: Record<string, unknown>, why: string): Execution {
  const keys = Object.keys(args);
  return {
    model: null,
    grounded: false,
    text: [
      `${skill.name} v${skill.version} — ${skill.tool_call}`,
      `technique: ${skill.technique} · runtime: ${skill.runtime}`,
      "",
      `arguments (${keys.length}): ${keys.map((k) => `${k}=${JSON.stringify(args[k])}`).join(", ") || "none"}`,
      "",
      `model execution unavailable: ${why}`,
      "The manifest is still valid; install the server locally to run vendor code.",
    ].join("\n"),
  };
}

/** Executes the skill's tool: model inference grounded in the manifest. */
export async function executeSkill(
  skill: HostedSkill,
  args: Record<string, unknown>,
): Promise<Execution> {
  const providers = configuredProviders();
  if (providers.length === 0) return fallback(skill, args, "no model credential configured");

  const manifest = await loadManifest(skill);

  const system = [
    "You are the execution backend of an MCP tool published in the emskills",
    "registry of electron-microscopy skills. You receive the skill's SKILL.md",
    "manifest and the arguments of a tools/call request, and you must carry out",
    "the procedure the manifest describes as far as reasoning over the given",
    "arguments allows.",
    "",
    "Rules:",
    "- Follow the manifest's procedure, parameters and safety notes exactly.",
    "- Return a compact technical report: inputs echoed, steps performed,",
    "  numeric results with units, and caveats. No marketing language.",
    "- When an argument required by the manifest is missing, say precisely which",
    "  one and what it should contain instead of inventing data.",
    "- When real instrument data would be required, state which computation the",
    "  local runtime must perform and give the expected output shape.",
    "- Plain text, under 350 words.",
  ].join("\n");

  const user = [
    `TOOL: ${skill.tool_call}`,
    `SKILL: ${skill.name} v${skill.version} (${skill.technique}, ${skill.kind}, runtime ${skill.runtime})`,
    `SUMMARY: ${skill.summary}`,
    "",
    "ARGUMENTS (JSON):",
    JSON.stringify(args, null, 2),
    "",
    "SKILL.md MANIFEST:",
    manifest ?? `(manifest unavailable — description: ${skill.description})`,
  ].join("\n");

  const failures: string[] = [];
  for (const p of providers) {
    try {
      const out = await p.run(system, user);
      if (out.ok) return { text: out.text, model: `${p.id}:${out.model}`, grounded: Boolean(manifest) };
      failures.push(`${p.id}: ${out.why}`);
    } catch (e) {
      failures.push(`${p.id}: ${e instanceof Error ? e.message : "request failed"}`);
    }
  }
  return fallback(skill, args, failures.join("; "));
}
