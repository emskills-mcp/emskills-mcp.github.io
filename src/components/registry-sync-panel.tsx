import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getRegistrySourceFn,
  getWebhookStatusFn,
  setRegistrySourceFn,
  syncRegistryRepoFn,
} from "@/lib/registry.functions";
import { REGISTRY_PATH_PREFIX, REGISTRY_REPO } from "@/lib/skill-template";

type Source = {
  repo: string;
  branch: string;
  path_prefix: string;
  last_synced_at: string | null;
  last_sync_summary: string | null;
  auto_sync_enabled?: boolean | null;
  sync_interval_minutes?: number | null;
  last_webhook_at?: string | null;
};

type Delivery = {
  id: string;
  delivery_id: string | null;
  event: string | null;
  repo: string | null;
  ref: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

type WebhookStatus = {
  secretConfigured: boolean;
  tokenConfigured: boolean;
  cronSecretConfigured: boolean;
  deliveries: Delivery[];
  lastWebhookAt: string | null;
};

type Item = { slug: string; path: string; status: string; message?: string };

const statusColor: Record<string, string> = {
  queued: "text-primary",
  synced: "text-signal",
  verified: "text-signal",
  ignored: "text-muted-foreground",
  unauthorized: "text-destructive",
  misconfigured: "text-destructive",
  synced_with_errors: "text-secondary-foreground",
  updated: "text-primary",
  published: "text-secondary-foreground",
  unchanged: "text-muted-foreground",
  error: "text-destructive",
};

export function RegistrySyncPanel({ onSynced }: { onSynced?: () => void }) {
  const getSource = useServerFn(getRegistrySourceFn);
  const saveSource = useServerFn(setRegistrySourceFn);
  const runSync = useServerFn(syncRegistryRepoFn);
  const getWebhooks = useServerFn(getWebhookStatusFn);

  const [source, setSource] = useState<Source | null>(null);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [prefix, setPrefix] = useState(REGISTRY_PATH_PREFIX);
  const [autoSync, setAutoSync] = useState(false);
  const [interval, setInterval] = useState(360);
  const [hooks, setHooks] = useState<WebhookStatus | null>(null);
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    try {
      const s = (await getSource()) as Source | null;
      setSource(s);
      if (s) {
        setRepo(s.repo);
        setBranch(s.branch);
        setPrefix(s.path_prefix);
        setAutoSync(Boolean(s.auto_sync_enabled));
        setInterval(s.sync_interval_minutes ?? 360);
      }
      setHooks((await getWebhooks()) as WebhookStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [getSource, getWebhooks]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setBusy("save");
    setError(null);
    try {
      const s = (await saveSource({
        data: {
          repo,
          branch: branch || undefined,
          pathPrefix: prefix || undefined,
          autoSyncEnabled: autoSync,
          syncIntervalMinutes: interval,
        },
      })) as Source;
      setSource(s);
      setBranch(s.branch);
      setPrefix(s.path_prefix);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSync() {
    setBusy("sync");
    setError(null);
    setItems(null);
    try {
      const res = (await runSync()) as { items: Item[] };
      setItems(res.items);
      await load();
      onSynced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Registry repository
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {source?.last_synced_at
            ? `last sync ${new Date(source.last_synced_at).toLocaleString()} — ${source.last_sync_summary ?? ""}`
            : "never synced"}
        </span>
      </div>
      <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        Point emskills at a GitHub repository containing one folder per skill with
        a <code className="font-mono text-xs">SKILL.md</code> (plus optional{" "}
        <code className="font-mono text-xs">skill.json</code>). Syncing imports
        each manifest into the queue below — nothing is published until you
        approve it.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">repository</span>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder={REGISTRY_REPO}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">branch</span>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">folder prefix</span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="skills"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="font-mono text-xs">
            scheduled resync
            <span className="ml-2 text-muted-foreground">
              keeps the queue fresh without manual clicks
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
          <span className="font-mono text-xs text-muted-foreground">every</span>
          <select
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            disabled={!autoSync}
            className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-primary disabled:opacity-50"
          >
            {[
              [60, "1 hour"],
              [180, "3 hours"],
              [360, "6 hours"],
              [720, "12 hours"],
              [1440, "24 hours"],
            ].map(([v, label]) => (
              <option key={v} value={v as number}>
                {label as string}
              </option>
            ))}
          </select>
          <span className="font-mono text-xs text-muted-foreground">
            (save to apply)
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null || repo.trim().length < 3}
          className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:border-primary disabled:opacity-50"
        >
          {busy === "save" ? "checking repo…" : source ? "Update source" : "Save source"}
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={busy !== null || !source}
          className="rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy === "sync" ? "syncing…" : "Sync from repository"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      )}

      {items && (
        <div className="mt-5 overflow-hidden rounded-md border border-border">
          {items.length === 0 && (
            <p className="px-3 py-3 font-mono text-xs text-muted-foreground">
              No SKILL.md folders found under “{source?.path_prefix}/”.
            </p>
          )}
          {items.map((i) => (
            <div
              key={i.path}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-3 py-2 last:border-b-0"
            >
              <span className="font-mono text-xs">{i.slug}</span>
              <span
                className={`font-mono text-xs uppercase ${statusColor[i.status] ?? "text-muted-foreground"}`}
              >
                {i.status}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{i.path}</span>
              {i.message && (
                <span className="w-full font-mono text-xs text-muted-foreground">
                  {i.message}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Webhook + schedule diagnostics */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-display text-sm font-semibold tracking-tight">
            Webhook &amp; automation status
          </h3>
          <button
            type="button"
            onClick={() => void load()}
            className="font-mono text-[11px] text-primary hover:underline"
          >
            refresh
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["GITHUB_WEBHOOK_SECRET", hooks?.secretConfigured, "required to accept push events"],
            ["GITHUB_TOKEN", hooks?.tokenConfigured, "optional — raises API rate limits"],
            ["cron secret", hooks?.cronSecretConfigured, "required for scheduled resyncs"],
          ].map(([label, ok, hint]) => (
            <div key={label as string} className="rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className={ok ? "text-signal" : "text-destructive"}>{ok ? "●" : "○"}</span>
                <span>{label as string}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {ok ? "configured" : `missing — ${hint as string}`}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-border bg-panel px-3 py-3 font-mono text-[11px] text-muted-foreground">
          <p>
            POST endpoint:{" "}
            <span className="text-foreground">/api/public/webhooks/github</span> — add
            it in the repo under Settings → Webhooks, content type{" "}
            <span className="text-foreground">application/json</span>, secret ={" "}
            <span className="text-foreground">GITHUB_WEBHOOK_SECRET</span>, event ={" "}
            <span className="text-foreground">push</span>.
          </p>
          <p className="mt-1">
            last delivery:{" "}
            <span className="text-foreground">
              {hooks?.lastWebhookAt
                ? new Date(hooks.lastWebhookAt).toLocaleString()
                : "none received yet"}
            </span>
          </p>
        </div>

        {hooks && hooks.deliveries.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            {hooks.deliveries.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-3 py-2 last:border-b-0"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                </span>
                <span className="font-mono text-[11px]">{d.event ?? "—"}</span>
                <span
                  className={`font-mono text-[11px] uppercase ${statusColor[d.status] ?? "text-muted-foreground"}`}
                >
                  {d.status.replace(/_/g, " ")}
                </span>
                {d.ref && (
                  <span className="font-mono text-[11px] text-muted-foreground">{d.ref}</span>
                )}
                {d.message && (
                  <span className="w-full font-mono text-[11px] text-muted-foreground">
                    {d.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {hooks && hooks.deliveries.length === 0 && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            No deliveries logged yet. Use GitHub&rsquo;s &ldquo;Redeliver&rdquo; or push a
            commit to verify the secret.
          </p>
        )}
      </div>
    </section>
  );
}
