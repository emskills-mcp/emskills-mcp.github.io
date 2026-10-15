import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";

export const Route = createFileRoute("/privacy")({
  head: () =>
    meta(
      "Privacy Policy — emskills",
      "What emskills stores about accounts, submissions, API keys and MCP run logs, and how long it is kept.",
      "/privacy",
    ),
  component: Privacy,
});

function Privacy() {
  return (
    <PageShell
      crumb="legal / privacy policy"
      title="Privacy Policy"
      intro="Last updated 26 August 2026. This registry stores the minimum needed to run accounts, moderate submissions and meter MCP usage."
    >
      <Section h="What we store">
        <p>
          Account email and authentication identifiers; submissions you create and
          their review history; API key metadata (a hash of the secret, never the
          secret itself); MCP run records containing skill slug, tool name, status,
          duration and timestamp.
        </p>
      </Section>
      <Section h="What we do not store">
        <p>
          We do not store your instrument data, image stacks or tool arguments beyond
          what is needed to return a run result, and we never store raw API secrets.
          emskills is free — we never collect or process payment details.
        </p>
      </Section>
      <Section h="Sharing">
        <p>
          Data is shared only with the infrastructure providers required to operate
          the service. Published listings and publisher organisation names are
          public by design. We do not sell personal data.
        </p>
      </Section>
      <Section h="Retention and your rights">
        <p>
          Run logs are retained for 13 months for abuse investigation;
          account records are deleted on request. To access, export or delete your
          data, open an issue on{" "}
          <a
            href="https://github.com/emskills-mcp/em-skills/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal hover:underline"
          >
            the emskills repository
          </a>{" "}
          or contact the maintainer,{" "}
          <a
            href="https://github.com/rmsreis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal hover:underline"
          >
            @rmsreis
          </a>
          , on GitHub.
        </p>
      </Section>
    </PageShell>
  );
}
