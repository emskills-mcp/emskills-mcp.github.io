import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
  skillJsonLd,
  webPageJsonLd,
} from "@/lib/seo";
import { SiteFooter } from "@/components/site-footer";
import { useServerFn } from "@tanstack/react-start";
import {
  getSkillBySlug,
  getSkillReadme,
  getSkillVersions,
  runSkillTool,
} from "@/lib/skills.functions";
import { gradeTestRun } from "@/lib/jev.functions";
import { QualityBars } from "@/components/ai-triage";
import { Markdown } from "@/components/markdown";
import { VerifiedBadge } from "@/components/verified-badge";
import { collapseContext, diffLines } from "@/lib/diff";

export const Route = createFileRoute("/skills/$slug")({
  loader: async ({ params }) => {
    const { skill, related } = await getSkillBySlug({
      data: { slug: params.slug },
    });
    if (!skill) throw notFound();
    return { skill, related };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Skill not found — emskills" }, { name: "robots", content: "noindex" }],
      };
    }
    const { skill } = loaderData;
    const title = `${skill.name} — ${skill.technique} skill | emskills`;
    return {
      meta: [
        { title },
        { name: "description", content: skill.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: skill.summary },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: skill.summary },
        { property: "og:site_name", content: "emskills" },
        { property: "og:url", content: absoluteUrl(`/skills/${skill.slug}`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/skills/${skill.slug}`) },
      ],
      scripts: [
        jsonLdScript(
          webPageJsonLd({
            path: `/skills/${skill.slug}`,
            name: title,
            description: skill.summary,
          }),
        ),
        jsonLdScript(skillJsonLd(skill)),
        jsonLdScript(
          breadcrumbJsonLd([
            { name: "emskills", path: "/" },
            { name: "Skills", path: "/skills" },
            { name: skill.name, path: `/skills/${skill.slug}` },
          ]),
        ),
      ],
    };
  },
  notFoundComponent: SkillNotFound,
  component: SkillDetail,
});

function SkillNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-5 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Skill not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That entry is not in the index — it may have been unpublished.
        </p>
        <Link to="/skills" className="mt-6 inline-block font-mono text-xs text-signal">
          ← back to the registry
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function SkillDetail() {
  const { skill, related } = Route.useLoaderData();
  const [showRun, setShowRun] = useState(false);
  const [showMd, setShowMd] = useState(false);
  const [copied, setCopied] = useState(false);
  // Hosted runs are only offered when the manifest declares an mcp_endpoint.
  const hasEndpoint = Boolean(skill.mcpEndpoint);


  const repoUrl = `https://github.com/${skill.repo}`;
  const skillMdUrl = `${repoUrl}/blob/HEAD/skills/${skill.slug}/SKILL.md`;
  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        [skill.slug]: {
          command: "npx",
          args: ["-y", "emskills", "run", skill.slug],
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="flex items-baseline justify-between font-mono text-xs text-muted-foreground">
          <div>
            <Link to="/skills" className="hover:text-signal">
              skills
            </Link>{" "}
            / <span className="text-foreground">{skill.name}</span>
          </div>
          <VersionSelect slug={skill.slug} liveVersion={skill.version} />
        </div>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight">{skill.name}</h1>
              <span className="rounded border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-xs text-signal">
                {skill.technique}
              </span>
              <span className="rounded border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {skill.kind}
              </span>
              <VerifiedBadge level={skill.verifiedBadge} />
            </div>

            <p className="mt-4 max-w-[62ch] text-pretty text-base leading-relaxed text-muted-foreground">
              {skill.description}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border font-mono sm:grid-cols-4">
              <Cell label="tool call" value={skill.toolCall} />
              <Cell label="license" value={skill.license} />
              <Cell label="runtime" value={skill.runtime} />
              <Cell label="stars" value={`★ ${skill.stars.toLocaleString()}`} accent />
            </div>

            <div className="mt-6 rounded-lg border border-border bg-panel p-4 font-mono text-xs leading-relaxed">
              <div className="text-muted-foreground">// emskills.config.json</div>
              <div className="mt-2">
                <span className="text-signal">&quot;skills&quot;</span>: [
                <span className="text-brass">&quot;{skill.slug}&quot;</span>]
              </div>
              <div className="mt-1 text-muted-foreground">
                $ npx emskills add {skill.slug}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRun((v) => !v)}
                aria-expanded={showRun}
                className="rounded-md bg-signal px-4 py-2.5 font-mono text-sm font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px"
              >
                Test this skill
              </button>

              <button
                type="button"
                onClick={() => setShowMd((v) => !v)}
                aria-expanded={showMd}
                className="rounded-md border border-border bg-panel px-4 py-2.5 font-mono text-sm text-muted-foreground transition-transform duration-200 hover:-translate-y-px hover:text-foreground"
              >
                {showMd ? "Hide SKILL.md" : "Read SKILL.md"}
              </button>
              <a
                href={skillMdUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-border bg-panel px-4 py-2.5 font-mono text-sm text-muted-foreground transition-transform duration-200 hover:-translate-y-px hover:text-foreground"
              >
                Open on GitHub ↗
              </a>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(mcpConfig);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="rounded-md border border-border bg-panel px-4 py-2.5 font-mono text-sm text-muted-foreground hover:text-signal"
              >
                {copied ? "config copied" : "Copy install config"}
              </button>
            </div>

            <p className="mt-3 rounded-md border border-border bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
              {hasEndpoint ? (
                <>
                  Test runs are dispatched to the publisher&apos;s endpoint declared in
                  SKILL.md: <span className="text-foreground">{skill.mcpEndpoint}</span>
                </>
              ) : (
                <>
                  Test runs are served by the registry&apos;s own sandbox, executed by a
                  model grounded in this SKILL.md — a dry run of the procedure, not the
                  vendor&apos;s production code.
                </>
              )}
            </p>

            {showRun && <RunPanel slug={skill.slug} tool={skill.toolCall} />}

            {skill.quality && (
              <section className="mt-6 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <span>quality scores</span>
                  <span className="text-signal">overall {Math.round(skill.quality.overall * 100)}</span>
                </div>
                <div className="mt-3">
                  <QualityBars q={skill.quality} />
                </div>
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                  AI-assessed from the SKILL.md. Read the source before pointing it at an instrument.
                </p>
              </section>
            )}

            {showMd && <SkillMdPanel slug={skill.slug} />}

            <SkillDocs
              slug={skill.slug}
              tool={skill.toolCall}
              runtime={skill.runtime}
              hostedEndpoint={skill.mcpEndpoint ?? `/api/public/mcp/${skill.slug}`}
              mcpConfig={mcpConfig}
            />

          </div>

          <aside className="h-fit rounded-lg border border-border bg-panel p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              metadata
            </div>
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">repo</dt>
                <dd className="text-right">
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-signal hover:underline"
                  >
                    {skill.repo} ↗
                  </a>
                </dd>
              </div>
              <Row k="updated" v={skill.updated} />
              <Row k="downloads" v={skill.downloads.toLocaleString()} />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">publisher</dt>
                <dd className="flex flex-wrap items-center justify-end gap-2 text-right">
                  <span>{skill.org}</span>
                  <VerifiedBadge level={skill.verifiedBadge} />
                </dd>
              </div>
              <Row k="category" v={skill.category} />
              <Row k="tags" v={skill.tags.join(", ")} />
            </dl>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Related {skill.technique} skills
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {related.map((s) => (
                <Link
                  key={s.slug}
                  to="/skills/$slug"
                  params={{ slug: s.slug }}
                  className="rounded-lg border border-border bg-card p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:border-signal/50"
                >
                  <div className="font-display text-sm font-semibold">{s.name}</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {s.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-sm ${accent ? "text-brass" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </div>
  );
}

type RunState = Awaited<ReturnType<typeof runSkillTool>> | null;

function RunPanel({ slug, tool }: { slug: string; tool: string }) {
  const run = useServerFn(runSkillTool);
  const [args, setArgs] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunState>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const grader = useServerFn(gradeTestRun);
  const [grade, setGrade] = useState<Awaited<ReturnType<typeof gradeTestRun>> | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeErr, setGradeErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setFatal(null);
    setResult(null);
    setGrade(null);
    setGradeErr(null);
    let out: string | null = null;
    try {
      const r = await run({ data: { slug, args } });
      setResult(r);
      out = r.output ?? null;
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
    if (out) {
      setGrading(true);
      try {
        setGrade(await grader({ data: { slug, args, output: out.slice(0, 20000) } }));
      } catch (e) {
        setGradeErr(e instanceof Error ? e.message : String(e));
      } finally {
        setGrading(false);
      }
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-signal/30 bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          server-side invocation · {tool}
        </div>
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className="rounded-md bg-signal px-3.5 py-1.5 font-mono text-xs font-medium text-signal-foreground disabled:opacity-60"
        >
          {busy ? "running…" : "Execute"}
        </button>
      </div>

      <label className="mt-3 block">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          arguments (JSON)
        </span>
        <textarea
          rows={3}
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          spellCheck={false}
          className="mt-1.5 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-signal"
        />
      </label>

      {fatal && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {fatal}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span
              className={`rounded px-1.5 py-0.5 ${result.ok ? "bg-signal/15 text-signal" : "bg-destructive/15 text-destructive"}`}
            >
              {result.ok ? "success" : "failed"}
            </span>
            <span className="text-muted-foreground">mode: {result.mode}</span>
            <span className="text-muted-foreground">
              endpoint: {result.endpoint ?? "none registered"}
            </span>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              logs
            </div>
            <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
              {result.logs
                .map(
                  (l) =>
                    `[${String(l.t).padStart(5, " ")}ms] ${l.level.toUpperCase().padEnd(5)} ${l.msg}`,
                )
                .join("\n")}
            </pre>
          </div>

          {result.error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {result.error}
            </p>
          )}

          {result.output && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                output
              </div>
              <pre className="mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
                {result.output}
              </pre>
            </div>
          )}

          {result.output && (
            <div className="rounded-md border border-border bg-background p-3 font-mono text-[11px]">
              {grading && <span className="text-muted-foreground">grading output…</span>}
              {gradeErr && <span className="text-destructive">{gradeErr}</span>}
              {grade && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="uppercase tracking-[0.15em] text-muted-foreground">AI grade</span>
                  <span className={`rounded px-1.5 py-0.5 ${grade.fulfilled >= 0.6 ? "bg-signal/15 text-signal" : "bg-destructive/15 text-destructive"}`}>
                    {grade.fulfilled >= 0.6 ? "did what it promised" : "may not have done what it promised"} ({Math.round(grade.fulfilled * 100)}%)
                  </span>
                  <span className="text-muted-foreground">usefulness {Math.round(grade.usefulness * 100)}</span>
                  {grade.errorReported >= 0.5 && <span className="text-brass">output reports an error</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type SkillVersion = Awaited<ReturnType<typeof getSkillVersions>>[number];

/** Public version dropdown: browse prior approved snapshots and diff them vs live. */
const fmtV = (x: string) => `v${x.replace(/^v+/, "")}`;

function VersionSelect({ slug, liveVersion }: { slug: string; liveVersion: string }) {
  const fetchVersions = useServerFn(getSkillVersions);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; error: string } | { status: "ok"; versions: SkillVersion[] }
  >({ status: "idle" });
  const [selectedId, setSelectedId] = useState<string>("live");

  useEffect(() => {
    if (!open || state.status !== "idle") return;
    let alive = true;
    setState({ status: "loading" });
    fetchVersions({ data: { slug } })
      .then((versions) => {
        if (alive) setState({ status: "ok", versions });
      })
      .catch((e: unknown) => {
        if (alive)
          setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
    };
  }, [open, state.status, fetchVersions, slug]);

  const versions = state.status === "ok" ? state.versions : [];
  const selected =
    selectedId === "live" ? null : (versions.find((v) => v.id === selectedId) ?? null);

  const mdRows = useMemo(() => {
    if (!selected) return [];
    const live = versions[0];
    return collapseContext(
      diffLines(selected.skillMd ?? "", live?.id === selected.id ? selected.skillMd ?? "" : (live?.skillMd ?? "")),
      2,
    ).filter((r) => !("count" in r) && r.type === "same" ? false : true);
  }, [selected, versions]);

  return (
    <div className="flex items-center gap-2">
      <span>SKILL.md ·</span>
      <select
        value={selectedId}
        onChange={(e) => {
          setSelectedId(e.target.value);
          if (e.target.value !== "live" && !open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Browse skill versions"
        className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-signal"
      >
        <option value="live">{fmtV(liveVersion)} (live)</option>
        {versions
          .filter((v) => v.version !== liveVersion || v.id !== versions[0]?.id)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {fmtV(v.version)} · {new Date(v.createdAt).toLocaleDateString()} · {v.origin}
            </option>
          ))}
      </select>

      {state.status === "loading" && (
        <span className="font-mono text-[11px] text-muted-foreground">loading…</span>
      )}
      {state.status === "error" && (
        <span role="alert" className="font-mono text-[11px] text-destructive">
          {state.error}
        </span>
      )}
      {state.status === "ok" && versions.length === 0 && (
        <span className="font-mono text-[11px] text-muted-foreground">no prior snapshots</span>
      )}

      {selected && (
        <div className="mt-3 basis-full rounded-lg border border-border bg-card p-4 text-left">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
            <span className="text-foreground">{fmtV(selected.version)}</span>
            <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              {selected.origin}
            </span>
            <span className="text-muted-foreground">
              {new Date(selected.createdAt).toLocaleString()}
            </span>
            <span className="text-muted-foreground">→ diff vs live {fmtV(liveVersion)}</span>
          </div>
          {selected.changeSummary && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {selected.changeSummary}
            </p>
          )}
          {selected.changedFields.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.changedFields.map((f) => (
                <span
                  key={f}
                  className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px] border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b border-border bg-panel text-left uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="px-3 py-2 font-normal">field</th>
                  <th className="px-3 py-2 font-normal">{fmtV(selected.version)}</th>
                  <th className="px-3 py-2 font-normal">live</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(selected.snapshot)
                  .filter((f) => f !== "skill_md")
                  .map((f) => {
                    const live = versions[0];
                    const fmt = (x: unknown) =>
                      x == null ? "—" : Array.isArray(x) ? x.join(", ") : String(x);
                    const older = fmt(selected.snapshot[f]);
                    const now = fmt(live?.snapshot[f]);
                    if (older === now) return null;
                    return (
                      <tr key={f} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{f}</td>
                        <td className="px-3 py-2 align-top text-secondary-foreground">{older}</td>
                        <td className="px-3 py-2 align-top text-signal">{now}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {mdRows.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-2 border-b border-border bg-panel font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <div className="px-3 py-2">{fmtV(selected.version)} SKILL.md</div>
                <div className="border-l border-border px-3 py-2">live SKILL.md</div>
              </div>
              <div className="max-h-[320px] overflow-auto">
                {mdRows.map((r, i) =>
                  "count" in r ? (
                    <div
                      key={`g${i}`}
                      className="border-b border-border bg-panel/60 px-3 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      ⋯ {r.count} unchanged line{r.count === 1 ? "" : "s"}
                    </div>
                  ) : (
                    <div
                      key={`r${i}`}
                      className={`grid grid-cols-2 border-b border-border/60 font-mono text-[11px] ${
                        r.type === "added"
                          ? "bg-signal/10"
                          : r.type === "removed"
                            ? "bg-destructive/10"
                            : r.type === "changed"
                              ? "bg-primary/10"
                              : ""
                      }`}
                    >
                      <div className="px-3 py-1">
                        <pre className="whitespace-pre-wrap break-words">{r.left ?? ""}</pre>
                      </div>
                      <div className="border-l border-border px-3 py-1">
                        <pre className="whitespace-pre-wrap break-words">{r.right ?? ""}</pre>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkillMdPanel({ slug }: { slug: string }) {
  const fetchMd = useServerFn(getSkillReadme);
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; error: string } | { status: "ok"; markdown: string; path: string }
  >({ status: "loading" });

  useEffect(() => {
    let alive = true;
    fetchMd({ data: { slug } })
      .then((res) => {
        if (!alive) return;
        if (res.ok) setState({ status: "ok", markdown: res.markdown, path: res.path });
        else setState({ status: "error", error: res.error });
      })
      .catch((e: unknown) =>
        alive
          ? setState({ status: "error", error: e instanceof Error ? e.message : String(e) })
          : undefined,
      );
    return () => {
      alive = false;
    };
  }, [fetchMd, slug]);

  return (
    <section className="mt-4 rounded-lg border border-border bg-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {state.status === "ok" ? state.path : "SKILL.md"}
      </div>
      <div className="mt-3">
        {state.status === "loading" && (
          <p className="font-mono text-xs text-muted-foreground">fetching manifest…</p>
        )}
        {state.status === "error" && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {state.error}
          </p>
        )}
        {state.status === "ok" && <Markdown source={state.markdown} />}
      </div>
    </section>
  );
}

/** Documentation + copy-paste examples for installing and testing the skill. */
function SkillDocs({
  slug,
  tool,
  runtime,
  hostedEndpoint,
  mcpConfig,
}: {
  slug: string;
  tool: string;
  runtime: string;
  hostedEndpoint: string;
  mcpConfig: string;
}) {
  const endpointUrl = hostedEndpoint.startsWith("http")
    ? hostedEndpoint
    : `https://emskills.org${hostedEndpoint}`;

  const curl = `curl -s ${endpointUrl} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"${tool}","arguments":{"input":"./dataset.mrc"}}}'`;

  const remoteConfig = JSON.stringify(
    { mcpServers: { [slug]: { type: "http", url: endpointUrl } } },
    null,
    2,
  );

  return (
    <section className="mt-10 space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Documentation
        </h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
          This skill exposes the call{" "}
          <code className="font-mono text-foreground">{tool}</code>, running on{" "}
          <code className="font-mono text-foreground">{runtime}</code>. Install it in
          your agent with the config below, or exercise it from here — the test panel
          above sends a real request to the endpoint and prints every step.
        </p>
      </div>

      <Example title="1 — install in an agent host (Claude, Cursor, ChatGPT)" code={remoteConfig} />
      <Example title="2 — run it locally through the emskills CLI" code={mcpConfig} />
      <Example title={`3 — call ${tool} directly with curl`} code={curl} />
      <Example
        title="4 — example arguments for the test panel"
        code={JSON.stringify({ input: "./dataset.mrc", pixel_size_nm: 0.86 }, null, 2)}
      />
    </section>
  );
}

function Example({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground">
        {code}
      </pre>
    </div>
  );
}
