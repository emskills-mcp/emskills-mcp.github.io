// Client-safe: the canonical contributor contract for the registry repository.
// Shared by /contribute, /docs and the server-side importer.

export const REGISTRY_REPO = "emskills-mcp/em-skills";
export const REGISTRY_REPO_URL = `https://github.com/${REGISTRY_REPO}`;
export const REGISTRY_PATH_PREFIX = "skills";

/** Front-matter keys the importer requires, with human-readable guidance. */
export const REQUIRED_FIELDS: { key: string; hint: string }[] = [
  { key: "name", hint: "Human-readable skill name, e.g. “Cryo-EM 2D class triage”." },
  { key: "slug", hint: "Lowercase kebab-case id; must match the folder name." },
  { key: "technique", hint: "One of the registry techniques, one of SEM, TEM, STEM, EDS, EELS, cryo-EM, FIB." },
  { key: "category", hint: "One of the registry categories, e.g. Segmentation, Image acquisition, Calibration." },
  { key: "kind", hint: "“MCP server” or “SKILL.md”." },
  { key: "summary", hint: "One sentence, 20–200 characters, no trailing period needed." },
  { key: "license", hint: "SPDX id such as MIT, Apache-2.0, BSD-3-Clause." },
  { key: "version", hint: "Semantic version such as 0.1.0." },
  { key: "runtime", hint: "Execution environment, e.g. “python 3.11” or “node 20”." },
  { key: "tool_call", hint: "Canonical tool name agents invoke, snake_case." },
];

export const OPTIONAL_FIELDS: { key: string; hint: string }[] = [
  { key: "org", hint: "Publishing lab, group or company. Defaults to the repo owner." },
  { key: "repo", hint: "Upstream source repository if it differs from this registry." },
  { key: "mcp_endpoint", hint: "HTTPS endpoint for a hosted MCP server." },
  { key: "tags", hint: "Up to 12 short tags, YAML list or [a, b, c]." },
  { key: "description", hint: "Longer prose; falls back to the first body paragraph." },
];

/** Body headings the importer expects to find (case-insensitive). */
export const REQUIRED_SECTIONS = ["Scope", "Safety", "Usage"] as const;

export const FOLDER_TREE = `em-skills/
├── README.md
└── skills/
    ├── cryo2d-classify/
    │   ├── SKILL.md          # required — manifest + instructions
    │   ├── skill.json        # optional — overrides/extends front matter
    │   ├── examples/
    │   │   └── invoke.json   # sample tool call + expected output
    │   └── fixtures/
    │       └── sample.mrc    # small deterministic test input
    └── edax-phase-map/
        └── SKILL.md`;

export const SKILL_MD_TEMPLATE = `---
name: Cryo-EM 2D class triage
slug: cryo2d-classify
technique: cryo-EM
category: Segmentation
kind: MCP server
summary: Ranks 2D class averages and flags junk classes before 3D refinement
description: >
  Scores RELION/cryoSPARC 2D class averages on resolution, particle count and
  radial symmetry, then returns a keep/discard recommendation per class.
org: Example Structural Biology Lab
repo: emskills-mcp/em-skills
version: 0.1.0
license: MIT
runtime: python 3.11
tool_call: cryo2d_classify
mcp_endpoint: https://mcp.example.org/cryo2d
tags:
  - cryo-em
  - 2d-classification
  - qc
---

# Cryo-EM 2D class triage

## Scope
What this skill does, the data it expects (format, pixel size, box size), and
what it explicitly does not do. State the limits an agent must not exceed.

## Safety
Declare any action that touches hardware: stage movement, beam or dose changes,
aperture or valve control, milling. Read-only analysis skills state
"Read-only — no instrument control".

## Usage
\`\`\`json
{
  "tool": "cryo2d_classify",
  "arguments": {
    "job_dir": "/data/relion/Class2D/job012",
    "min_particles": 500
  }
}
\`\`\`

Expected output shape, units, and a deterministic example result produced from
the bundled fixture.

## Reproducibility
Pinned dependencies, seed/deterministic mode, and the command a reviewer runs
to reproduce the reported numbers.
`;

export const SKILL_JSON_TEMPLATE = `{
  "slug": "cryo2d-classify",
  "technique": "cryo-EM",
  "category": "Segmentation",
  "tool_call": "cryo2d_classify",
  "tags": ["cryo-em", "qc"]
}`;
