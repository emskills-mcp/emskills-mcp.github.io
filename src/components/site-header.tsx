import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/skills.functions";
import brandMark from "@/assets/emskills-mark.png";

const nav = [
  { to: "/", label: "Index" },
  { to: "/skills", label: "Skills" },
  { to: "/docs", label: "Docs" },
  { to: "/contribute", label: "Contribute" },
] as const;

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    async function sync(session: boolean) {
      if (!alive) return;
      setSignedIn(session);
      if (!session) {
        setAdmin(false);
        return;
      }
      try {
        const res = await checkAdmin();
        if (alive) setAdmin(res.isAdmin);
      } catch {
        if (alive) setAdmin(false);
      }
    }
    supabase.auth.getSession().then(({ data }) => sync(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => sync(!!s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={brandMark}
            alt="emskills aperture reticle logo"
            width={28}
            height={28}
            className="size-7"
          />
          <span className="font-display text-[15px] font-semibold tracking-tight">
            emskills<span className="text-muted-foreground">.org</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-6 font-mono text-xs text-muted-foreground md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-foreground" }}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {admin && (
            <Link
              to="/admin/review"
              className="rounded-md border border-brass/40 px-3.5 py-2 font-mono text-xs text-brass transition-colors hover:border-brass"
            >
              Admin
            </Link>
          )}
          <ThemeToggle />
          {signedIn && (
            <Link
              to="/dashboard"
              className="rounded-md border border-border px-3.5 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-signal"
            >
              Dashboard
            </Link>
          )}
          {signedIn && (
            <Link
              to="/api-keys"
              className="hidden rounded-md border border-border px-3.5 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-signal md:inline-block"
            >
              API keys
            </Link>
          )}
          {signedIn ? (
            <Link
              to="/account"
              className="rounded-md border border-border px-3.5 py-2 font-mono text-xs text-foreground transition-colors hover:text-signal"
            >
              Account
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: undefined }}
              className="rounded-md border border-border px-3.5 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-signal"
            >
              Sign in
            </Link>
          )}
          <Link
            to="/contribute"
            className="rounded-md bg-signal px-3.5 py-2 font-mono text-xs font-medium text-signal-foreground transition-transform duration-200 hover:-translate-y-px"
          >
            Add skill
          </Link>
        </div>
      </div>
    </header>
  );
}
