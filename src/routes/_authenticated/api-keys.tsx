import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  getApiKeysPage,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
} from "@/lib/billing.functions";

const title = "API keys — emskills";
const description =
  "Create, rotate and revoke the API keys your agents use against the emskills MCP registry, and review current fair-use limits.";

export const Route = createFileRoute("/_authenticated/api-keys")({
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
  component: ApiKeysPage,
});

type Data = Awaited<ReturnType<typeof getApiKeysPage>>;

function ApiKeysPage() {
  const load = useServerFn(getApiKeysPage);
  const mint = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const rotate = useServerFn(rotateApiKey);

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    load()
      .then((d) => setData(d as Data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  useEffect(refresh, [refresh]);

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await mint({ data: { name: keyName.trim() } });
      if (res.ok) {
        setSecret({ name: res.key.name, value: res.secret });
        setKeyName("");
        refresh();
      } else setNotice(res.message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await rotate({ data: { id } });
      if (res.ok) {
        setSecret({ name: res.key.name, value: res.secret });
        refresh();
      } else setNotice(res.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    await revoke({ data: { id } });
    refresh();
  }

  const active = data?.keys.filter((k) => !k.revoked_at) ?? [];
  const quota = data?.quota;
  const pct = quota ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">registry / api keys</div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Keys authenticate your agents against registry MCP endpoints. emskills is
          free — the limits below are fair-use guards against abuse, not a paid plan.{" "}
          <Link to="/dashboard" className="text-signal hover:underline">
            see usage charts →
          </Link>
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
          <p className="mt-10 font-mono text-sm text-muted-foreground">loading keys…</p>
        )}

        {data && quota && (
          <>
            {/* ---- Limits ---- */}
            <section className="mt-8 rounded-lg border border-border bg-panel p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                current limits
              </div>
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border font-mono sm:grid-cols-4">
                <Stat label="runs this month" value={quota.used.toLocaleString()} accent />
                <Stat label="remaining" value={quota.remaining.toLocaleString()} />
                <Stat label="rate limit" value={`${quota.requestsPerMinute}/min`} />
                <Stat
                  label="active keys"
                  value={`${active.length} / ${quota.activeKeyLimit}`}
                />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-2 bg-signal" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>
                  {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} runs
                </span>
                <span>resets {quota.resetsAt}</span>
              </div>
            </section>

            {/* ---- Create ---- */}
            <section className="mt-8 rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">Create a key</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Send as{" "}
                <code className="font-mono text-xs">Authorization: Bearer ems_live_…</code>
              </p>
              <form onSubmit={handleMint} className="mt-4 flex flex-wrap gap-2">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  maxLength={60}
                  placeholder="key name — e.g. titan-workstation"
                  className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-signal"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-signal px-4 py-2 font-mono text-xs font-medium text-signal-foreground disabled:opacity-50"
                >
                  {busy ? "working…" : "Create key"}
                </button>
              </form>

              {secret && (
                <div className="mt-4 rounded-md border border-signal/40 bg-signal/10 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-signal">
                    {secret.name} — copy now, shown once
                  </div>
                  <div className="mt-2 break-all font-mono text-xs">{secret.value}</div>
                  <button
                    onClick={() => void navigator.clipboard.writeText(secret.value)}
                    className="mt-2 font-mono text-[11px] text-signal underline"
                  >
                    copy to clipboard
                  </button>
                </div>
              )}
            </section>

            {/* ---- Key list ---- */}
            <section className="mt-8 rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">Your keys</h2>
              <div className="mt-4 space-y-2">
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
                    <span className="ml-auto flex items-center gap-3">
                      {k.revoked_at ? (
                        <span className="text-destructive">revoked</span>
                      ) : (
                        <>
                          <button
                            onClick={() => void handleRotate(k.id)}
                            disabled={busy}
                            className="text-muted-foreground underline hover:text-signal disabled:opacity-50"
                          >
                            rotate
                          </button>
                          <button
                            onClick={() => void handleRevoke(k.id)}
                            className="text-muted-foreground underline hover:text-destructive"
                          >
                            revoke
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-[11px] text-muted-foreground">
                Rotating revokes the old secret immediately and issues a replacement
                under the same name.
              </p>
            </section>

            {/* ---- Activity log ---- */}
            <section className="mt-8 rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">Key activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Runs, errors and last use per key over the last {data.activity.days} days.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse font-mono text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="border-b border-border py-2 pr-3 font-normal">key</th>
                      <th className="border-b border-border py-2 pr-3 font-normal">runs</th>
                      <th className="border-b border-border py-2 pr-3 font-normal">errors</th>
                      <th className="border-b border-border py-2 pr-3 font-normal">avg ms</th>
                      <th className="border-b border-border py-2 font-normal">last used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activity.perKey.map((k) => (
                      <tr key={k.id}>
                        <td className="border-b border-border py-2 pr-3">
                          <span className={k.revokedAt ? "text-muted-foreground line-through" : ""}>
                            {k.name}
                          </span>{" "}
                          <span className="text-muted-foreground">{k.keyPrefix}…</span>
                        </td>
                        <td className="border-b border-border py-2 pr-3">{k.runs}</td>
                        <td
                          className={`border-b border-border py-2 pr-3 ${k.errors ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {k.errors}
                        </td>
                        <td className="border-b border-border py-2 pr-3 text-muted-foreground">
                          {k.avgMs || "—"}
                        </td>
                        <td className="border-b border-border py-2 text-muted-foreground">
                          {k.lastUsedAt ? k.lastUsedAt.slice(0, 19).replace("T", " ") : "never"}
                        </td>
                      </tr>
                    ))}
                    {data.activity.perKey.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No keys yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data.activity.unattributedRuns > 0 && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  {data.activity.unattributedRuns} run
                  {data.activity.unattributedRuns === 1 ? "" : "s"} came from the web app
                  session rather than an API key.
                </p>
              )}

              <h3 className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                recent events
              </h3>
              <div className="mt-2 space-y-1.5">
                {data.activity.events.length === 0 && (
                  <p className="rounded-md border border-dashed border-border p-6 text-center font-mono text-xs text-muted-foreground">
                    No runs recorded yet.
                  </p>
                )}
                {data.activity.events.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 font-mono text-[11px]"
                  >
                    <span className="text-muted-foreground">
                      {e.createdAt.slice(0, 19).replace("T", " ")}
                    </span>
                    <span className={e.status === "ok" ? "text-signal" : "text-destructive"}>
                      {e.status}
                    </span>
                    <span>
                      {e.skillSlug}
                      {e.toolCall ? `/${e.toolCall}` : ""}
                    </span>
                    <span className="text-muted-foreground">{e.keyName}</span>
                    <span className="ml-auto text-muted-foreground">{e.durationMs} ms</span>
                    {e.error && (
                      <span className="w-full truncate text-destructive">{e.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
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
