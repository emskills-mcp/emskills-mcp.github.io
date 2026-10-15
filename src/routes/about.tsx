import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";

export const Route = createFileRoute("/about")({
  head: () =>
    meta(
      "About — emskills",
      "Why emskills exists: an open, reviewed shop of agent skills for electron microscopy labs.",
      "/about",
    ),
  component: About,
});

function About() {
  return (
    <PageShell
      crumb="platform / about"
      title="An index for microscopy-grade agent skills"
      intro="emskills catalogues SKILL.md packages that let AI agents plan, acquire and analyse electron microscopy data — with a human review step in front of every listing."
    >
      <Section h="Why it exists">
        <p>
          Microscopy automation is fragmented across vendor SDKs, lab scripts and
          one-off notebooks. Agents need a discoverable, machine-readable layer on
          top of that mess. A reviewed SKILL.md package is that layer.
        </p>
      </Section>
      <Section h="How listings are reviewed">
        <p>
          Every submission is checked for a public repository, a valid SKILL.md,
          a declared tool call and a scope/safety note. Maintainers run the fixture
          invocation before publishing. Publisher identity can be certified
          separately, which is what the verified badge represents.
        </p>
      </Section>
      <Section h="Indexed, not certified">
        <p>
          A listing is not an endorsement. Skills that drive real hardware should be
          read, sandboxed and validated on a test instrument before they touch a
          column under vacuum.
        </p>
      </Section>
    </PageShell>
  );
}
