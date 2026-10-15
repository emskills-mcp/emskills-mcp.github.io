import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSubmissionDiffFn } from "@/lib/registry.functions";
import { collapseContext, diffLines, diffStats } from "@/lib/diff";
import type { DiffRow } from "@/lib/diff";

type Diff = {
  slug: string;
  isNew: boolean;
  fields: { field: string; before: string | null; after: string | null; changed: boolean }[];
  beforeMd: string;
  afterMd: string;
};

const rowTint: Record<DiffRow["type"], string> = {
  same: "",
  added: "bg-signal/10",
  removed: "bg-destructive/10",
  changed: "bg-primary/10",
};

export function SubmissionDiff({ submissionId }: { submissionId: string }) {
  const fetchDiff = useServerFn(getSubmissionDiffFn);
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!open || diff) return;
    let cancelled = false;
    void (async () => {
      try {
        const d = (await fetchDiff({ data: { id: submissionId } })) as Diff;
        if (!cancelled) setDiff(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, diff, fetchDiff, submissionId]);

  const rows = useMemo(
    () => (diff ? diffLines(diff.beforeMd, diff.afterMd) : []),
    [diff],
  );
  const stats = useMemo(() => diffStats(rows), [rows]);
  const view = useMemo(
    () => (showAll ? rows : collapseContext(rows, 3)),
    [rows, showAll],
  );

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-xs text-primary hover:underline"
      >
        {open ? "▾ Hide changes" : "▸ Compare with published version"}
      </button>

      {open && error && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      )}

      {open && !diff && !error && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">loading diff…</p>
      )}

      {open && diff && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span
              className={
                diff.isNew
                  ? "rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 text-signal"
                  : "rounded border border-border px-1.5 py-0.5 text-muted-foreground"
              }
            >
              {diff.isNew ? "new skill — nothing published yet" : "update to a published skill"}
            </span>
            {!diff.isNew && (
              <span className="text-muted-foreground">
                +{stats.added} / -{stats.removed} / ~{stats.changed} manifest lines
              </span>
            )}
          </div>

          {/* Field-level table */}
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[720px] border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b border-border bg-panel text-left uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="px-3 py-2 font-normal">field</th>
                  <th className="px-3 py-2 font-normal">published</th>
                  <th className="px-3 py-2 font-normal">incoming</th>
                </tr>
              </thead>
              <tbody>
                {diff.fields
                  .filter((f) => showAll || f.changed || diff.isNew)
                  .map((f) => (
                    <tr
                      key={f.field}
                      className={`border-b border-border last:border-0 ${f.changed ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{f.field}</td>
                      <td className="px-3 py-2 align-top text-destructive/90">
                        {f.before ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-signal">
                        {f.after ?? <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                {!diff.isNew && diff.fields.every((f) => !f.changed) && !showAll && (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                      No metadata fields changed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* SKILL.md side by side */}
          {(diff.beforeMd || diff.afterMd) && (
            <div className="mt-4 overflow-x-auto rounded-md border border-border">
              <div className="grid grid-cols-2 border-b border-border bg-panel font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <div className="px-3 py-2">published SKILL.md</div>
                <div className="border-l border-border px-3 py-2">incoming SKILL.md</div>
              </div>
              <div className="max-h-[520px] overflow-auto">
                {view.map((r, idx) =>
                  "count" in r ? (
                    <div
                      key={`gap-${idx}`}
                      className="border-b border-border bg-panel/60 px-3 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      ⋯ {r.count} unchanged line{r.count === 1 ? "" : "s"}
                    </div>
                  ) : (
                    <div
                      key={`row-${idx}`}
                      className={`grid grid-cols-2 border-b border-border/60 font-mono text-[11px] ${rowTint[r.type]}`}
                    >
                      <div className="flex gap-2 px-3 py-1">
                        <span className="w-8 shrink-0 text-right text-muted-foreground">
                          {r.leftNo ?? ""}
                        </span>
                        <pre className="whitespace-pre-wrap break-words">{r.left ?? ""}</pre>
                      </div>
                      <div className="flex gap-2 border-l border-border px-3 py-1">
                        <span className="w-8 shrink-0 text-right text-muted-foreground">
                          {r.rightNo ?? ""}
                        </span>
                        <pre className="whitespace-pre-wrap break-words">{r.right ?? ""}</pre>
                      </div>
                    </div>
                  ),
                )}
                {view.length === 0 && (
                  <p className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                    Identical manifests.
                  </p>
                )}
              </div>
            </div>
          )}

          {!diff.beforeMd && !diff.isNew && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              The published version predates manifest storage, so only field
              changes can be compared.
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 font-mono text-[11px] text-primary hover:underline"
          >
            {showAll ? "Show changes only" : "Show full manifests and all fields"}
          </button>
        </div>
      )}
    </div>
  );
}
