import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getEvalReport, type EvalRecord } from "@/lib/skills.functions";
import { jsonLdScript, webPageJsonLd } from "@/lib/seo";

const title = "Skill quality — emskills";
const description =
  "Live NVIDIA SkillEvaluator (Tier 1 + Tier 2) results for every skill in the emskills registry.";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      jsonLdScript(webPageJsonLd({ path: "/quality", name: title, description })),
    ],
  }),
  component: QualityPage,
});

type Filter = "all" | "pass" | "fail" | "pending";

function QualityPage() {
  const load = useServerFn(getEvalReport);
  const [records, setRecords] = useState<EvalRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const refresh = useCallback(() => {
    load()
      .then((d) => setRecords(d as EvalRecord[]))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  useEffect(refresh, [refresh]);

  const stats = records
    ? {
        total: records.length,
        pass: records.filter((r) => r.eval_tier1?.pass === true).length,
        fail: records.filter((r) => r.eval_tier1?.pass === false).length,
        pending: records.filter((r) => r.eval_tier1 === null).length,
        tier2Pairs: records.reduce((n, r) => n + (r.eval_tier2?.similar_pairs?.length ?? 0), 0),
      }
    : null;

  const visible = records
    ? records.filter((r) => {
        if (filter === "pass" && r.eval_tier1?.pass !== true) return false;
        if (filter === "fail" && r.eval_tier1?.pass !== false) return false;
        if (filter === "pending" && r.eval_tier1 !== null) return false;
        if (q) {
          const lq = q.toLowerCase();
          if (!r.slug.includes(lq) && !r.name.toLowerCase().includes(lq)) return false;
        }
        return true;
      })
    : [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-5 py-12">
        {/* Breadcrumb */}
        <div className="font-mono text-xs text-muted-foreground">registry / quality</div>

        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Skill quality report
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Automated evaluation using{" "}
          <a
            href="https://github.com/NVIDIA/SkillEvaluator"
            target="_blank"
            rel="noreferrer"
            className="text-signal hover:underline"
          >
            NVIDIA SkillEvaluator 0.9.0
          </a>
          . Tier 1 validates structure and required fields; Tier 2 flags semantically similar
          skills above the 0.82 cosine threshold.
        </p>

        {error && (
          <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {/* Stats */}
        {stats && (
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
            <Stat label="total skills" value={stats.total} />
            <Stat label="tier 1 pass" value={stats.pass} accent="signal" />
            {stats.fail ? (
              <Stat label="tier 1 fail" value={stats.fail} accent="destructive" />
            ) : (
              <Stat label="tier 1 fail" value={stats.fail} />
            )}
            {stats.pending ? (
              <Stat label="pending eval" value={stats.pending} accent="brass" />
            ) : (
              <Stat label="pending eval" value={stats.pending} />
            )}
            <Stat label="tier 2 pairs" value={stats.tier2Pairs} />
          </div>
        )}

        {/* Progress bar */}
        {stats && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-2 bg-signal transition-all"
                style={{ width: `${stats.total ? Math.round((stats.pass / stats.total) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>{stats.pass} / {stats.total} passed Tier 1</span>
              <span>
                {stats.total ? Math.round((stats.pass / stats.total) * 100) : 0}% pass rate
              </span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter by slug or name…"
            className="min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-signal"
          />
          {(["all", "pass", "fail", "pending"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md border px-3 py-1 font-mono text-[11px] transition-colors ${
                filter === f
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-border text-muted-foreground hover:border-signal/50"
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {visible.length} skills
          </span>
        </div>

        {/* Table */}
        {!records && !error && (
          <p className="mt-10 font-mono text-sm text-muted-foreground">loading…</p>
        )}

        {records && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[700px] border-collapse font-mono text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="border-b border-border bg-panel px-4 py-3 font-normal">slug</th>
                  <th className="border-b border-border bg-panel px-4 py-3 font-normal">technique</th>
                  <th className="border-b border-border bg-panel px-4 py-3 font-normal">org</th>
                  <th className="border-b border-border bg-panel px-4 py-3 font-normal">tier 1</th>
                  <th className="border-b border-border bg-panel px-4 py-3 font-normal">tier 2</th>
                  <th className="border-b border-border bg-panel px-4 py-3 font-normal">issues</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No skills match.
                    </td>
                  </tr>
                )}
                {visible.map((r) => {
                  const t1 = r.eval_tier1;
                  const t2 = r.eval_tier2;
                  return (
                    <tr key={r.slug} className="border-b border-border last:border-0 hover:bg-panel/50">
                      <td className="px-4 py-2.5">
                        <a
                          href={`/skills/${r.slug}`}
                          className="text-signal hover:underline"
                        >
                          {r.slug}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.technique}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.org}</td>
                      <td className="px-4 py-2.5">
                        {t1 === null ? (
                          <Pill label="pending" color="brass" />
                        ) : t1.pass ? (
                          <Pill label="pass" color="signal" />
                        ) : (
                          <Pill label="fail" color="destructive" />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {t2 === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : t2.similar_pairs.length > 0 ? (
                          <span className="text-brass">
                            {t2.similar_pairs.length} pair{t2.similar_pairs.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <Pill label="ok" color="signal" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {t1?.issues?.length
                          ? t1.issues.join("; ")
                          : <span className="opacity-40">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="text-signal">■</span> pass — Tier 1 validation passed
          </span>
          <span>
            <span className="text-destructive">■</span> fail — required fields missing or invalid
          </span>
          <span>
            <span className="text-brass">■</span> pending — not yet evaluated
          </span>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "signal" | "destructive" | "brass";
}) {
  return (
    <div className="bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div
        className={`mt-1.5 text-xl font-mono ${
          accent === "signal"
            ? "text-signal"
            : accent === "destructive"
              ? "text-destructive"
              : accent === "brass"
                ? "text-brass"
                : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: "signal" | "destructive" | "brass" }) {
  const cls =
    color === "signal"
      ? "border-signal/40 bg-signal/10 text-signal"
      : color === "destructive"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-brass/40 bg-brass/10 text-brass";
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${cls}`}>
      {label}
    </span>
  );
}
