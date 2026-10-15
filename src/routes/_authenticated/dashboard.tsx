import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VerifiedBadge } from "@/components/verified-badge";
import { getDashboard, createApiKey, revokeApiKey } from "@/lib/billing.functions";
import { getFooterAnalyticsData } from "@/lib/analytics.functions";
import { getSearchPerformance } from "@/lib/search-console.functions";


const title = "API keys & usage — emskills";
const description =
  "Monitor MCP run volume and manage the API keys your agents use against the registry.";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Data = Awaited<ReturnType<typeof getDashboard>>;
type FooterData = Awaited<ReturnType<typeof getFooterAnalyticsData>>;



function Dashboard() {
  const load = useServerFn(getDashboard);
  const loadFooter = useServerFn(getFooterAnalyticsData);

  const mint = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);

  const [data, setData] = useState<Data | null>(null);
  const [footer, setFooter] = useState<FooterData | null>(null);
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [preset, setPreset] = useState<7 | 30 | 90 | "custom">(30);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    load()
      .then((d) => setData(d as Data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  useEffect(refresh, [refresh]);



  useEffect(() => {
    loadFooter({ data: range })
      .then((d) => setFooter(d as FooterData))
      .catch(() => {});
  }, [loadFooter, range]);

  function applyPreset(days: 7 | 30 | 90) {
    setPreset(days);
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    setRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  }


  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await mint({ data: { name: keyName.trim() } });
      if (res.ok) {
        setNewSecret(res.secret);
        setKeyName("");
        refresh();
      } else setNotice(res.message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    await revoke({ data: { id } });
    refresh();
  }


  const usage = data?.usage;
  const peak = Math.max(1, ...(usage?.series.map((s) => s.runs) ?? [1]));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">registry / dashboard</div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          API keys &amp; usage
        </h1>
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Run volume across the last 30 days and the keys your agents authenticate
          with. emskills is free to use — no plans, no limits.
        </p>

        {error && (
          <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-6 rounded-md border border-brass/40 bg-brass/10 px-3 py-2 font-mono text-xs text-brass">
            {notice}
          </p>
        )}
        {!data && !error && (
          <p className="mt-10 font-mono text-sm text-muted-foreground">loading readout…</p>
        )}

        {data && usage && (
          <>
            {/* ---- Stat strip ---- */}
            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border font-mono sm:grid-cols-4">
              <Stat label="runs / 30d" value={usage.totals.runs.toLocaleString()} accent />
              <Stat label="errors" value={usage.totals.errors.toLocaleString()} />
              <Stat label="avg latency" value={`${usage.totals.avgMs} ms`} />
              <Stat
                label="quota left / mo"
                value={data.quota.remaining.toLocaleString()}
              />
            </div>

            {/* ---- Monthly fair-use quota ---- */}
            <section className="mt-6 rounded-lg border border-border bg-panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <span>monthly fair-use quota</span>
                <span>
                  {data.quota.used.toLocaleString()} / {data.quota.limit.toLocaleString()} runs
                  · resets {data.quota.resetsAt}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-2 bg-signal"
                  style={{
                    width: `${Math.min(100, (data.quota.used / data.quota.limit) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                Free platform — this ceiling and the {data.quota.requestsPerMinute}/min rate
                limit are abuse guards, never billed.{" "}
                <Link to="/api-keys" className="text-signal hover:underline">
                  manage keys →
                </Link>
              </p>
            </section>

            {/* ---- Usage chart ---- */}
            <section className="mt-8 rounded-lg border border-border bg-panel p-5">
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <span>mcp run volume · 30 d</span>
                <span>{usage.totals.runs.toLocaleString()} runs</span>
              </div>
              <div className="mt-5 flex h-32 items-end gap-[3px]">
                {usage.series.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day} · ${d.runs} runs, ${d.errors} errors`}
                    className="flex-1 rounded-sm bg-signal/70 transition-colors hover:bg-signal"
                    style={{ height: `${Math.max(2, (d.runs / peak) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{usage.series[0]?.day}</span>
                <span>{usage.series[usage.series.length - 1]?.day}</span>
              </div>

              {usage.topEndpoints.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    top endpoints
                  </div>
                  <ul className="mt-3 space-y-2 font-mono text-xs">
                    {usage.topEndpoints.map((e) => {
                      const top = Math.max(1, ...usage.topEndpoints.map((x) => x.runs));
                      return (
                        <li key={e.endpoint}>
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              to="/skills/$slug"
                              params={{ slug: e.slug }}
                              className="text-signal hover:underline"
                            >
                              {e.slug}
                            </Link>
                            <span className="text-muted-foreground">{e.tool}</span>
                            <span className="ml-auto text-muted-foreground">
                              {e.avgMs} ms avg
                              {e.errors > 0 ? ` · ${e.errors} err` : ""}
                            </span>
                            <span className="w-12 text-right">{e.runs}</span>
                          </div>
                          <div className="mt-1.5 h-1 bg-border">
                            <div
                              className="h-1 bg-signal"
                              style={{ width: `${(e.runs / top) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {usage.topSkills.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    top skills
                  </div>
                  <ul className="mt-3 space-y-2 font-mono text-xs">
                    {usage.topSkills.map((s) => (
                      <li key={s.slug} className="flex justify-between gap-4">
                        <Link to="/skills/$slug" params={{ slug: s.slug }} className="text-signal hover:underline">
                          {s.slug}
                        </Link>
                        <span className="text-muted-foreground">{s.runs} runs</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="space-y-8">
                {/* ---- API keys ---- */}
                <section className="rounded-lg border border-border bg-card p-5">
                  <h2 className="font-display text-lg font-semibold">API keys</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send as <code className="font-mono text-xs">Authorization: Bearer ems_live_…</code>{" "}
                    when your agent calls a registry MCP endpoint.
                  </p>

                  <form onSubmit={handleMint} className="mt-4 flex flex-wrap gap-2">
                    <input
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="key name — e.g. titan-workstation"
                      className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-signal"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-md bg-signal px-4 py-2 font-mono text-xs font-medium text-signal-foreground disabled:opacity-50"
                    >
                      {busy ? "minting…" : "Create key"}
                    </button>
                  </form>

                  {newSecret && (
                    <div className="mt-4 rounded-md border border-signal/40 bg-signal/10 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-signal">
                        copy now — shown once
                      </div>
                      <div className="mt-2 break-all font-mono text-xs">{newSecret}</div>
                      <button
                        onClick={() => void navigator.clipboard.writeText(newSecret)}
                        className="mt-2 font-mono text-[11px] text-signal underline"
                      >
                        copy to clipboard
                      </button>
                    </div>
                  )}

                  <div className="mt-5 space-y-2">
                    {data.keys.length === 0 && (
                      <p className="rounded-md border border-dashed border-border p-6 text-center font-mono text-xs text-muted-foreground">
                        No keys yet.
                      </p>
                    )}
                    {data.keys.map((k) => (
                      <div
                        key={k.id}
                        className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5 font-mono text-xs"
                      >
                        <span className="font-semibold">{k.name}</span>
                        <span className="text-muted-foreground">{k.key_prefix}…</span>
                        <span className="text-muted-foreground">
                          {k.last_used_at ? `used ${k.last_used_at.slice(0, 10)}` : "never used"}
                        </span>
                        <span className="ml-auto">
                          {k.revoked_at ? (
                            <span className="text-destructive">revoked</span>
                          ) : (
                            <button
                              onClick={() => void handleRevoke(k.id)}
                              className="text-muted-foreground underline hover:text-destructive"
                            >
                              revoke
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ---- Recent runs ---- */}
                <section className="rounded-lg border border-border bg-card p-5">
                  <h2 className="font-display text-lg font-semibold">Recent runs</h2>
                  {usage.recent.length === 0 ? (
                    <p className="mt-4 rounded-md border border-dashed border-border p-6 text-center font-mono text-xs text-muted-foreground">
                      No MCP runs recorded yet — try one from a skill page.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-2 font-mono text-xs">
                      {usage.recent.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5"
                        >
                          <Link
                            to="/skills/$slug"
                            params={{ slug: r.skill_slug }}
                            className="text-signal hover:underline"
                          >
                            {r.skill_slug}
                          </Link>
                          <span className="text-muted-foreground">{r.mode}</span>
                          <span className={r.status === "ok" ? "text-signal" : "text-destructive"}>
                            {r.status}
                          </span>
                          <span className="text-muted-foreground">{r.duration_ms} ms</span>
                          <span className="ml-auto text-muted-foreground">
                            {r.created_at.slice(0, 16).replace("T", " ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* ---- Footer link analytics ---- */}
                <section className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold">Footer link clicks</h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      {footer ? `${footer.total} clicks · ${footer.from} → ${footer.to}` : "loading…"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    {([7, 30, 90] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => applyPreset(d)}
                        className={`rounded-md border px-2.5 py-1.5 ${
                          preset === d
                            ? "border-signal text-signal"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                    <span className="ml-2 text-muted-foreground">from</span>
                    <input
                      type="date"
                      value={range.from ?? ""}
                      onChange={(e) => {
                        setPreset("custom");
                        setRange((r) => ({ ...r, from: e.target.value || null }));
                      }}
                      className="rounded-md border border-border bg-background px-2 py-1.5"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="date"
                      value={range.to ?? ""}
                      onChange={(e) => {
                        setPreset("custom");
                        setRange((r) => ({ ...r, to: e.target.value || null }));
                      }}
                      className="rounded-md border border-border bg-background px-2 py-1.5"
                    />
                  </div>

                  {footer && footer.total > 0 && (
                    <div className="mt-4 flex h-16 items-end gap-[2px]">
                      {footer.series.map((p) => {
                        const top = Math.max(1, ...footer.series.map((x) => x.clicks));
                        return (
                          <div
                            key={p.date}
                            title={`${p.date}: ${p.clicks}`}
                            className="flex-1 bg-signal/60"
                            style={{ height: `${Math.max(2, (p.clicks / top) * 100)}%` }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {footer && footer.links.length === 0 ? (
                    <p className="mt-4 rounded-md border border-dashed border-border p-6 text-center font-mono text-xs text-muted-foreground">
                      No footer link clicks in this range.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-2 font-mono text-xs">
                      {footer?.links.map((l) => {
                        const top = Math.max(1, ...footer.links.map((x) => x.clicks));
                        const id = `${l.section}-${l.label}`;
                        const isOpen = expanded === id;
                        const peak = Math.max(1, ...l.series.map((p) => p.clicks));
                        return (
                          <li key={id} className="rounded-md border border-border px-3 py-2.5">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => setExpanded(isOpen ? null : id)}
                              className="flex w-full items-center gap-3 text-left"
                            >
                              <span>{l.label}</span>
                              <span className="text-muted-foreground">{l.section}</span>
                              <span className="ml-auto text-signal">{l.clicks}</span>
                              <span className="text-muted-foreground">{isOpen ? "−" : "+"}</span>
                            </button>
                            <div className="mt-2 h-1 bg-border">
                              <div
                                className="h-1 bg-signal"
                                style={{ width: `${(l.clicks / top) * 100}%` }}
                              />
                            </div>
                            {isOpen && (
                              <div className="mt-3 border-t border-border pt-3">
                                <div className="flex h-12 items-end gap-[2px]">
                                  {l.series.map((p) => (
                                    <div
                                      key={p.date}
                                      title={`${p.date}: ${p.clicks}`}
                                      className="flex-1 bg-brass/60"
                                      style={{ height: `${Math.max(2, (p.clicks / peak) * 100)}%` }}
                                    />
                                  ))}
                                </div>
                                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                                  <span>{l.series[0]?.date}</span>
                                  <span>
                                    last click{" "}
                                    {l.lastClickedAt
                                      ? l.lastClickedAt.slice(0, 16).replace("T", " ")
                                      : "—"}
                                  </span>
                                  <span>{l.series[l.series.length - 1]?.date}</span>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                </section>

                {/* ---- Search performance (Google Search Console) ---- */}
                <SearchPerformance />
              </div>


              <aside className="h-fit space-y-6">
                <div className="rounded-lg border border-border bg-panel p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    publisher status
                  </div>
                  <div className="mt-3">
                    <VerifiedBadge
                      level={
                        data.verification?.status === "verified"
                          ? data.verification.badge
                          : "community"
                      }
                    />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {data.verification
                      ? `Request for ${data.verification.org} is ${data.verification.status}.`
                      : "Apply for publisher certification to display a verified badge on your skills."}
                  </p>
                  <Link
                    to="/contribute"
                    className="mt-4 inline-block font-mono text-xs text-signal hover:underline"
                  >
                    manage verification →
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-lg ${accent ? "text-signal" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

type PerfOk = Extract<
  Awaited<ReturnType<typeof getSearchPerformance>>,
  { status: "ok" }
>;
type PerfState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "selection_required"; candidates: string[] }
  | PerfOk;

/** Google Search Console performance for emskills.org — last 28 complete days. */
function SearchPerformance() {
  const fetchPerf = useServerFn(getSearchPerformance);
  const [state, setState] = useState<PerfState>({ status: "loading" });

  const load = useCallback(
    async (siteUrl?: string) => {
      setState({ status: "loading" });
      try {
        const res = await fetchPerf({ data: siteUrl ? { siteUrl } : {} });
        setState(res as PerfState);
      } catch (e) {
        setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },
    [fetchPerf],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Search performance</h2>
        {state.status === "ok" && (
          <span className="font-mono text-xs text-muted-foreground">
            {state.range.from} → {state.range.to} · {state.siteUrl}
          </span>
        )}
      </div>

      {state.status === "loading" && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          pulling Search Console data…
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.status === "selection_required" && (
        <div className="mt-4">
          <p className="font-mono text-xs text-muted-foreground">
            Several verified properties cover emskills.org — pick one:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.candidates.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void load(c)}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-signal hover:text-signal"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.status === "ok" && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border font-mono sm:grid-cols-3">
            <Stat label="clicks / 28d" value={state.totals.clicks.toLocaleString()} accent />
            <Stat label="impressions" value={state.totals.impressions.toLocaleString()} />
            <Stat label="ctr" value={pct(state.totals.ctr)} />
            <Stat label="avg position" value={state.totals.position.toFixed(1)} />
          </div>

          {state.byDate.length > 0 && (
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                daily clicks
              </div>
              <div className="mt-2 flex h-20 items-end gap-[2px]">
                {state.byDate.map((d) => {
                  const peak = Math.max(1, ...state.byDate.map((x) => x.clicks));
                  return (
                    <div
                      key={d.date}
                      title={`${d.date} · ${d.clicks} clicks, ${d.impressions} impressions`}
                      className="flex-1 rounded-sm bg-signal/70 hover:bg-signal"
                      style={{ height: `${Math.max(2, (d.clicks / peak) * 100)}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{state.byDate[0]?.date}</span>
                <span>{state.byDate[state.byDate.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {state.totals.clicks === 0 && state.totals.impressions === 0 && (
            <p className="mt-4 rounded-md border border-dashed border-border p-6 text-center font-mono text-xs text-muted-foreground">
              No reported data yet — Search Console lags a few days and omits low-volume queries.
            </p>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                top queries
              </div>
              {state.topQueries.length === 0 ? (
                <p className="mt-3 font-mono text-xs text-muted-foreground">none reported</p>
              ) : (
                <table className="mt-3 w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-left uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="py-1.5 pr-2 font-normal">query</th>
                      <th className="py-1.5 pr-2 text-right font-normal">clicks</th>
                      <th className="py-1.5 pr-2 text-right font-normal">impr.</th>
                      <th className="py-1.5 pr-2 text-right font-normal">ctr</th>
                      <th className="py-1.5 text-right font-normal">pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.topQueries.map((q) => (
                      <tr key={q.query} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[180px] truncate py-1.5 pr-2">{q.query}</td>
                        <td className="py-1.5 pr-2 text-right text-signal">{q.clicks}</td>
                        <td className="py-1.5 pr-2 text-right text-muted-foreground">
                          {q.impressions}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-muted-foreground">
                          {pct(q.ctr)}
                        </td>
                        <td className="py-1.5 text-right text-muted-foreground">
                          {q.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                top pages
              </div>
              {state.topPages.length === 0 ? (
                <p className="mt-3 font-mono text-xs text-muted-foreground">none reported</p>
              ) : (
                <table className="mt-3 w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-left uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="py-1.5 pr-2 font-normal">page</th>
                      <th className="py-1.5 pr-2 text-right font-normal">clicks</th>
                      <th className="py-1.5 text-right font-normal">impr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.topPages.map((p) => (
                      <tr key={p.page} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[220px] truncate py-1.5 pr-2">
                          <a
                            href={p.page}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-signal hover:underline"
                          >
                            {p.page.replace(/^https?:\/\/(www\.)?emskills\.org/, "") || "/"}
                          </a>
                        </td>
                        <td className="py-1.5 pr-2 text-right text-signal">{p.clicks}</td>
                        <td className="py-1.5 text-right text-muted-foreground">
                          {p.impressions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
