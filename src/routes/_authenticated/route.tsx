import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "in" : "out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const redirected = useRef(false);
  useEffect(() => {
    if (status !== "out" || redirected.current) return;
    redirected.current = true;
    navigate({ to: "/auth", search: { redirect: location.href } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, navigate]);

  if (status !== "in") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[1200px] px-5 py-24 font-mono text-sm text-muted-foreground">
          checking session…
        </div>
      </div>
    );
  }

  return <Outlet />;
}
