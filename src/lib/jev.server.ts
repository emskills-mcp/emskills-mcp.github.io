// Server-only TypeSafe Jev helpers (typed judgments via the Lovable AI Gateway).
import { techniques } from "@/data/skills";

const MODEL = "typesafe/jev-latest";

type Question =
  | { type: "choice"; instructions: unknown; criteria: Record<string, unknown> }
  | { type: "score"; instructions: unknown; criteria: unknown[] }
  | { type: "noul"; instructions: unknown; criteria?: { true: unknown; false: unknown } };

type Answer = {
  choice?: string;
  score?: number;
  noul?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export class JevError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function askJev(
  state: unknown,
  questions: Record<string, Question>,
): Promise<Record<string, Answer>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new JevError(401, "AI judgments are not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: MODEL, state, questions }),
  });
  if (!res.ok) {
    let msg = `AI judgment failed (${res.status}).`;
    try {
      const j = (await res.json()) as { error?: { message?: string }; message?: string };
      msg = j.error?.message ?? j.message ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 402) msg = "AI credits are exhausted — top up in workspace settings to resume judgments.";
    throw new JevError(res.status, msg);
  }
  const json = (await res.json()) as { answers?: Record<string, Answer> };
  if (!json.answers) throw new JevError(502, "AI judgment returned no answers.");
  for (const id of Object.keys(questions)) {
    if (!json.answers[id]) throw new JevError(502, `AI judgment missing answer "${id}".`);
  }
  return json.answers;
}

const norm = (score: number | undefined, levels: number) =>
  typeof score === "number" ? score / (levels - 1) : null;

// ---------- #1 + #2: submission triage & certification pre-check ----------

export type Triage = {
  technique: { choice: string; confidence: number | null };
  kind: { choice: string; confidence: number | null };
  summaryMatches: number;
  undisclosedData: number;
  instrumentRisk: number | null; // 0 safe .. 1 risky
  certification: {
    ownership: number;
    endpoint: number;
    hardwareClaims: number | null; // 0..1
    maintainer: number;
    openLicence: number;
  };
  needsAttention: boolean;
};

export type TriageInput = {
  name: string;
  summary: string;
  description: string;
  technique: string;
  kind: string;
  tags: string[];
  tool_call: string;
  repo: string;
  org: string;
  license: string;
  mcp_endpoint?: string | null;
  skill_md?: string | null;
};

export async function triageSubmission(s: TriageInput): Promise<Triage> {
  const techCriteria: Record<string, string> = {};
  for (const t of techniques) techCriteria[t.code] = `${t.code} — ${t.note}`;
  techCriteria["other"] = "No listed electron microscopy technique fits.";

  const state = {
    submission: {
      name: s.name,
      summary: s.summary,
      description: s.description,
      claimed_technique: s.technique,
      claimed_kind: s.kind,
      tags: s.tags,
      tool_call: s.tool_call,
      repo: s.repo,
      org: s.org,
      license: s.license,
      mcp_endpoint: s.mcp_endpoint ?? null,
    },
    skill_md: (s.skill_md ?? "").slice(0, 20000),
  };

  const a = await askJev(state, {
    technique: {
      type: "choice",
      instructions: "Which electron microscopy technique does this skill (see `submission` and `skill_md`) primarily serve?",
      criteria: techCriteria,
    },
    kind: {
      type: "choice",
      instructions: "What kind of package is this skill?",
      criteria: {
        "SKILL.md": "Instructions/knowledge an agent follows; no server of its own.",
        "MCP server": "Exposes callable tools through a running MCP server.",
      },
    },
    summary_matches: {
      type: "noul",
      instructions: "Does `submission.summary` accurately describe what `skill_md` actually does?",
      criteria: { true: "The summary matches the documented behaviour.", false: "The summary overstates, omits or misdescribes the behaviour." },
    },
    undisclosed_data: {
      type: "noul",
      instructions: "Does `skill_md` send microscope images, data or credentials to an external service without clearly disclosing it?",
      criteria: { true: "Data leaves the lab to a third party without clear disclosure.", false: "No external transfer, or any transfer is clearly disclosed." },
    },
    instrument_risk: {
      type: "score",
      instructions: "How much could running this skill change the physical state of a microscope?",
      criteria: [
        "Read-only: analyses existing images or data, never touches the instrument.",
        "Changes acquisition settings, with documented limits or confirmation steps.",
        "Drives stage, beam, vacuum or high voltage directly with no documented safeguards.",
      ],
    },
    cert_ownership: {
      type: "noul",
      instructions: "Is this skill published first-party by the organisation that makes the instrument, detector or software it targets (compare `submission.org`, `submission.repo` and `skill_md`)?",
    },
    cert_endpoint: {
      type: "noul",
      instructions: "Does the skill declare a concrete MCP endpoint URL (in `submission.mcp_endpoint` or the `skill_md` front matter)?",
    },
    cert_hardware_claims: {
      type: "score",
      instructions: "How well are quantitative calibration, dose, drift or resolution claims in `skill_md` backed by stated acquisition conditions?",
      criteria: [
        "Numeric performance claims appear with no instrument or acquisition conditions.",
        "Claims name the instrument but leave key acquisition conditions out.",
        "Every claim states instrument, voltage, dose or other acquisition conditions, or no numeric claims are made.",
      ],
    },
    cert_maintainer: {
      type: "noul",
      instructions: "Does `skill_md` name a maintainer or give an issue tracker / contact for breaking changes?",
    },
    cert_open_licence: {
      type: "noul",
      instructions: "Is `submission.license` an open-source licence (e.g. MIT, Apache-2.0, BSD, GPL, CC-BY)?",
    },
  });

  const risk = norm(a["instrument_risk"]?.score, 3);
  const triage: Triage = {
    technique: { choice: a["technique"]?.choice ?? "other", confidence: a["technique"]?.confidence ?? null },
    kind: { choice: a["kind"]?.choice ?? s.kind, confidence: a["kind"]?.confidence ?? null },
    summaryMatches: a["summary_matches"]?.noul ?? 0,
    undisclosedData: a["undisclosed_data"]?.noul ?? 0,
    instrumentRisk: risk,
    certification: {
      ownership: a["cert_ownership"]?.noul ?? 0,
      endpoint: a["cert_endpoint"]?.noul ?? 0,
      hardwareClaims: norm(a["cert_hardware_claims"]?.score, 3),
      maintainer: a["cert_maintainer"]?.noul ?? 0,
      openLicence: a["cert_open_licence"]?.noul ?? 0,
    },
    needsAttention: false,
  };
  triage.needsAttention =
    triage.undisclosedData >= 0.4 ||
    triage.summaryMatches < 0.5 ||
    (risk ?? 0) >= 0.6 ||
    triage.technique.choice !== s.technique ||
    (triage.technique.confidence ?? 1) < 0.5;
  return triage;
}

// ---------- #3: search reranking ----------

export type RerankCandidate = {
  slug: string;
  name: string;
  summary: string;
  technique: string;
  tags: string[];
  toolCall: string;
};

export async function rerankSkills(query: string, candidates: RerankCandidate[]) {
  const list = candidates.slice(0, 30);
  const techCriteria: Record<string, string> = { any: "The request is not specific to one technique." };
  for (const t of techniques) techCriteria[t.code] = `${t.code} — ${t.note}`;

  const questions: Record<string, Question> = {
    technique: {
      type: "choice",
      instructions: "Which electron microscopy technique is the search `query` about?",
      criteria: techCriteria,
    },
  };
  list.forEach((_, i) => {
    questions[`r${i}`] = {
      type: "score",
      instructions: `How well does skill \`candidates[${i}]\` fulfil the microscopist's search \`query\`?`,
      criteria: [
        "Unrelated to what the query asks for.",
        "Same general area, but does not perform the requested task.",
        "Performs a closely related task or covers part of the request.",
        "Directly performs the task the query asks for.",
      ],
    };
  });
  const a = await askJev({ query, candidates: list }, questions);
  return {
    technique: a["technique"]?.choice ?? "any",
    ranking: list
      .map((c, i) => ({ slug: c.slug, relevance: norm(a[`r${i}`]?.score, 4) ?? 0 }))
      .sort((x, y) => y.relevance - x.relevance),
  };
}

// ---------- #4: grading a test run ----------

export async function gradeRun(input: {
  name: string;
  summary: string;
  tool: string;
  args: string;
  output: string;
}) {
  const a = await askJev(
    {
      skill: { name: input.name, summary: input.summary, tool: input.tool },
      arguments: input.args.slice(0, 4000),
      output: input.output.slice(0, 16000),
    },
    {
      fulfilled: {
        type: "noul",
        instructions: "Does `output` do what `skill.summary` promises for the given `arguments`?",
        criteria: { true: "The output delivers the promised result.", false: "The output is off-task, empty, refuses or only restates the request." },
      },
      usefulness: {
        type: "score",
        instructions: "How useful would `output` be to a microscopist who ran this skill?",
        criteria: [
          "Not usable: wrong, empty or generic.",
          "Partly usable: needs substantial correction.",
          "Usable with minor checks.",
          "Directly usable, specific and technically sound.",
        ],
      },
      error_reported: {
        type: "noul",
        instructions: "Does `output` report an error, missing input or failure to run?",
      },
    },
  );
  return {
    fulfilled: a["fulfilled"]?.noul ?? 0,
    usefulness: norm(a["usefulness"]?.score, 4) ?? 0,
    errorReported: a["error_reported"]?.noul ?? 0,
  };
}

// ---------- #5: public quality scores ----------

export type Quality = { docs: number; examples: number; safety: number; overall: number };

export async function scoreQuality(s: {
  name: string;
  summary: string;
  description: string;
  skill_md: string | null;
}): Promise<Quality> {
  const a = await askJev(
    { skill: { name: s.name, summary: s.summary, description: s.description }, skill_md: (s.skill_md ?? "").slice(0, 20000) },
    {
      docs: {
        type: "score",
        instructions: "How clearly does `skill_md` (or `skill.description` if empty) explain what the skill does, its inputs and outputs?",
        criteria: [
          "Purpose, inputs and outputs are unclear or missing.",
          "Purpose is clear but inputs or outputs are vague.",
          "Purpose, inputs and outputs are all described.",
          "Thorough: purpose, inputs, outputs, limits and failure modes are all explained.",
        ],
      },
      examples: {
        type: "score",
        instructions: "How complete are the usage examples in `skill_md`?",
        criteria: [
          "No examples.",
          "One partial example without expected output.",
          "A complete example with arguments and expected output.",
          "Several complete examples covering typical and edge cases.",
        ],
      },
      safety: {
        type: "score",
        instructions: "How safe is it to point this skill at a real microscope, based on `skill_md`?",
        criteria: [
          "Drives the instrument with no documented safeguards.",
          "Changes instrument settings with some limits documented.",
          "Read-only, or every instrument change requires explicit confirmation within documented limits.",
        ],
      },
    },
  );
  const docs = norm(a["docs"]?.score, 4) ?? 0;
  const examples = norm(a["examples"]?.score, 4) ?? 0;
  const safety = norm(a["safety"]?.score, 3) ?? 0;
  return { docs, examples, safety, overall: 0.4 * docs + 0.3 * examples + 0.3 * safety };
}
