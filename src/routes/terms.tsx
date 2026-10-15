import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";

export const Route = createFileRoute("/terms")({
  head: () =>
    meta(
      "Terms of Service — emskills",
      "Terms covering registry listings, MCP execution, instrument safety and account termination.",
      "/terms",
    ),
  component: Terms,
});

function Terms() {
  return (
    <PageShell
      crumb="legal / terms of service"
      title="Terms of Service"
      intro="Last updated 26 August 2026. By using emskills you agree to the terms below."
    >
      <Section h="The registry is an index">
        <p>
          Listings are catalogued, not certified. Skills are the work of their
          publishers and are provided without warranty. Review the source before
          connecting a skill to any instrument.
        </p>
      </Section>
      <Section h="Instrument safety">
        <p>
          You are solely responsible for anything an agent does to your hardware,
          samples or data. Run skills against a simulator or a test instrument first.
          Never grant a skill unsupervised control of a beam, stage or vacuum system.
        </p>
      </Section>
      <Section h="Publishing">
        <p>
          You must own or be licensed to publish the code you submit, and it must
          include an accurate SKILL.md with a scope and safety note. We may reject,
          edit or remove any listing, and revoke verification, at our discretion.
        </p>
      </Section>
      <Section h="Accounts, keys and usage">
        <p>
          Keep API keys secret; activity under your key is your responsibility.
          Automated scraping, abusive request volume and attempts to reach internal
          network addresses through the run endpoint are prohibited.
        </p>
      </Section>
      <Section h="Free access and termination">
        <p>
          emskills is free to use — there are no paid plans, subscriptions or
          charges. We may suspend accounts that violate these terms; you may close
          your account at any time.
        </p>
      </Section>
    </PageShell>
  );
}
