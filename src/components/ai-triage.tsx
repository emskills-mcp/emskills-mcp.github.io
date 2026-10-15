import type { Triage } from "@/lib/jev.server";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const cls = {
    ok: "border-signal/40 bg-signal/10 text-signal",
    warn: "border-brass/40 bg-brass/10 text-brass",
    bad: "border-destructive/40 bg-destructive/10 text-destructive",
    muted: "border-border text-muted-foreground",
  }[tone];
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>{children}</span>;
}

const yes = (p: number, good = true) => {
  const v = good ? p : 1 - p;
  return v >= 0.7 ? "ok" : v >= 0.4 ? "warn" : "bad";
};

export function AiTriagePanel({
  triage,
  claimedTechnique,
  onRun,
  busy,
}: {
  triage: Triage | null | undefined;
  claimedTechnique: string;
  onRun: () => void;
  busy: boolean;
}) {
  return (
    <div className="mt-4 rounded-md border border-border bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          AI triage {triage?.needsAttention ? "· needs a closer look" : triage ? "· looks routine" : ""}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="rounded-md border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-signal disabled:opacity-60"
        >
          {busy ? "judging…" : triage ? "Re-run" : "Run triage"}
        </button>
      </div>
      {!triage ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">Not triaged yet.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone={triage.technique.choice === claimedTechnique ? "ok" : "warn"}>
              technique: {triage.technique.choice} ({pct(triage.technique.confidence)})
            </Pill>
            <Pill tone="muted">kind: {triage.kind.choice}</Pill>
            <Pill tone={yes(triage.summaryMatches)}>summary matches: {pct(triage.summaryMatches)}</Pill>
            <Pill tone={yes(triage.undisclosedData, false)}>undisclosed data flow: {pct(triage.undisclosedData)}</Pill>
            <Pill tone={yes(triage.instrumentRisk ?? 0, false)}>instrument risk: {pct(triage.instrumentRisk)}</Pill>
          </div>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Certified Vendor pre-check
          </div>
          <ul className="mt-2 grid gap-1 font-mono text-[11px] sm:grid-cols-2">
            {[
              ["1 First-party ownership", triage.certification.ownership],
              ["2 Declares MCP endpoint", triage.certification.endpoint],
              ["3 Hardware claims backed", triage.certification.hardwareClaims ?? 0],
              ["4 Named maintainer", triage.certification.maintainer],
              ["5 Open licence", triage.certification.openLicence],
            ].map(([label, v]) => (
              <li key={label as string} className="flex items-center justify-between gap-3 rounded border border-border px-2 py-1">
                <span className="text-foreground">{label}</span>
                <Pill tone={yes(v as number)}>{pct(v as number)}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            Probabilities from an AI judgment — a guide for review, not a decision.
          </p>
        </>
      )}
    </div>
  );
}

export function QualityBars({ q }: { q: { docs: number; examples: number; safety: number; overall: number } }) {
  const rows: [string, number][] = [
    ["documentation", q.docs],
    ["examples", q.examples],
    ["instrument safety", q.safety],
  ];
  return (
    <div className="space-y-2 font-mono text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-muted-foreground">
            <span>{k}</span>
            <span className="text-foreground">{Math.round(v * 100)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-border">
            <div className="h-1.5 rounded bg-signal" style={{ width: `${Math.round(v * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
