import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getEmailPreviews, type EmailPreview } from "@/lib/email-preview.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const title = "Email previews — emskills";
const description =
  "Preview the submission review request and decision emails before they are sent.";

export const Route = createFileRoute("/_authenticated/admin/email-previews")({
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
  component: EmailPreviews,
});

function EmailPreviews() {
  const fetchPreviews = useServerFn(getEmailPreviews);
  const [items, setItems] = useState<EmailPreview[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreviews()
      .then((rows) => {
        setItems(rows);
        setActive(rows[0]?.name ?? null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load previews"),
      );
  }, [fetchPreviews]);

  const current = items?.find((i) => i.name === active) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">
          admin / email previews
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Email previews
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Rendered with sample data, exactly as contributors and admins receive
          them. Lovable appends the unsubscribe footer at send time.{" "}
          <Link to="/admin/review" className="underline underline-offset-4">
            Back to the review queue
          </Link>
          .
        </p>

        {error ? (
          <p className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : !items ? (
          <p className="mt-8 font-mono text-xs text-muted-foreground">
            loading templates…
          </p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No email templates registered.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[260px_1fr]">
            <nav className="space-y-2">
              {items.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setActive(t.name)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    t.name === active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-medium">{t.displayName}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {t.name}
                  </div>
                </button>
              ))}
            </nav>

            {current ? (
              <section className="rounded-lg border border-border bg-card">
                <header className="border-b border-border p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    subject
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {current.subject}
                  </div>
                </header>
                {current.error ? (
                  <p className="p-4 text-sm text-destructive">
                    Render failed: {current.error}
                  </p>
                ) : (
                  <iframe
                    title={`${current.displayName} preview`}
                    srcDoc={current.html}
                    sandbox=""
                    className="h-[720px] w-full rounded-b-lg bg-white"
                  />
                )}
              </section>
            ) : null}
          </div>
        )}

        {current && !current.error ? (
          <details className="mt-6 rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Sample data used
            </summary>
            <pre className="mt-3 overflow-x-auto font-mono text-xs text-muted-foreground">
              {current.previewDataJson}
            </pre>
          </details>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
