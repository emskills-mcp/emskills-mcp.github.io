import { useState } from "react";
import {
  FOLDER_TREE,
  OPTIONAL_FIELDS,
  REGISTRY_PATH_PREFIX,
  REGISTRY_REPO,
  REGISTRY_REPO_URL,
  REQUIRED_FIELDS,
  REQUIRED_SECTIONS,
  SKILL_JSON_TEMPLATE,
  SKILL_MD_TEMPLATE,
} from "@/lib/skill-template";

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-panel px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
          className="font-mono text-[10px] text-primary hover:underline"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

/** Contributor-facing contract: folder layout, manifest template, field rules. */
export function SkillTemplateGuide() {
  return (
    <section id="template" className="mt-14 rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        SKILL.md template &amp; folder layout
      </h2>
      <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        The registry repository is{" "}
        <a
          href={REGISTRY_REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-xs text-primary hover:underline"
        >
          {REGISTRY_REPO}
        </a>
        . Add one folder per skill under{" "}
        <code className="font-mono text-xs">{REGISTRY_PATH_PREFIX}/&lt;slug&gt;/</code>{" "}
        and open a pull request. On merge, the importer validates every manifest
        and drops it into the moderation queue — the folder name must equal the{" "}
        <code className="font-mono text-xs">slug</code> in front matter.
      </p>

      <CopyBlock label="repository layout" code={FOLDER_TREE} />
      <CopyBlock label="skills/<slug>/SKILL.md" code={SKILL_MD_TEMPLATE} />
      <CopyBlock label="skills/<slug>/skill.json (optional)" code={SKILL_JSON_TEMPLATE} />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            required front matter
          </h3>
          <dl className="mt-3 space-y-2">
            {REQUIRED_FIELDS.map((f) => (
              <div key={f.key} className="border-b border-border pb-2 last:border-0">
                <dt className="font-mono text-xs text-signal">{f.key}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.hint}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            optional front matter
          </h3>
          <dl className="mt-3 space-y-2">
            {OPTIONAL_FIELDS.map((f) => (
              <div key={f.key} className="border-b border-border pb-2 last:border-0">
                <dt className="font-mono text-xs">{f.key}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.hint}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            required body sections
          </h3>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {REQUIRED_SECTIONS.map((s) => (
              <li key={s}>
                <code className="font-mono text-xs text-foreground">## {s}</code> —{" "}
                {s === "Scope"
                  ? "what the skill does and the instruments/data it assumes."
                  : s === "Safety"
                    ? "beam dose, stage motion, or sample-damage limits an agent must respect."
                    : "the exact tool call, arguments, and expected output."}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-md border border-border bg-panel px-3 py-2 font-mono text-[11px] text-muted-foreground">
            Validation rejects unknown techniques or categories, non-semver
            versions, summaries outside 20–200 characters, and missing sections —
            each error names the file, the field, and how to fix it.
          </p>
        </div>
      </div>
    </section>
  );
}
