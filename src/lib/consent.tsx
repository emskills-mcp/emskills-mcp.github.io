import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ConsentState = "unset" | "granted" | "denied";

const STORAGE_KEY = "emskills.analytics-consent";

function read(): ConsentState {
  if (typeof window === "undefined") return "unset";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "granted" || v === "denied" ? v : "unset";
}

type Ctx = {
  consent: ConsentState;
  hydrated: boolean;
  setConsent: (next: Exclude<ConsentState, "unset">) => void;
};

const ConsentContext = createContext<Ctx>({
  consent: "unset",
  hydrated: false,
  setConsent: () => {},
});

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setState] = useState<ConsentState>("unset");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(read());
    setHydrated(true);
  }, []);

  const setConsent = useCallback((next: Exclude<ConsentState, "unset">) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, hydrated, setConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  return useContext(ConsentContext);
}

/** True only when the visitor has actively opted in and DNT is off. */
export function analyticsAllowed(consent: ConsentState): boolean {
  if (consent !== "granted") return false;
  if (typeof navigator !== "undefined") {
    const dnt =
      (navigator as Navigator & { doNotTrack?: string }).doNotTrack ??
      (window as unknown as { doNotTrack?: string }).doNotTrack;
    if (dnt === "1" || dnt === "yes") return false;
  }
  return true;
}

export function ConsentBanner() {
  const { consent, hydrated, setConsent } = useConsent();
  if (!hydrated || consent !== "unset") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-4 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center">
        <p className="flex-1 leading-relaxed">
          We log anonymous footer link clicks to see which resources labs actually use. No cookies,
          no cross-site tracking. Opt in?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="rounded-md border border-border px-3.5 py-2 hover:text-foreground"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="rounded-md bg-signal px-3.5 py-2 font-medium text-signal-foreground"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConsentToggle() {
  const { consent, hydrated, setConsent } = useConsent();
  const on = consent === "granted";
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!hydrated}
      onClick={() => setConsent(on ? "denied" : "granted")}
      className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <span
        className={`relative inline-block h-3.5 w-7 rounded-full border transition-colors ${
          on ? "border-signal bg-signal/30" : "border-border bg-border/40"
        }`}
      >
        <span
          className={`absolute top-0.5 size-2.5 rounded-full transition-all ${
            on ? "left-3.5 bg-signal" : "left-0.5 bg-muted-foreground"
          }`}
        />
      </span>
      analytics {hydrated ? (on ? "on" : "off") : "…"}
    </button>
  );
}
