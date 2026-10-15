/** Canonical site identity used for sitemap entries and JSON-LD structured data. */
export const SITE_URL = "https://emskills.org";
export const SITE_NAME = "emskills";
export const SITE_DESCRIPTION =
  "A registry of SKILL.md packages and MCP servers for electron microscopy workflows — SEM, TEM, STEM, EDS, EELS, cryo-EM and FIB.";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  description: SITE_DESCRIPTION,
  sameAs: ["https://twitter.com/emskills", "https://www.reddit.com/r/emskills/"],
};

export const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/skills?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/** WebPage node for a single route, linked back to the sitewide WebSite/Organization. */
export function webPageJsonLd({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}) {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** FAQPage node for a list of visible question/answer pairs. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

/** SoftwareApplication node describing one registry entry. */
export function skillJsonLd(skill: {
  slug: string;
  name: string;
  summary: string;
  technique: string;
  category: string;
  version: string;
  license: string;
  org: string;
  repo: string;
  updated?: string;
}) {
  const url = absoluteUrl(`/skills/${skill.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: skill.name,
    url,
    description: skill.summary,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: `${skill.technique} — ${skill.category}`,
    softwareVersion: skill.version,
    license: skill.license,
    codeRepository: `https://github.com/${skill.repo}`,
    operatingSystem: "Any",
    author: { "@type": "Organization", name: skill.org },
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(skill.updated && !Number.isNaN(Date.parse(skill.updated))
      ? { dateModified: new Date(skill.updated).toISOString().slice(0, 10) }
      : {}),
  };
}

/** head() script entry helper. */
export function jsonLdScript(data: unknown) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}
