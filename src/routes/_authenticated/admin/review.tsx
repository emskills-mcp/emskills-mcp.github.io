import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPendingSubmissions,
  reviewSubmission,
  checkAdmin,
  bootstrapFirstAdmin,
  getReviewAudit,
} from "@/lib/skills.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { SubmissionRow, ReviewAuditRow } from "@/lib/db.server";
import { RegistrySyncPanel } from "@/components/registry-sync-panel";
import { SubmissionDiff } from "@/components/submission-diff";
import { VersionHistoryPanel } from "@/components/version-history-panel";
import { AiTriagePanel } from "@/components/ai-triage";
import { triageSubmissions, scoreSkillQuality } from "@/lib/jev.functions";
import {
  getPendingPublisherVerifications,
  reviewPublisherVerification,
} from "@/lib/billing.functions";
import { VerifiedBadge } from "@/components/verified-badge";
import type { VerificationRow } from "@/lib/billing.server";


const title = "Review queue — emskills";
const description = "Moderated queue of skill submissions awaiting approval.";

export const Route = createFileRoute("/_authenticated/admin/review")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminReview,
});

function AdminReview() {
  const fetchPending = useServerFn(getPendingSubmissions);
  const doReview = useServerFn(reviewSubmission);
  const fetchAdmin = useServerFn(checkAdmin);
  const fetchAudit = useServerFn(getReviewAudit);
  const fetchVerifications = useServerFn(getPendingPublisherVerifications);
  const reviewVerification = useServerFn(reviewPublisherVerification);
  const [audit, setAudit] = useState<ReviewAuditRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [subs, setSubs] = useState<SubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const doTriage = useServerFn(triageSubmissions);
  const doQuality = useServerFn(scoreSkillQuality);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, log, publisherQueue] = await Promise.all([
        fetchPending(),
        fetchAudit(),
        fetchVerifications(),
      ]);
      setSubs(data as SubmissionRow[]);
      setAudit(log as ReviewAuditRow[]);
      setVerifications(publisherQueue as VerificationRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPending, fetchAudit, fetchVerifications]);

  useEffect(() => {
    fetchAdmin()
      .then((r) => setAdmin(r.isAdmin))
      .catch(() => setAdmin(false));
  }, [fetchAdmin]);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  async function handleReview(id: string, action: "approve" | "reject") {
    const notes = window.prompt(
      action === "approve"
        ? "Optional approval notes (calibration record, fixture run, …)"
        : "Reason for rejection",
    );
    setBusyId(id);
    try {
      await doReview({ data: { id, action, notes: notes ?? undefined } });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function runTriage(ids: string[], busyKey: string) {
    if (!ids.length) return;
    setAiBusy(busyKey);
    setAiMsg(null);
    try {
      const res = await doTriage({ data: { ids } });
      const failed = res.filter((r) => !r.ok);
      setAiMsg(failed.length ? `Triage failed: ${failed[0]!.error}` : `Triaged ${res.length} submission(s).`);
      await load();
    } catch (e: unknown) {
      setAiMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(null);
    }
  }

  async function runQuality() {
    setAiBusy("quality");
    setAiMsg(null);
    try {
      const r = await doQuality({ data: {} });
      setAiMsg(`Scored ${r.scored}/${r.total} skills.${r.errors.length ? ` ${r.errors[0]}` : ""}`);
    } catch (e: unknown) {
      setAiMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(null);
    }
  }

  async function handleVerification(
    id: string,
    action: "approve" | "reject",
    badge?: "verified" | "certified",
  ) {
    const notes = window.prompt(action === "approve" ? "Optional certification notes" : "Reason for rejection");
    setBusyId(id);
    try {
      await reviewVerification({
        data: {
          id,
          action,
          ...(badge ? { badge } : {}),
          ...(notes ? { notes } : {}),
        },
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (admin === null) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[1200px] px-5 py-24 font-mono text-sm text-muted-foreground">
          checking permissions…
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (admin === false) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[1200px] px-5 py-24">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 font-mono text-sm text-destructive">
            403 — admin access required. The first signed-in user can self-promote
            via the button on this page when no admin exists yet.
          </div>
          <FirstAdminButton />
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">
          registry / admin / review
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Review queue
        </h1>
        <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
          Submissions enter this queue for a maintainer to validate the manifest,
          run the fixture invocation, and confirm the safety note before
          publishing.
        </p>
        <Link
          to="/admin/email-previews"
          className="mt-4 inline-block rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:border-primary/60"
        >
          Preview notification emails →
        </Link>

        {error && (
          <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        <RegistrySyncPanel onSynced={() => void load()} />

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold tracking-tight">Publisher certification</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Confirm publisher identity, then assign the badge shown across that publisher&apos;s skills.
          </p>
          {verifications.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-center font-mono text-sm text-muted-foreground">
              No certification requests awaiting review.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {verifications.map((verification) => (
                <article key={verification.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-semibold">{verification.org}</h3>
                    <VerifiedBadge level="community" />
                  </div>
                  <dl className="mt-4 grid gap-x-8 gap-y-2 font-mono text-[11px] sm:grid-cols-2">
                    <Meta k="contact" v={verification.contact_email} />
                    <Meta k="requested" v={verification.created_at.slice(0, 10)} />
                    {verification.evidence_url && <Meta k="evidence" v={verification.evidence_url} />}
                    {verification.notes && <Meta k="notes" v={verification.notes} />}
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busyId === verification.id}
                      onClick={() => void handleVerification(verification.id, "approve", "verified")}
                      className="rounded-md border border-signal/50 bg-signal/10 px-3.5 py-2 font-mono text-xs text-signal disabled:opacity-60"
                    >
                      Approve verified
                    </button>
                    <button
                      type="button"
                      disabled={busyId === verification.id}
                      onClick={() => void handleVerification(verification.id, "approve", "certified")}
                      className="rounded-md border border-brass/50 bg-brass/10 px-3.5 py-2 font-mono text-xs text-brass disabled:opacity-60"
                    >
                      Approve certified vendor
                    </button>
                    <button
                      type="button"
                      disabled={busyId === verification.id}
                      onClick={() => void handleVerification(verification.id, "reject")}
                      className="rounded-md border border-destructive/40 px-3.5 py-2 font-mono text-xs text-destructive disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            AI judgments
          </span>
          <button
            type="button"
            disabled={!!aiBusy || !subs?.length}
            onClick={() => void runTriage((subs ?? []).slice(0, 25).map((s) => s.id), "all")}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:text-signal disabled:opacity-60"
          >
            {aiBusy === "all" ? "triaging…" : "Triage all pending"}
          </button>
          <button
            type="button"
            disabled={!!aiBusy}
            onClick={() => void runQuality()}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:text-signal disabled:opacity-60"
          >
            {aiBusy === "quality" ? "scoring…" : "Score quality of all published skills"}
          </button>
          {aiMsg && <span className="font-mono text-xs text-muted-foreground">{aiMsg}</span>}
        </div>




        <div className="mt-8 space-y-4">
          {subs !== null && subs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
              Queue empty — no pending submissions.
            </div>
          )}
          {subs &&
            subs.map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{s.name}</span>
                  <span className="rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[10px] text-signal">
                    {s.technique}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {s.kind}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.summary}</p>
                <p className="mt-2 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 border-t border-border pt-3 font-mono text-[11px] sm:grid-cols-3">
                  <Meta k="slug" v={s.slug} />
                  <Meta k="repo" v={s.repo} />
                  <Meta k="version" v={s.version} />
                  <Meta k="license" v={s.license} />
                  <Meta k="runtime" v={s.runtime} />
                  <Meta k="tool_call" v={s.tool_call} />
                  <Meta k="category" v={s.category} />
                  <Meta k="submitted" v={s.created_at.slice(0, 10)} />
                  {s.source_repo && <Meta k="source" v={s.source_repo} />}
                  {s.source_path && <Meta k="path" v={s.source_path} />}
                </dl>

                <AiTriagePanel
                  triage={s.ai_triage}
                  claimedTechnique={s.technique}
                  busy={aiBusy === s.id || aiBusy === "all"}
                  onRun={() => void runTriage([s.id], s.id)}
                />
                <SubmissionDiff submissionId={s.id} />
                <div className="mt-5 flex gap-3">
                  <button
                    disabled={busyId === s.id}
                    onClick={() => handleReview(s.id, "approve")}
                    className="rounded-md bg-signal px-3.5 py-2 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
                  >
                    Approve & publish
                  </button>
                  <button
                    disabled={busyId === s.id}
                    onClick={() => handleReview(s.id, "reject")}
                    className="rounded-md border border-destructive/40 bg-panel px-3.5 py-2 font-mono text-xs text-destructive hover:-translate-y-px disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>

        <VersionHistoryPanel />

        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Audit trail
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Every moderation decision is recorded server-side with the reviewer,
            the outcome, the notes, and the timestamp. Records are immutable from
            the app.
          </p>

          {audit.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
              No decisions recorded yet.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-border bg-panel text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <th className="px-4 py-2.5 font-normal">when (UTC)</th>
                    <th className="px-4 py-2.5 font-normal">action</th>
                    <th className="px-4 py-2.5 font-normal">skill</th>
                    <th className="px-4 py-2.5 font-normal">reviewer</th>
                    <th className="px-4 py-2.5 font-normal">notes</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {a.created_at.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 ${a.action === "approve" ? "bg-signal/15 text-signal" : "bg-destructive/15 text-destructive"}`}
                        >
                          {a.action === "approve" ? "approved" : "rejected"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-foreground">{a.submission_name}</span>{" "}
                        <span className="text-muted-foreground">/ {a.submission_slug}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.reviewer_email ?? a.reviewer_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}

function FirstAdminButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promote = useServerFn(bootstrapFirstAdmin);
  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      await promote({ data: undefined });
      window.location.reload();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 rounded-lg border border-border bg-panel p-5">
      <div className="font-mono text-xs text-muted-foreground">
        // first-run setup
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        No admin has been set yet. Promote this account to admin to access the
        review queue. (Disabled once an admin exists.)
      </p>
      <button
        onClick={go}
        disabled={busy}
        className="mt-4 rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
      >
        {busy ? "…" : "Promote me to admin"}
      </button>
      {msg && <p className="mt-3 font-mono text-xs text-destructive">{msg}</p>}
    </div>
  );
}
