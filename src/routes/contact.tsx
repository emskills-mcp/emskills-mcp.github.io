import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";

export const Route = createFileRoute("/contact")({
  head: () =>
    meta(
      "Contact — emskills",
      "Reach the emskills maintainers about listings, reviews or security reports.",
      "/contact",
    ),
  component: Contact,
});

const REPO = "https://github.com/emskills-mcp/em-skills";

const lines = [
  { k: "general", v: "@rmsreis on GitHub", href: "https://github.com/rmsreis" },
  { k: "registry review", v: "open a pull request", href: `${REPO}/pulls` },
  {
    k: "security",
    v: "security advisory",
    href: `${REPO}/security/advisories/new`,
  },
  { k: "anything else", v: "open an issue", href: `${REPO}/issues/new` },
];

function Contact() {
  return (
    <PageShell
      crumb="platform / contact"
      title="Talk to the maintainers"
      intro="Questions about a listing, a review decision, or publisher verification — everything runs through GitHub while emskills is maintainer-operated. Expect a reply within two business days."
    >
      <Section h="Direct lines">
        <ul className="space-y-2 font-mono text-xs">
          {lines.map((l) => (
            <li key={l.k} className="flex justify-between gap-4 border-b border-border pb-2">
              <span className="text-muted-foreground">{l.k}</span>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal hover:underline"
              >
                {l.v} ↗
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <Section h="Reporting an unsafe skill">
        <p>
          If a listed skill can damage an instrument or sample, file a private
          security advisory with the slug, the repository commit and the failure
          mode. Listings are pulled from the index while a report is open.
        </p>
      </Section>
      <Section h="Maintainer">
        <p>
          emskills is developed and maintained by Roberto dos Reis —{" "}
          <a
            href="https://github.com/rmsreis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal hover:underline"
          >
            @rmsreis
          </a>
          .
        </p>
      </Section>
    </PageShell>
  );
}
