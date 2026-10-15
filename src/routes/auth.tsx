import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const title = "Sign in — emskills";
const description =
  "Sign in or create an emskills account to submit skills to the registry review queue.";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
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
  component: Auth,
});

function Auth() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function goAfter() {
    if (redirect) {
      window.location.href = redirect;
      return;
    }
    navigate({ to: "/account" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(
          "Account created. Check your inbox to confirm your email, then sign in.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        goAfter();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.redirected) return;
    goAfter();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-[1200px] flex-col items-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="font-mono text-xs text-muted-foreground">
            registry / account
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in to submit a skill to the review queue, or track your existing
            submissions.
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-panel px-4 py-2.5 font-mono text-xs font-medium text-foreground transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-signal"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                password
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-signal"
              />
            </label>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-md border border-signal/40 bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="mt-4 w-full text-center font-mono text-xs text-muted-foreground hover:text-signal"
          >
            {mode === "signin"
              ? "No account? Create one →"
              : "← Already have an account? Sign in"}
          </button>

          <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">
            <Link to="/" className="hover:text-signal">
              ← back to registry
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
