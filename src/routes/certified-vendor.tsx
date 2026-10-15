import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/certified-vendor")({
  head: () =>
    meta(
      "Certified Vendor programme — emskills",
      "How instrument, detector and software vendors earn the certified vendor badge on the emskills electron microscopy skill registry.",
      "/certified-vendor",
    ),
  component: CertifiedVendor,
});

const criteria = [
  {
    h: "1 — First-party ownership",
    p: "Skills are published from a repository owned by the vendor organisation, and the GitHub organisation is confirmed by a maintainer at a company domain address.",
  },
  {
    h: "2 — A real MCP endpoint",
    p: "Every certified skill declares an mcp_endpoint in its SKILL.md front matter and answers a live tool call. Documentation-only entries stay at community level.",
  },
  {
    h: "3 — Hardware-validated claims",
    p: "Any calibration, dose, drift or resolution figure quoted in a skill must be reproducible on the instrument it names, with the acquisition conditions written into the skill documentation.",
  },
  {
    h: "4 — Maintenance commitment",
    p: "A named maintainer, a public issue tracker, and a response window for breaking changes. Skills that go unmaintained for two sync cycles drop back to verified.",
  },
  {
    h: "5 — Open licence on the skill",
    p: "The SKILL.md, tool schemas and examples carry an open licence. The model or service behind the endpoint can stay commercial — the interface cannot be closed.",
  },
];

const benefits = [
  "The brass certified vendor badge on every skill page, registry card and search result.",
  "A vendor collection page grouping all of your skills under one instrument family.",
  "Clearly-labelled featured placement on the index and on the technique pages your skills cover.",
  "Sync-time validation reports so a broken endpoint reaches you before it reaches a user.",
  "Co-promotion on the changelog and insights pages when new skills go live.",
];

function CertifiedVendor() {
  return (
    <PageShell
      crumb="platform / partnerships / certified vendor"
      title="The Certified Vendor programme"
      intro="Certification tells a microscopist that a skill came from the people who built the instrument, that its numbers were checked on real hardware, and that someone is on the hook when it breaks. It is free to apply for and free to hold."
    >
      <Section h="The three publisher levels">
        <div className="flex flex-wrap gap-2 pb-1">
          <VerifiedBadge level="community" />
          <VerifiedBadge level="verified" />
          <VerifiedBadge level="certified" />
        </div>
        <p>
          <strong className="text-foreground">Community</strong> is the default:
          reviewed by a maintainer, publisher identity unconfirmed.{" "}
          <strong className="text-foreground">Verified publisher</strong> means we
          confirmed the person behind the submission belongs to the organisation
          they claim.{" "}
          <strong className="text-foreground">Certified vendor</strong> is reserved
          for instrument, detector and analysis-software makers publishing
          first-party skills for their own hardware.
        </p>
      </Section>

      <Section h="What we check before certifying">
        <ul className="space-y-3">
          {criteria.map((c) => (
            <li key={c.h}>
              <span className="font-mono text-xs text-foreground">{c.h}</span>
              <br />
              {c.p}
            </li>
          ))}
        </ul>
      </Section>

      <Section h="What a certified vendor gets">
        <ul className="list-disc space-y-2 pl-5">
          {benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </Section>

      <Section h="How to apply">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Publish at least one skill to the registry from your organisation's
            GitHub repository, following the SKILL.md template in the docs.
          </li>
          <li>
            Request publisher verification from the contribute page using an email
            address on your company domain.
          </li>
          <li>
            A maintainer runs each declared MCP endpoint and reviews the
            hardware claims with you. Expect one round of questions.
          </li>
          <li>
            On approval the badge appears on your skills immediately and is
            re-checked at every registry sync.
          </li>
        </ol>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/contribute"
            className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground"
          >
            Apply for certification
          </Link>
          <Link
            to="/docs"
            className="rounded-md border border-border px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            Read the SKILL.md spec
          </Link>
          <Link
            to="/contact"
            className="rounded-md border border-border px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            Talk to a maintainer
          </Link>
        </div>
      </Section>

      <Section h="Withdrawal and honesty">
        <p>
          Certification can be withdrawn: a dead endpoint, an unreproducible
          calibration claim, or a skill that quietly starts sending microscope
          data somewhere undisclosed all end it. Placement is always labelled as
          placement, and certification is never sold — a paid slot cannot buy the
          badge, and the badge does not buy a better ranking in search results.
        </p>
      </Section>
    </PageShell>
  );
}
