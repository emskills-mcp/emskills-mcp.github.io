import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
  webPageJsonLd,
} from "@/lib/seo";

/** Shared layout for the static content pages linked from the footer. */
export function PageShell({
  crumb,
  title,
  intro,
  children,
}: {
  crumb: string;
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-5 py-12">
        <div className="font-mono text-xs text-muted-foreground">{crumb}</div>
        <h1 className="mt-3 max-w-[24ch] text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-[62ch] text-pretty text-base leading-relaxed text-muted-foreground">
          {intro}
        </p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({ h, children }: { h: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">{h}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/**
 * head() helper for the static content pages. Pass the route path to get a
 * self-referencing canonical/og:url plus WebPage + BreadcrumbList JSON-LD.
 */
export function meta(title: string, description: string, path?: string) {
  const url = path ? absoluteUrl(path) : undefined;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "emskills" },
      ...(url ? [{ property: "og:url", content: url }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    ...(url && path
      ? {
          links: [{ rel: "canonical", href: url }],
          scripts: [
            jsonLdScript(webPageJsonLd({ path, name: title, description })),
            jsonLdScript(
              breadcrumbJsonLd([
                { name: "emskills", path: "/" },
                { name: title.split("—")[0]!.trim(), path },
              ]),
            ),
          ],
        }
      : {}),
  };
}
