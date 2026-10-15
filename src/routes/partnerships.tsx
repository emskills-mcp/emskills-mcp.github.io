import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";
import { VerifiedBadge } from "@/components/verified-badge";
import { getCertifiedPublishers } from "@/lib/billing.functions";

export const Route = createFileRoute("/partnerships")({
  head: () =>
    meta(
      "Partnerships — emskills",
      "Vendor certification, featured placement and lab integration partnerships for the electron microscopy skill registry — free to join.",
      "/partnerships",
    ),
  loader: () => getCertifiedPublishers(),
  component: Partnerships,
});

const tiers = [
  {
    h: "Certified vendor",
    p: "Instrument and detector manufacturers publish first-party MCP servers under a certified badge, with calibration claims validated on real hardware.",
  },
  {
    h: "Lab tier",
    p: "Core facilities get a featured slot and a maintained collection for the workflows they support for their user community.",
  },
  {
    h: "Placement",
    p: "Clearly-labelled featured slots on the index and technique pages. No disguised ads — placement is always marked.",
  },
];

function Partnerships() {
  const publishers = Route.useLoaderData();
  return (
    <PageShell
      crumb="platform / partnerships"
      title="Partner with the registry"
      intro="Vendors, core facilities and software teams can publish certified skills, take featured placement, or run private skills for an internal fleet of instruments."
    >
      <Section h="Certified publisher directory">
        {publishers.length === 0 ? (
          <p>No publishers have completed certification yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {publishers.map((publisher) => (
              <div key={`${publisher.org}-${publisher.badge}`} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold text-foreground">{publisher.org}</h3>
                  <VerifiedBadge level={publisher.badge} />
                </div>
                {publisher.skills.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {publisher.skills.map((skill) => (
                      <Link
                        key={skill.slug}
                        to="/skills/$slug"
                        params={{ slug: skill.slug }}
                        className="rounded border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground hover:border-signal/50 hover:text-signal"
                      >
                        {skill.name} · {skill.technique}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 font-mono text-xs">Certification active · first skill pending publication</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
      {tiers.map((t) => (
        <Section key={t.h} h={t.h}>
          <p>{t.p}</p>
        </Section>
      ))}
      <Section h="Get started">
        <p>
          Apply for publisher certification from the contribute page. The registry
          is free to use and free to publish to — no plans, no fees.
        </p>
        <div className="flex gap-3 pt-1">
          <Link
            to="/certified-vendor"
            className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground"
          >
            Certified Vendor programme
          </Link>
          <Link
            to="/vendor-submit"
            className="rounded-md border border-border px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            Submit a SKILL.md
          </Link>
          <Link
            to="/dashboard"
            className="rounded-md border border-border px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            Open dashboard
          </Link>
        </div>
      </Section>
    </PageShell>
  );
}
