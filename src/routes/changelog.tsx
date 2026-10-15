import { createFileRoute } from "@tanstack/react-router";
import { PageShell, meta } from "@/components/page-shell";

export const Route = createFileRoute("/changelog")({
  head: () =>
    meta(
      "Changelog — emskills",
      "Release notes for the emskills registry: review pipeline, MCP execution and publisher verification.",
      "/changelog",
    ),
  component: Changelog,
});

const entries = [
  {
    date: "2026-08-26",
    tag: "accounts",
    items: [
      "API keys and usage dashboard with 30-day MCP run volume.",
      "Publisher verification workflow and verified/certified badges.",
      "Free access for everyone — payments and metering removed from the platform.",
    ],
  },
  {
    date: "2026-08-19",
    tag: "runtime",
    items: [
      "Server-side Run via MCP with live JSON-RPC execution and log stream.",
      "Rendered SKILL.md preview on skill detail pages.",
      "Admin audit trail for every approval and rejection.",
    ],
  },
  {
    date: "2026-08-12",
    tag: "registry",
    items: [
      "Moderated submission queue with GitHub repository validation.",
      "SKILL.md presence check across root, .github/ and docs/.",
      "Public registry moved to a live database with real counts.",
    ],
  },
];

function Changelog() {
  return (
    <PageShell
      crumb="platform / changelog"
      title="What shipped, and when"
      intro="Registry and runtime changes in reverse chronological order."
    >
      {entries.map((e) => (
        <section key={e.date} className="rounded-lg border border-border bg-card p-6">
          <h2 className="flex items-center gap-3 font-mono text-xs font-medium">
            <span className="text-signal">{e.date}</span>
            <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">
              {e.tag}
            </span>
          </h2>

          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {e.items.map((i) => (
              <li key={i} className="flex gap-3">
                <span className="text-signal">·</span>
                {i}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
