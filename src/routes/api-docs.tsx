import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, meta } from "@/components/page-shell";

export const Route = createFileRoute("/api-docs")({
  head: () =>
    meta(
      "API Docs — emskills",
      "Authenticate with an ems_live key and call the emskills registry and run endpoints from your own tooling.",
      "/api-docs",
    ),
  component: ApiDocs,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-panel p-4 font-mono text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function ApiDocs() {
  return (
    <PageShell
      crumb="resources / api docs"
      title="Registry API"
      intro="Mint a key on your dashboard, send it as a bearer token, and read the registry or execute a skill's tool from your own agent stack."
    >
      <Section h="Authentication">
        <p>
          Keys are shown once at creation and stored only as a hash. Send them in the
          Authorization header; unauthenticated reads are allowed on public listings
          but are rate limited.
        </p>
        <Code>{`Authorization: Bearer ems_live_xxxxxxxxxxxxxxxxxxxx`}</Code>
      </Section>
      <Section h="List skills">
        <Code>{`GET /api/public/skills?technique=cryo-EM&kind=MCP%20server

{
  "skills": [
    { "slug": "cryo2d-classify", "name": "Cryo 2D Classify",
      "technique": "cryo-EM", "toolCall": "cryo2d.classify",
      "version": "1.4.2", "verifiedBadge": "verified" }
  ]
}`}</Code>
      </Section>
      <Section h="Run a skill tool">
        <p>
          Each call is metered and appears on your dashboard within seconds, with
          status, duration and any error returned by the MCP server.
        </p>
        <Code>{`POST /api/public/run
{ "slug": "cryo2d-classify",
  "args": { "stackUrl": "https://…/stack.mrc", "classes": 50 } }

{ "ok": true, "mode": "live", "durationMs": 1840,
  "output": { "classes": 50, "resolution": "6.2 A" } }`}</Code>
      </Section>
      <Section h="Errors">
        <p>
          <span className="font-mono text-xs">401</span> invalid or revoked key ·{" "}
          <span className="font-mono text-xs">429</span> rate limited ·{" "}
          <span className="font-mono text-xs">404</span> unknown slug ·{" "}
          <span className="font-mono text-xs">502</span> the upstream MCP server
          failed. Failed runs are logged for diagnostics.
        </p>
      </Section>
    </PageShell>
  );
}
