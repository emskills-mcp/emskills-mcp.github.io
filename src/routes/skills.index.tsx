import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SkillCard } from "@/components/skill-card";
import { techniques, type Technique } from "@/data/skills";
import { getPublishedSkills } from "@/lib/skills.functions";
import { smartRankSkills } from "@/lib/jev.functions";
import { useServerFn } from "@tanstack/react-start";
import { scoreSkill } from "@/lib/search";
import { cn } from "@/lib/utils";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
  webPageJsonLd,
} from "@/lib/seo";

const title = "Browse skills — emskills";
const description =
  "Search and filter the emskills registry by technique, category, tag, and keyword across electron microscopy workflows.";

type SkillSearch = {
  q?: string | undefined;
  technique?: Technique | undefined;
  category?: string | undefined;
  kind?: string | undefined;
  tags?: string[] | undefined;
  sort?: string | undefined;
};

const SORTS = [
  { id: "relevance", label: "best match" },
  { id: "smart", label: "AI smart match" },
  { id: "quality", label: "highest quality" },
  { id: "stars", label: "most starred" },
  { id: "recent", label: "recently updated" },
  { id: "name", label: "A–Z" },
];

export const Route = createFileRoute("/skills/")({
  loader: async () => getPublishedSkills(),
  validateSearch: (search: Record<string, unknown>): SkillSearch => {
    const str = (k: string) =>
      typeof search[k] === "string" && search[k] ? (search[k] as string) : undefined;
    const rawTags = search["tags"];
    const tags = Array.isArray(rawTags)
      ? (rawTags.filter((t) => typeof t === "string" && t) as string[])
      : typeof rawTags === "string" && rawTags
        ? [rawTags]
        : undefined;
    return {
      q: str("q"),
      technique: techniques.some((t) => t.code === search["technique"])
        ? (search["technique"] as Technique)
        : undefined,
      category: str("category"),
      kind: str("kind"),
      tags: tags && tags.length ? tags.slice(0, 12) : undefined,
      sort: str("sort"),
    };
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { property: "og:site_name", content: "emskills" },
      { property: "og:url", content: absoluteUrl("/skills") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/skills") }],
    scripts: [
      jsonLdScript(webPageJsonLd({ path: "/skills", name: title, description })),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "emskills", path: "/" },
          { name: "Skills", path: "/skills" },
        ]),
      ),
    ],
  }),
  component: SkillsIndex,
});

function SkillsIndex() {
  const search = Route.useSearch();
  const { q, technique, category, kind, tags, sort } = search;
  const navigate = useNavigate();
  const skills = Route.useLoaderData();

  const [draft, setDraft] = useState(q ?? "");
  useEffect(() => setDraft(q ?? ""), [q]);

  // Debounced live search so typing narrows results without a submit.
  useEffect(() => {
    const value = draft.trim();
    if (value === (q ?? "")) return;
    const id = window.setTimeout(() => {
      void navigate({
        to: "/skills",
        search: { ...search, q: value || undefined },
        replace: true,
      });
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const rank = useServerFn(smartRankSkills);
  const [smart, setSmart] = useState<{
    q: string;
    technique: string;
    ranking: { slug: string; relevance: number }[];
  } | null>(null);
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartErr, setSmartErr] = useState<string | null>(null);
  const activeTags = tags ?? [];
  const needle = (q ?? "").toLowerCase().trim();

  // Facets derive from the live registry, not a hardcoded list.
  const { tagFacets, categoryFacets, kindFacets } = useMemo(() => {
    const tagCount = new Map<string, number>();
    const catCount = new Map<string, number>();
    const kindCount = new Map<string, number>();
    for (const s of skills) {
      for (const t of s.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      catCount.set(s.category, (catCount.get(s.category) ?? 0) + 1);
      kindCount.set(s.kind, (kindCount.get(s.kind) ?? 0) + 1);
    }
    const sortDesc = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      tagFacets: sortDesc(tagCount),
      categoryFacets: sortDesc(catCount),
      kindFacets: sortDesc(kindCount),
    };
  }, [skills]);

  const results = useMemo(() => {
    const faceted = skills.filter((s) => {
      if (technique && s.technique !== technique) return false;
      if (category && s.category !== category) return false;
      if (kind && s.kind !== kind) return false;
      // Tags are AND-combined so each chip narrows the set.
      if (activeTags.length && !activeTags.every((t) => s.tags.includes(t))) return false;
      return true;
    });

    // Text query: full-text relevance scoring with synonym expansion and
    // typo tolerance (src/lib/search). Unmatched skills drop out.
    let scored: { skill: (typeof skills)[number]; score: number }[];
    if (needle) {
      scored = [];
      for (const s of faceted) {
        const score = scoreSkill(s, needle);
        if (score > 0) scored.push({ skill: s, score });
      }
    } else {
      scored = faceted.map((skill) => ({ skill, score: 0 }));
    }

    // Relevance is the default ordering whenever a query is present.
    const effectiveSort = sort ?? (needle ? "relevance" : "stars");
    if (effectiveSort === "smart" && needle && smart?.q === needle) {
      const rel = new Map(smart.ranking.map((r) => [r.slug, r.relevance]));
      scored.sort(
        (a, b) => (rel.get(b.skill.slug) ?? -1) - (rel.get(a.skill.slug) ?? -1) || b.score - a.score,
      );
    } else if ((effectiveSort === "relevance" || effectiveSort === "smart") && needle) {
      scored.sort((a, b) => b.score - a.score || b.skill.stars - a.skill.stars);
    } else if (effectiveSort === "quality") {
      scored.sort((a, b) => (b.skill.quality?.overall ?? -1) - (a.skill.quality?.overall ?? -1));
    } else if (effectiveSort === "name") {
      scored.sort((a, b) => a.skill.name.localeCompare(b.skill.name));
    } else if (effectiveSort === "recent") {
      scored.sort((a, b) => (b.skill.updated ?? "").localeCompare(a.skill.updated ?? ""));
    } else {
      scored.sort((a, b) => b.skill.stars - a.skill.stars);
    }
    return scored.map((x) => x.skill);
  }, [skills, technique, category, kind, activeTags, needle, sort, smart]);

  // AI "smart match": rerank the text-search candidates by what the query means.
  const candidateKey = results.slice(0, 30).map((s) => s.slug).join(",");
  useEffect(() => {
    if (sort !== "smart" || needle.length < 2 || !candidateKey) return;
    if (smart?.q === needle) return;
    let alive = true;
    setSmartBusy(true);
    setSmartErr(null);
    const id = window.setTimeout(() => {
      rank({ data: { query: needle, slugs: candidateKey.split(",") } })
        .then((r) => {
          if (!alive) return;
          if ("error" in r && r.error) setSmartErr(r.error);
          setSmart({ q: needle, ranking: r.ranking, technique: r.technique });
        })
        .catch((e) => alive && setSmartErr(e instanceof Error ? e.message : String(e)))
        .finally(() => alive && setSmartBusy(false));
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, needle, candidateKey]);

  const filterCount =
    (technique ? 1 : 0) + (category ? 1 : 0) + (kind ? 1 : 0) + activeTags.length + (q ? 1 : 0);

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    void navigate({
      to: "/skills",
      search: { ...search, tags: next.length ? next : undefined },
    });
  }

  const heading = technique ? `${technique} skills` : category ? category : "All skills";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">registry / skills</div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{heading}</h1>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({
              to: "/skills",
              search: { ...search, q: draft.trim() || undefined },
            });
          }}
          className="mt-6 flex max-w-xl items-center gap-2 rounded-lg border border-border bg-panel p-2"
        >
          <span className="pl-2 font-mono text-sm text-muted-foreground" aria-hidden="true">
            ⌕
          </span>
          <input
            name="q"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Search skills"
            placeholder="search name, tag, tool call, org…"
            className="flex-1 bg-transparent px-1 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label="Clear search"
              className="px-2 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground"
          >
            Search
          </button>
        </form>

        {/* Technique row */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/skills"
            search={{ ...search, technique: undefined }}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground",
              !technique && "border-signal/50 bg-signal/10 text-signal",
            )}
          >
            all techniques
          </Link>
          {techniques.map((t) => (
            <Link
              key={t.code}
              to="/skills"
              search={{ ...search, technique: t.code }}
              className={cn(
                "rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground",
                technique === t.code && "border-signal/50 bg-signal/10 text-signal",
              )}
            >
              {t.code}
            </Link>
          ))}
        </div>

        {/* Kind + sort row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {kindFacets.map(([k, n]) => (
            <Link
              key={k}
              to="/skills"
              search={{ ...search, kind: kind === k ? undefined : k }}
              className={cn(
                "rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground",
                kind === k && "border-primary/60 bg-primary/10 text-primary",
              )}
            >
              {k} <span className="text-[10px] opacity-70">{n}</span>
            </Link>
          ))}
          <span className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
            sort
            <select
              value={sort ?? (needle ? "relevance" : "stars")}
              onChange={(e) => {
                const next = e.target.value;
                const isDefault = next === (needle ? "relevance" : "stars");
                void navigate({
                  to: "/skills",
                  search: { ...search, sort: isDefault ? undefined : next },
                });
              }}
              aria-label="Sort results"
              className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {sort === "smart" && (
              <span className={smartErr ? "text-destructive" : ""}>
                {!needle
                  ? "type a search to use AI match"
                  : smartBusy
                    ? "ranking…"
                    : smartErr
                      ? smartErr
                      : smart?.q === needle && smart.technique !== "any"
                        ? `looks like ${smart.technique}`
                        : ""}
              </span>
            )}
          </span>
        </div>

        {/* Active filters */}
        {filterCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              active
            </span>
            {q && <Chip label={`“${q}”`} onClear={() => setDraft("")} />}
            {technique && (
              <Chip
                label={technique}
                to={{ ...search, technique: undefined }}
              />
            )}
            {category && <Chip label={category} to={{ ...search, category: undefined }} />}
            {kind && <Chip label={kind} to={{ ...search, kind: undefined }} />}
            {activeTags.map((t) => (
              <Chip key={t} label={`#${t}`} onClear={() => toggleTag(t)} />
            ))}
            <Link
              to="/skills"
              search={{}}
              className="ml-1 font-mono text-[11px] text-primary hover:underline"
            >
              clear all
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_260px]">
          <div>
            <div className="mb-4 font-mono text-xs text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"}
              {skills.length > 0 && <> of {skills.length} published</>}
            </div>
            <div className="space-y-3">
              {results.map((s) => (
                <SkillCard key={s.slug} skill={s} />
              ))}
              {results.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="font-mono text-sm text-muted-foreground">
                    No skills matched those filters.
                  </p>
                  <Link
                    to="/skills"
                    search={{}}
                    className="mt-3 inline-block font-mono text-xs text-primary hover:underline"
                  >
                    reset filters
                  </Link>
                </div>
              )}
            </div>
          </div>

          <aside>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Categories
            </h2>
            <ul className="divide-y divide-border border-y border-border font-mono text-sm">
              {categoryFacets.length === 0 && (
                <li className="py-2.5 text-xs text-muted-foreground">none yet</li>
              )}
              {categoryFacets.map(([c, n]) => (
                <li key={c} className="flex items-center justify-between py-2.5">
                  <Link
                    to="/skills"
                    search={{ ...search, category: category === c ? undefined : c }}
                    className={cn(
                      "text-muted-foreground hover:text-signal",
                      category === c && "text-signal",
                    )}
                  >
                    {c}
                  </Link>
                  <span className="text-[11px] text-muted-foreground/70">{n}</span>
                </li>
              ))}
            </ul>

            <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Tags
            </h2>
            {tagFacets.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                Tags appear once skills are published.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tagFacets.map(([t, n]) => {
                  const on = activeTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-[11px]",
                        on
                          ? "border-signal/50 bg-signal/10 text-signal"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
                      )}
                    >
                      #{t}
                      <span className="ml-1.5 opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Chip({
  label,
  to,
  onClear,
}: {
  label: string;
  to?: SkillSearch;
  onClear?: () => void;
}) {
  const inner = (
    <>
      {label}
      <span className="ml-1.5 opacity-70">✕</span>
    </>
  );
  const cls =
    "rounded-md border border-signal/40 bg-signal/10 px-2 py-1 font-mono text-[11px] text-signal";
  if (to) {
    return (
      <Link to="/skills" search={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClear} className={cls}>
      {inner}
    </button>
  );
}
