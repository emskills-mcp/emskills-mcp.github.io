import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";
import { getRegistryStatsFn } from "@/lib/skills.functions";

export const Route = createFileRoute("/insights")({
  head: () =>
    meta(
      "Insights — emskills",
      "Live coverage stats for the electron microscopy skill shop: skills, runnable skills, techniques and publishing organisations.",
      "/insights",
    ),
  loader: () => getRegistryStatsFn(),
  errorComponent: () => (
    <PageShell crumb="resources / insights" title="Insights" intro="Registry stats are temporarily unavailable." />
  ),
  component: Insights,
});

function Insights() {
  const stats = Route.useLoaderData();
  const cards = [
    { k: "skills indexed", v: stats.skills },
    { k: "mcp servers", v: stats.servers },
    { k: "techniques covered", v: stats.techniques },
    { k: "publishing orgs", v: stats.orgs },
    { k: "in review", v: stats.pending },
  ];

  return (
    <PageShell
      crumb="resources / insights"
      title="Registry coverage"
      intro="Where the ecosystem actually has tooling today — counted live from the published registry, not estimated."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.k} className="rounded-lg border border-border bg-card p-5">
            <div className="font-display text-3xl font-semibold tracking-tight text-signal">
              {c.v}
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {c.k}
            </div>
          </div>
        ))}
      </div>
      <Section h="Reading the numbers">
        <p>
          Coverage is uneven: cryo-EM and STEM analysis are well represented because
          their workflows are already scripted, while in-situ and spectroscopy
          acquisition remain thin. Those gaps are the highest-value places to publish.
        </p>
      </Section>
      <Section h="Review throughput">
        <p>
          {stats.pending} submission{stats.pending === 1 ? "" : "s"} currently sit in
          the moderation queue. Every listing passes a repository check, a SKILL.md
          check and a fixture invocation before it appears in the index.
        </p>
      </Section>
    </PageShell>
  );
}
