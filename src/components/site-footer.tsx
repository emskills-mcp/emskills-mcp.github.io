import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { trackFooterClick } from "@/lib/analytics.functions";
import { ConsentToggle, analyticsAllowed, useConsent } from "@/lib/consent";


type FooterLink = { label: string; to?: string; search?: Record<string, string>; href?: string };
type FooterColumn = { title: string; links: FooterLink[] };

const columns: FooterColumn[] = [
  {
    title: "Registry",
    links: [
      { label: "All skills", to: "/skills" },
      { label: "cryo-EM", to: "/skills", search: { technique: "cryo-EM" } },
      { label: "Publish a skill", to: "/contribute" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Skills Docs", to: "/docs" },
      { label: "API Docs", to: "/api-docs" },
      { label: "Insights", to: "/insights" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Partnerships", to: "/partnerships" },
      { label: "Certified Vendor", to: "/certified-vendor" },
      { label: "Changelog", to: "/changelog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
];

type QueuedEvent = {
  label: string;
  href: string;
  section: string;
  path: string | null;
};

const QUEUE_KEY = "emskills.footer-click-queue";
const DEDUPE_MS = 1500;

function readQueue(): QueuedEvent[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]).slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedEvent[]) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(0, 50)));
  } catch {
    /* storage unavailable */
  }
}

export function SiteFooter() {
  const track = useServerFn(trackFooterClick);
  const { consent } = useConsent();
  const [open, setOpen] = useState<string | null>(null);
  const lastClick = useRef<Map<string, number>>(new Map());

  // Reliable delivery: drain anything that failed or was cut off by a navigation.
  const flush = useCallback(async () => {
    if (typeof window === "undefined" || !analyticsAllowed(consent)) return;
    let pending = readQueue();
    if (pending.length === 0) return;
    writeQueue([]);
    const failed: QueuedEvent[] = [];
    for (const event of pending) {
      try {
        await track({ data: event });
      } catch {
        failed.push(event);
      }
    }
    pending = [...failed, ...readQueue()];
    writeQueue(pending);
  }, [consent, track]);

  useEffect(() => {
    void flush();
  }, [flush]);

  function record(link: FooterLink, section: string) {
    if (!analyticsAllowed(consent)) return;
    const href = link.href ?? link.to ?? "";
    const key = `${section}::${link.label}::${href}`;
    const now = Date.now();
    const previous = lastClick.current.get(key) ?? 0;
    if (now - previous < DEDUPE_MS) return; // collapse rapid double/triple taps
    lastClick.current.set(key, now);

    const event: QueuedEvent = {
      label: link.label,
      href,
      section,
      path: typeof window === "undefined" ? null : window.location.pathname,
    };

    // Persist first so a navigation that kills the request doesn't lose the click.
    writeQueue([...readQueue(), event]);
    void flush();
  }


  return (
    <footer className="border-t border-border bg-panel">
      <div className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-md border border-signal/40 font-mono text-sm text-signal">
                ◎
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight">
                emskills
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A community shop of SKILL.md packages for electron microscopy.
              Indexed, not certified — read the source before you point it at an instrument.
            </p>
          </div>

          <div className="w-full font-mono text-xs md:grid md:w-auto md:grid-cols-3 md:gap-8 lg:grid-cols-4 lg:gap-10">
            {columns.map((col) => {
              const isOpen = open === col.title;
              return (
                <div key={col.title} className="border-b border-border md:border-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : col.title)}
                    className="flex w-full items-center justify-between py-4 uppercase tracking-[0.15em] text-muted-foreground md:pointer-events-none md:mb-3 md:py-0 md:cursor-default"
                  >
                    {col.title}
                    <span
                      className={`text-signal transition-transform md:hidden ${
                        isOpen ? "rotate-45" : ""
                      }`}
                      aria-hidden
                    >
                      +
                    </span>
                  </button>

                  <ul
                    className={`space-y-1 pb-4 md:block md:space-y-2 md:pb-0 ${
                      isOpen ? "block" : "hidden"
                    }`}
                  >
                    {col.links.map((link) => (
                      <li key={link.label}>
                        {link.href ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => record(link, col.title)}
                            className="block py-2 hover:text-signal md:py-0"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            to={link.to!}
                            {...(link.search ? { search: link.search } : {})}
                            onClick={() => record(link, col.title)}
                            className="block py-2 hover:text-signal md:py-0"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>© 2026 emskills</span>
            <span aria-hidden className="text-border">/</span>
            <span>
              developed by Roberto dos Reis{" "}
              <a
                href="https://github.com/rmsreis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal hover:underline"
              >
                @rmsreis
              </a>
            </span>
          </span>
          <ConsentToggle />
          <span className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-16 bg-signal/40" />
            100 nm
          </span>
        </div>

      </div>
    </footer>
  );
}
