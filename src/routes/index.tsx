import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SkillCard } from "@/components/skill-card";
import { categories, techniques } from "@/data/skills";
import { getPublishedSkills, getRegistryStatsFn } from "@/lib/skills.functions";
import { getRequestOrigin } from "@/lib/origin.functions";
import { absoluteUrl, faqJsonLd, jsonLdScript, webPageJsonLd } from "@/lib/seo";

const title = "emskills — AI agent skills for electron microscopy";
const description =
  "A registry of ready-to-use SKILL.md packages for SEM, TEM, STEM, EDS, EELS, cryo-EM and FIB workflows.";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [all, stats, origin] = await Promise.all([
      getPublishedSkills(),
      getRegistryStatsFn(),
      getRequestOrigin(),
    ]);
    const catCounts: Record<string, number> = {};
    const techCounts: Record<string, number> = {};
    for (const s of all) {
      catCounts[s.category] = (catCounts[s.category] ?? 0) + 1;
      techCounts[s.technique] = (techCounts[s.technique] ?? 0) + 1;
    }
    return { featured: all.slice(0, 4), stats, origin, catCounts, techCounts };
  },
  head: ({ loaderData }) => {
    const image = loaderData ? `${loaderData.origin}/og-emskills.jpg` : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "emskills" },
        { property: "og:url", content: absoluteUrl("/") },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: absoluteUrl("/") }],
      scripts: [
        jsonLdScript(webPageJsonLd({ path: "/", name: title, description })),
        jsonLdScript(faqJsonLd(faqs)),
      ],
    };
  },
  component: Home,
});

const faqs = [
  {
    q: "What is a SKILL.md package?",
    a: "A portable, human-readable capability manifest paired with a runnable implementation, so an AI agent can discover and apply it to a microscope workflow.",
  },
  {
    q: "Which instruments are supported?",
    a: "Skills target the acquisition and analysis layer, not the vendor SDK. Adapters map to SEM, TEM, STEM, EDS, EELS, cryo-EM and FIB backends.",
  },
  {
    q: "Can I publish my own skill?",
    a: "Yes. Submit a repository containing a valid SKILL.md; it enters the review queue and appears in the index once calibrated.",
  },
];

function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { featured, stats } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 graticule opacity-60" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-signal/70 beam-scan" />
          <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 text-right font-mono text-[10px] leading-relaxed text-muted-foreground/70 lg:block">
            MAG&nbsp;&nbsp;×40k
            <br />
            HV&nbsp;&nbsp;&nbsp;30.0 kV
            <br />
            BEAM&nbsp;1.2 nA
            <br />
            WD&nbsp;&nbsp;&nbsp;10.2 mm
          </div>

          <div className="relative mx-auto max-w-[1200px] px-5 py-16 md:py-24">
            <div className="max-w-2xl">
              <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-signal">
                <span className="inline-block size-1.5 rounded-full bg-signal" />
                Indexed skill registry
              </p>
              <h1 className="text-balance font-display text-4xl font-semibold leading-none tracking-tight md:text-6xl">
                Skills for the electron microscope
              </h1>
              <p className="mt-6 max-w-[52ch] text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                A shop of ready-to-use SKILL.md packages for image acquisition,
                segmentation, and calibration across SEM, TEM, STEM, EDS, EELS and cryo-EM
                workflows — each one testable before you install it.
              </p>

              <div className="mt-8 flex items-end gap-8 font-mono">
                <div>
                  <div className="font-display text-3xl font-semibold">
                    {stats.skills.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    skills indexed
                  </div>
                </div>
                <div className="h-9 w-px bg-border" />
                <div>
                  <div className="font-display text-3xl font-semibold">
                    {stats.servers.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    runnable skills
                  </div>
                </div>
                <div className="hidden h-9 w-px bg-border sm:block" />
                <div className="hidden sm:block">
                  <div className="font-display text-3xl font-semibold">
                    {stats.techniques}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    techniques
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate({ to: "/skills", search: { q: q || undefined, technique: undefined } });
                }}
                className="mt-9 flex max-w-xl items-center gap-2 rounded-lg border border-border bg-panel p-2"
              >
                <span className="pl-2 font-mono text-sm text-muted-foreground">⌕</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search skills"
                  placeholder="e.g. cryo-EM 2D classification, EDS phase map, CTF fitting…"
                  className="flex-1 bg-transparent px-1 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <button
                  type="submit"
                  className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1200px] px-5 py-14">
            <div className="mb-7 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Browse by technique
              </h2>
              <span className="font-mono text-xs text-muted-foreground">taxonomy / 7</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
              {techniques.map((t, i) => (
                <Link
                  key={t.code}
                  to="/skills"
                  search={{ technique: t.code, q: undefined }}
                  className="rounded-lg border border-border bg-panel p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:border-signal/50"
                >
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-3 font-display text-lg font-semibold">{t.code}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {t.count} skills
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-panel">
          <div className="mx-auto max-w-[1200px] px-5 py-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="mb-6 flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    Featured skills
                  </h2>
                  <Link to="/skills" className="font-mono text-xs text-signal">
                    view all →
                  </Link>
                </div>
                <div className="space-y-3">
                  {featured.map((s: (typeof featured)[number]) => (
                    <SkillCard key={s.slug} skill={s} />
                  ))}
                </div>
              </div>

              <aside>
                <h2 className="mb-5 font-display text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Categories
                </h2>
                <ul className="divide-y divide-border border-y border-border font-mono text-sm">
                  {categories.map((c) => (
                    <li key={c.name} className="flex items-center justify-between py-2.5">
                      <Link
                        to="/skills"
                        search={{ q: c.name, technique: undefined }}
                        className="text-muted-foreground hover:text-signal"
                      >
                        {c.name}
                      </Link>
                      <span className="text-[11px] text-muted-foreground/70">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1200px] px-5 py-14">
            <h2 className="mb-7 font-display text-xl font-semibold tracking-tight">
              Frequently asked
            </h2>
            <div className="divide-y divide-border border-y border-border">
              {faqs.map((f) => (
                <div key={f.q} className="py-4">
                  <div className="font-display text-base font-medium">{f.q}</div>
                  <p className="mt-2 max-w-[62ch] text-pretty text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
