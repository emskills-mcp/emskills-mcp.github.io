import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, webPageJsonLd } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const title = "Docs — connecting emskills to your agent";
const description =
  "How SKILL.md packages in the emskills shop are structured, installed, tested, and invoked by an agent.";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { property: "og:url", content: absoluteUrl("/docs") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/docs") }],
    scripts: [
      jsonLdScript(webPageJsonLd({ path: "/docs", name: title, description })),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "emskills", path: "/" },
          { name: (title.split("—")[0] ?? title).trim(), path: "/docs" },
        ]),
      ),
    ],
  }),
  component: Docs,
});

const steps = [
  {
    n: "01",
    h: "Pick a skill",
    p: "Search the registry by technique, category, or keyword and read its SKILL.md before you trust it.",
  },
  {
    n: "02",
    h: "Install it in your agent",
    p: "Drop the skill into any agent host. No retraining, no vendor SDK — the adapter handles the instrument.",
  },
  {
    n: "03",
    h: "Run at the scope",
    p: "Trigger from instrument session logs or an uploaded dataset, and pin versions so results stay reproducible.",
  },
];

function Docs() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">registry / docs</div>
        <h1 className="mt-3 max-w-[20ch] text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Wire a microscopy skill into your agent
        </h1>

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <ol className="space-y-7">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-signal/40 font-mono text-xs text-signal">
                  {s.n}
                </span>
                <div>
                  <h2 className="font-display font-semibold">{s.h}</h2>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
                    {s.p}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-border bg-panel p-5 font-mono text-xs leading-relaxed">
            <div className="text-muted-foreground">// emskills.config.json</div>
            <div className="mt-3">
              <span className="text-signal">&quot;host&quot;</span>:{" "}
              <span className="text-brass">&quot;mcp.emskills.local&quot;</span>,
            </div>
            <div>
              <span className="text-signal">&quot;skills&quot;</span>: [
            </div>
            <div className="pl-4 text-brass">&quot;cryo2d-classify&quot;,</div>
            <div className="pl-4 text-brass">&quot;edax-phase-map&quot;</div>
            <div>],</div>
            <div>
              <span className="text-signal">&quot;version&quot;</span>:{" "}
              <span className="text-brass">&quot;pinned&quot;</span>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-muted-foreground">
              connected · 2 skills active · 12ms
            </div>
          </div>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Anatomy of a SKILL.md
          </h2>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {[
              ["frontmatter", "name, technique, category, license, and a one-line description"],
              ["scope", "what the skill does and, explicitly, what it must not be used for"],
              ["procedure", "ordered steps the agent follows, with instrument preconditions"],
              ["tools", "MCP tool names, typed inputs, and expected output artifacts"],
              ["validation", "acceptance checks — calibration records, confidence thresholds"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-8">
                <div className="w-32 shrink-0 font-mono text-xs text-signal">{k}</div>
                <div className="text-sm text-muted-foreground">{v}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
