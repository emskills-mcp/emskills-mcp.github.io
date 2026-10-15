import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { SITE_URL } from "@/lib/seo";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/skills", changefreq: "daily", priority: "0.9" },
  { path: "/docs", changefreq: "monthly", priority: "0.8" },
  { path: "/contribute", changefreq: "monthly", priority: "0.8" },
  { path: "/api-docs", changefreq: "monthly", priority: "0.7" },
  { path: "/insights", changefreq: "weekly", priority: "0.6" },
  { path: "/about", changefreq: "yearly", priority: "0.5" },
  { path: "/contact", changefreq: "yearly", priority: "0.5" },
  { path: "/partnerships", changefreq: "yearly", priority: "0.5" },
  { path: "/certified-vendor", changefreq: "monthly", priority: "0.6" },
  { path: "/changelog", changefreq: "weekly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        try {
          const { listPublishedSkills } = await import("@/lib/db.server");
          const skills = await listPublishedSkills();
          for (const skill of skills) {
            const parsed = skill.updated ? Date.parse(skill.updated) : NaN;
            entries.push({
              path: `/skills/${skill.slug}`,
              changefreq: "weekly",
              priority: "0.7",
              ...(Number.isNaN(parsed)
                ? {}
                : { lastmod: new Date(parsed).toISOString().slice(0, 10) }),
            });
          }
        } catch (error) {
          // A registry outage must not break sitemap discovery of static pages.
          console.error("sitemap: failed to load published skills", error);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${escapeXml(`${SITE_URL}${e.path}`)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
