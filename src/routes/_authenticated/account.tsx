import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMySubmissions } from "@/lib/skills.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { SubmissionRow } from "@/lib/db.server";

const title = "Your account — emskills";
const description = "View your skill submissions and their review status.";

export const Route = createFileRoute("/_authenticated/account")({
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
  component: Account,
});

function Account() {
  const navigate = useNavigate();
  const fetchMy = useServerFn(getMySubmissions);
  const [subs, setSubs] = useState<SubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMy()
      .then((data) => setSubs(data as SubmissionRow[]))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, [fetchMy]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">registry / account</div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Your submissions
        </h1>
        <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
          Track the review status of skills you’ve submitted. Once a maintainer
          approves a submission, it is published to the public registry.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            to="/contribute"
            className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px"
          >
            Submit a new skill
          </Link>
          <button
            onClick={signOut}
            className="rounded-md border border-border bg-panel px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <div className="mt-10">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </p>
          )}
          {subs !== null && subs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
              No submissions yet.
            </div>
          )}
          {subs && subs.length > 0 && (
            <div className="space-y-3">
              {subs.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold">{s.name}</span>
                    <span className="rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[10px] text-signal">
                      {s.technique}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                    <span className="text-foreground">{s.repo}</span>
                    <span>submitted {s.created_at.slice(0, 10)}</span>
                    {s.reviewer_notes && (
                      <span>reviewer: {s.reviewer_notes}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-border text-muted-foreground",
    approved: "border-signal/40 bg-signal/10 text-signal",
    rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${map[status] ?? map["pending"]}`}
    >
      {status}
    </span>
  );
}
