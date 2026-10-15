import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { submitVendorSkillMd, type VendorSubmitResult } from "@/lib/vendor-submit.functions";
import { SKILL_MD_TEMPLATE } from "@/lib/skill-template";

const title = "Vendor skill submission — emskills";
const description =
  "Vendors upload or paste a SKILL.md and it goes straight into the emskills review queue.";

export const Route = createFileRoute("/_authenticated/vendor-submit")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VendorSubmit,
});

function VendorSubmit() {
  const submit = useServerFn(submitVendorSkillMd);
  const [markdown, setMarkdown] = useState("");
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VendorSubmitResult | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setMarkdown(await f.text());
    setResult(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await submit({ data: { markdown, org } });
      setResult(r);
      if (r.ok) setMarkdown("");
    } catch (err) {
      setResult({ ok: false, problems: [err instanceof Error ? err.message : String(err)] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">registry / vendor submission</div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Submit your skill as a vendor
        </h1>
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Upload or paste your SKILL.md. We check it against the registry template and it lands in
          the review queue immediately — no GitHub repository required. You can track its status on{" "}
          <Link to="/account" className="text-signal underline-offset-4 hover:underline">
            your account
          </Link>
          .
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">Company / publisher (optional)</span>
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="e.g. Thermo Fisher Scientific"
              className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-md border border-border bg-panel px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground">
              Upload SKILL.md
              <input
                type="file"
                accept=".md,text/markdown,text/plain"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={() => setMarkdown(SKILL_MD_TEMPLATE)}
              className="rounded-md border border-border px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              Start from template
            </button>
          </div>

          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={22}
            placeholder={"---\nname: ...\nslug: ...\n---"}
            className="w-full rounded-md border border-border bg-panel p-3 font-mono text-xs leading-relaxed"
          />

          {result && !result.ok && (
            <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs text-destructive">
              {result.problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}
          {result && result.ok && (
            <div className="rounded-md border border-signal/40 bg-signal/10 p-3 font-mono text-xs text-signal">
              “{result.slug}” is in the review queue. You'll get an email when it's reviewed.
              {result.warnings.length > 0 && (
                <ul className="mt-2 text-muted-foreground">
                  {result.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || markdown.trim().length < 20}
            className="rounded-md bg-signal px-5 py-2.5 font-mono text-xs font-medium text-signal-foreground disabled:opacity-50"
          >
            {busy ? "Checking…" : "Submit for review"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
