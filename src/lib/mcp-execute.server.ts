// Server-only execution engine behind the registry-hosted MCP server.
// A tool call is executed by a real model that is grounded in the skill's
// published SKILL.md, so the run reflects the actual manifest, not a stub.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

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
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fallback(skill, args, "no model credential configured");

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

  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.status === 429) return fallback(skill, args, "model rate limit reached, retry shortly");
    if (res.status === 402) return fallback(skill, args, "model credits exhausted for this workspace");
    if (!res.ok) return fallback(skill, args, `gateway HTTP ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return fallback(skill, args, "model returned an empty completion");
    return { text, model: MODEL, grounded: Boolean(manifest) };
  } catch (e) {
    return fallback(skill, args, e instanceof Error ? e.message : String(e));
  }
}
