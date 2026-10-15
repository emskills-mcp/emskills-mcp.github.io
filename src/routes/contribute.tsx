import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, webPageJsonLd } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { submitSkill, verifySkillRepo } from "@/lib/skills.functions";
import { SiteHeader } from "@/components/site-header";
import { PublisherVerificationPanel } from "@/components/publisher-verification";
import { SiteFooter } from "@/components/site-footer";
import { SkillTemplateGuide } from "@/components/skill-template-guide";
import { techniques, categories } from "@/data/skills";

const title = "Contribute a skill — emskills";
const description =
  "Submit a SKILL.md package or MCP server to the emskills registry review queue.";

export const Route = createFileRoute("/contribute")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { property: "og:url", content: absoluteUrl("/contribute") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/contribute") }],
    scripts: [
      jsonLdScript(webPageJsonLd({ path: "/contribute", name: title, description })),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "emskills", path: "/" },
          { name: (title.split("—")[0] ?? title).trim(), path: "/contribute" },
        ]),
      ),
    ],
  }),
  component: Contribute,
});

const criteria = [
  {
    h: "A valid SKILL.md at the repository root",
    p: "Frontmatter with name, technique, category and license; a scope section that states the limits of the skill.",
  },
  {
    h: "A runnable MCP server or reference implementation",
    p: "Typed tool definitions and a sample invocation that completes against the bundled fixture data.",
  },
  {
    h: "An instrument safety note",
    p: "Anything that moves a stage, changes beam conditions, or mills material must declare it in plain language.",
  },
  {
    h: "Reproducible outputs",
    p: "Pinned dependencies and a deterministic mode so a reviewer can reproduce your reported numbers.",
  },
];

const empty = {
  slug: "",
  name: "",
  technique: "cryo-EM",
  kind: "MCP server" as "MCP server" | "SKILL.md",
  summary: "",
  description: "",
  org: "",
  repo: "",
  version: "",
  license: "MIT",
  runtime: "python 3.11",
  tool_call: "",
  category: "Segmentation",
  mcp_endpoint: "",
  tags: "",
};

function Contribute() {
  const submit = useServerFn(submitSkill);
  const verifyRepo = useServerFn(verifySkillRepo);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [repoOk, setRepoOk] = useState<string | null>(null);
  const [checkingRepo, setCheckingRepo] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSignedIn(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k as string];
      return next;
    });
    if (k === "repo") setRepoOk(null);
  }

  async function handleVerifyRepo() {
    if (!form.repo.trim()) return;
    setCheckingRepo(true);
    setRepoOk(null);
    try {
      const res = await verifyRepo({ data: { repo: form.repo } });
      if (res.ok) {
        setFieldErrors((e) => {
          const next = { ...e };
          delete next["repo"];
          return next;
        });
        setRepoOk(`${res.repo} — ${res.skillMdPath} found`);
      } else {
        setFieldErrors((e) => ({ ...e, repo: res.message }));
      }
    } catch (e) {
      setFieldErrors((prev) => ({
        ...prev,
        repo: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setCheckingRepo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await submit({
        data: {
          slug: form.slug,
          name: form.name,
          technique: form.technique,
          kind: form.kind,
          summary: form.summary,
          description: form.description,
          org: form.org,
          repo: form.repo,
          version: form.version,
          license: form.license,
          runtime: form.runtime,
          tool_call: form.tool_call,
          category: form.category,
          mcp_endpoint: form.mcp_endpoint,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors);
        setError(res.message);
        return;
      }
      setDone(true);
      setForm(empty);
      setRepoOk(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-signal";
  const errorInputClass =
    "mt-1.5 w-full rounded-md border border-destructive bg-destructive/5 px-3 py-2 font-mono text-sm outline-none focus:border-destructive";
  const labelClass =
    "font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">
          registry / contribute
        </div>
        <h1 className="mt-3 max-w-[22ch] text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Publish a skill to the index
        </h1>
        <p className="mt-4 max-w-[58ch] text-pretty text-base leading-relaxed text-muted-foreground">
          Submissions enter a review queue where a maintainer checks the manifest,
          runs the fixture invocation, and confirms the safety note before the entry
          is listed. Provide the source repository and the metadata below.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {criteria.map((c, i) => (
            <div key={c.h} className="rounded-lg border border-border bg-card p-5">
              <div className="font-mono text-[10px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="mt-3 font-display font-semibold">{c.h}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.p}
              </p>
            </div>
          ))}
        </div>

        {signedIn && <PublisherVerificationPanel />}

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Submit your skill
          </h2>

          {signedIn === null ? null : signedIn === false ? (
            <div className="mt-5 rounded-lg border border-border bg-card p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                You need to be signed in to submit a skill to the review queue.
              </p>
              <Link
                to="/auth"
                search={{ redirect: window.location.href }}
                className="mt-4 inline-block rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px"
              >
                Sign in to submit
              </Link>
            </div>
          ) : done ? (
            <div className="mt-5 rounded-lg border border-signal/40 bg-signal/10 p-6">
              <p className="font-mono text-sm text-signal">
                submitted · queued for review
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your skill is in the moderation queue. Median review time is about
                4 days — track its status on your account page.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setDone(false)}
                  className="rounded-md border border-border bg-panel px-4 py-2.5 font-mono text-xs hover:text-signal"
                >
                  Submit another
                </button>
                <Link
                  to="/account"
                  className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground hover:-translate-y-px"
                >
                  View my submissions
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <Field label="slug" error={fieldErrors["slug"]}>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  className={fieldErrors["slug"] ? errorInputClass : inputClass}
                  placeholder="cryo2d-classify"
                />
              </Field>
              <Field label="name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="technique">
                <select
                  value={form.technique}
                  onChange={(e) => set("technique", e.target.value)}
                  className={inputClass}
                >
                  {techniques.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.note}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="kind">
                <select
                  value={form.kind}
                  onChange={(e) => set("kind", e.target.value as typeof form.kind)}
                  className={inputClass}
                >
                  <option value="MCP server">MCP server</option>
                  <option value="SKILL.md">SKILL.md</option>
                </select>
              </Field>
              <Field label="category">
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={inputClass}
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="tool_call">
                <input
                  required
                  value={form.tool_call}
                  onChange={(e) => set("tool_call", e.target.value)}
                  className={inputClass}
                  placeholder="2d_classify"
                />
              </Field>
              <Field label="org">
                <input
                  required
                  value={form.org}
                  onChange={(e) => set("org", e.target.value)}
                  className={inputClass}
                  placeholder="volvox-lab"
                />
              </Field>
              <Field label="repo (github url or owner/name)" error={fieldErrors["repo"]}>
                <div className="mt-1.5 flex gap-2">
                  <input
                    required
                    value={form.repo}
                    onChange={(e) => set("repo", e.target.value)}
                    className={`${fieldErrors["repo"] ? errorInputClass : inputClass} mt-0 flex-1`}
                    placeholder="https://github.com/volvox-lab/cryo2d"
                    aria-invalid={!!fieldErrors["repo"]}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyRepo}
                    disabled={checkingRepo}
                    className="shrink-0 rounded-md border border-border bg-panel px-3 font-mono text-xs text-muted-foreground hover:text-signal disabled:opacity-60"
                  >
                    {checkingRepo ? "checking…" : "Verify"}
                  </button>
                </div>
                {repoOk && (
                  <p className="mt-1.5 font-mono text-[11px] text-signal">✓ {repoOk}</p>
                )}
              </Field>
              <Field
                label="mcp endpoint (optional, https)"
                error={fieldErrors["mcp_endpoint"]}
              >
                <input
                  value={form.mcp_endpoint}
                  onChange={(e) => set("mcp_endpoint", e.target.value)}
                  className={fieldErrors["mcp_endpoint"] ? errorInputClass : inputClass}
                  placeholder="https://mcp.volvox-lab.org/mcp"
                />
              </Field>
              <Field label="version">
                <input
                  required
                  value={form.version}
                  onChange={(e) => set("version", e.target.value)}
                  className={inputClass}
                  placeholder="v2.4.1"
                />
              </Field>
              <Field label="license">
                <input
                  required
                  value={form.license}
                  onChange={(e) => set("license", e.target.value)}
                  className={inputClass}
                  placeholder="MIT"
                />
              </Field>
              <Field label="runtime">
                <input
                  required
                  value={form.runtime}
                  onChange={(e) => set("runtime", e.target.value)}
                  className={inputClass}
                  placeholder="python 3.11"
                />
              </Field>
              <Field label="tags (comma-separated)">
                <input
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  className={inputClass}
                  placeholder="2d, cluster, ctf"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="summary">
                  <input
                    required
                    minLength={10}
                    value={form.summary}
                    onChange={(e) => set("summary", e.target.value)}
                    className={inputClass}
                    placeholder="One-line description shown on cards."
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="description">
                  <textarea
                    required
                    minLength={10}
                    rows={4}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className={`${inputClass} resize-y`}
                    placeholder="Full description: what it does, inputs, outputs, preconditions."
                  />
                </Field>
              </div>

              {(error || Object.keys(fieldErrors).length > 0) && (
                <div
                  role="alert"
                  className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive"
                >
                  <p>{error ?? "Submission rejected — see the fields below."}</p>
                  {Object.keys(fieldErrors).length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {Object.entries(fieldErrors).map(([k, v]) => (
                        <li key={k}>
                          <span className="text-foreground">{k}</span>: {v}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-signal px-5 py-2.5 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
                >
                  {busy ? "submitting…" : "Submit for review"}
                </button>
              </div>
            </form>
          )}
        </section>

        <p className="mt-10 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
          Indexing is not certification. Listed skills are references to read and
          adapt — verify every procedure against your own instrument and sample
          before running it unattended.
        </p>
        <SkillTemplateGuide />
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className={`font-mono text-[11px] uppercase tracking-[0.15em] ${error ? "text-destructive" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      {children}
      {error && (
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </label>
  );
}
