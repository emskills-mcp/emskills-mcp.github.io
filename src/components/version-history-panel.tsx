import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listSkillVersionsFn,
  listVersionedSkillsFn,
  rollbackSkillFn,
} from "@/lib/registry.functions";
import { collapseContext, diffLines } from "@/lib/diff";

type SkillEntry = {
  slug: string;
  name: string;
  version: string;
  entries: number;
  lastChange: string;
};

type Version = {
  id: string;
  skill_slug: string;
  version: string;
  snapshot: Record<string, string | number | boolean | null | string[]>;
  skill_md: string | null;
  origin: string;
  change_summary: string | null;
  changed_fields: string[] | null;
  created_at: string;
};

const originTint: Record<string, string> = {
  approval: "bg-signal/15 text-signal",
  sync: "bg-primary/15 text-primary",
  rollback: "bg-secondary/20 text-secondary-foreground",
};

/** Admin view of every published skill's snapshot timeline, with rollback. */
export function VersionHistoryPanel() {
  const listSkills = useServerFn(listVersionedSkillsFn);
  const listVersions = useServerFn(listSkillVersionsFn);
  const rollback = useServerFn(rollbackSkillFn);

  const [skills, setSkills] = useState<SkillEntry[] | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      setSkills((await listSkills()) as SkillEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [listSkills]);

  const loadVersions = useCallback(
    async (target: string) => {
      try {
        setVersions((await listVersions({ data: { slug: target } })) as Version[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [listVersions],
  );

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    if (slug) void loadVersions(slug);
  }, [slug, loadVersions]);

  const selected = useMemo(
    () => versions?.find((v) => v.id === compare) ?? null,
    [versions, compare],
  );
  const current = versions?.[0] ?? null;

  const mdRows = useMemo(() => {
    if (!selected || !current || selected.id === current.id) return [];
    return collapseContext(diffLines(selected.skill_md ?? "", current.skill_md ?? ""), 2);
  }, [selected, current]);

  async function handleRollback(v: Version) {
    if (
      !window.confirm(
        `Restore "${v.skill_slug}" to the snapshot from ${new Date(v.created_at).toLocaleString()} (v${v.version})? The current state is kept in history.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await rollback({ data: { versionId: v.id } });
      setNotice(`Rolled back ${v.skill_slug} to v${v.version}.`);
      await loadVersions(v.skill_slug);
      await loadSkills();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-14 rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">Version history</h2>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        Every approval, repository sync, and rollback writes an immutable snapshot
        of the published skill. Pick a skill to see what changed between
        snapshots, and restore any earlier state — the current state is preserved
        in history first, so a rollback is never destructive.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-md border border-signal/40 bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
          {notice}
        </p>
      )}

      {skills !== null && skills.length === 0 && (
        <p className="mt-5 rounded-lg border border-dashed border-border p-6 text-center font-mono text-sm text-muted-foreground">
          No snapshots yet — history starts with the next approved submission.
        </p>
      )}

      {skills && skills.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {skills.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => {
                setSlug(s.slug === slug ? null : s.slug);
                setVersions(null);
                setCompare(null);
              }}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs ${
                slug === s.slug
                  ? "border-signal/50 bg-signal/10 text-signal"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {s.slug}
              <span className="ml-2 text-[10px] text-muted-foreground">
                {s.entries} snapshot{s.entries === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      )}

      {slug && versions === null && (
        <p className="mt-5 font-mono text-xs text-muted-foreground">loading history…</p>
      )}

      {versions && (
        <div className="mt-6 space-y-3">
          {versions.map((v, idx) => (
            <div
              key={v.id}
              className={`rounded-md border px-4 py-3 ${idx === 0 ? "border-signal/40 bg-signal/5" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()}
                </span>
                <span className="font-mono text-xs">v{v.version}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${originTint[v.origin] ?? "bg-panel text-muted-foreground"}`}
                >
                  {v.origin}
                </span>
                {idx === 0 && (
                  <span className="rounded border border-signal/40 px-1.5 py-0.5 font-mono text-[10px] text-signal">
                    live
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {v.change_summary ?? "—"}
              </p>
              {v.changed_fields && v.changed_fields.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.changed_fields.map((f) => (
                    <span
                      key={f}
                      className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {idx !== 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCompare(compare === v.id ? null : v.id)}
                      className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] hover:border-primary"
                    >
                      {compare === v.id ? "Hide diff vs live" : "Diff vs live"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRollback(v)}
                      className="rounded-md border border-secondary/50 bg-panel px-3 py-1.5 font-mono text-[11px] text-secondary-foreground disabled:opacity-60"
                    >
                      Roll back to this
                    </button>
                  </>
                )}
              </div>

              {compare === v.id && (
                <div className="mt-4 space-y-3">
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[640px] border-collapse font-mono text-[11px]">
                      <thead>
                        <tr className="border-b border-border bg-panel text-left uppercase tracking-[0.15em] text-muted-foreground">
                          <th className="px-3 py-2 font-normal">field</th>
                          <th className="px-3 py-2 font-normal">this snapshot</th>
                          <th className="px-3 py-2 font-normal">live</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(v.snapshot)
                          .filter((f) => f !== "skill_md")
                          .map((f) => {
                            const older = v.snapshot[f];
                            const live = current?.snapshot[f];
                            const fmt = (x: unknown) =>
                              x == null
                                ? "—"
                                : Array.isArray(x)
                                  ? x.join(", ")
                                  : String(x);
                            const changed = fmt(older) !== fmt(live);
                            if (!changed) return null;
                            return (
                              <tr key={f} className="border-b border-border last:border-0">
                                <td className="px-3 py-2 text-muted-foreground">{f}</td>
                                <td className="px-3 py-2 align-top text-secondary-foreground">
                                  {fmt(older)}
                                </td>
                                <td className="px-3 py-2 align-top text-signal">{fmt(live)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {mdRows.length > 0 && (
                    <div className="overflow-hidden rounded-md border border-border">
                      <div className="grid grid-cols-2 border-b border-border bg-panel font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        <div className="px-3 py-2">snapshot SKILL.md</div>
                        <div className="border-l border-border px-3 py-2">live SKILL.md</div>
                      </div>
                      <div className="max-h-[400px] overflow-auto">
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
                                <pre className="whitespace-pre-wrap break-words">
                                  {r.left ?? ""}
                                </pre>
                              </div>
                              <div className="border-l border-border px-3 py-1">
                                <pre className="whitespace-pre-wrap break-words">
                                  {r.right ?? ""}
                                </pre>
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
          ))}
        </div>
      )}
    </section>
  );
}
