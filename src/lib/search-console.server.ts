// Server-side Google Search Console access via the Lovable connector gateway.
// The property is always resolved from a live GET /webmasters/v3/sites call —
// never hardcoded or cached across requests.

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const TARGET_URL = "https://emskills.org/";

function gatewayHeaders() {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) {
    throw new Error(
      "Search Console is not connected to this project — link the Google Search Console connector first.",
    );
  }
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  };
}

type SiteEntry = { siteUrl: string; permissionLevel?: string };

export type SiteResolution =
  | { status: "selected"; siteUrl: string }
  | { status: "selection_required"; candidates: string[] };

function coversTarget(siteUrl: string, target: URL): boolean {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

export async function resolveSiteUrl(selectedSiteUrl?: string): Promise<SiteResolution> {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: gatewayHeaders() });
  if (!res.ok) {
    throw new Error(`Could not list Search Console properties [${res.status}]: ${await res.text()}`);
  }
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: SiteEntry[] };
  const target = new URL(TARGET_URL);
  const matches = siteEntry.filter(
    (e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target),
  );
  if (selectedSiteUrl) {
    const picked = matches.find((e) => e.siteUrl === selectedSiteUrl);
    if (!picked) {
      throw new Error("The selected Search Console property is not verified for emskills.org.");
    }
    return { status: "selected", siteUrl: picked.siteUrl };
  }
  if (matches.length === 0) {
    throw new Error("No verified Search Console property covers emskills.org.");
  }
  if (matches.length === 1) return { status: "selected", siteUrl: matches[0]!.siteUrl };
  return { status: "selection_required", candidates: matches.map((e) => e.siteUrl) };
}

type AnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type PerformanceSnapshot = {
  status: "ok";
  siteUrl: string;
  range: { from: string; to: string };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  byDate: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
};

async function queryAnalytics(
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<AnalyticsRow[]> {
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (res.status === 403) {
    throw new Error(
      "The connected Google account cannot access the selected Search Console property.",
    );
  }
  if (!res.ok) {
    throw new Error(`Search Console query failed [${res.status}]: ${await res.text()}`);
  }
  const json = (await res.json()) as { rows?: AnalyticsRow[] };
  return json.rows ?? [];
}

/** Last 28 complete days of clicks/impressions/CTR/position, plus top queries and pages. */
export async function getPerformance(
  selectedSiteUrl?: string,
): Promise<PerformanceSnapshot | { status: "selection_required"; candidates: string[] }> {
  const resolution = await resolveSiteUrl(selectedSiteUrl);
  if (resolution.status === "selection_required") return resolution;
  const siteUrl = resolution.siteUrl;

  // GSC data lags ~2 days; end the range 3 days back to use complete days.
  const to = new Date(Date.now() - 3 * 86_400_000);
  const from = new Date(to.getTime() - 27 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const base = { startDate: fmt(from), endDate: fmt(to) };

  const [daily, queries, pages] = await Promise.all([
    queryAnalytics(siteUrl, { ...base, dimensions: ["date"], rowLimit: 60 }),
    queryAnalytics(siteUrl, { ...base, dimensions: ["query"], rowLimit: 10 }),
    queryAnalytics(siteUrl, { ...base, dimensions: ["page"], rowLimit: 10 }),
  ]);

  const byDate = daily
    .map((r) => ({
      date: r.keys[0]!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = byDate.reduce(
    (acc, d) => ({ clicks: acc.clicks + d.clicks, impressions: acc.impressions + d.impressions }),
    { clicks: 0, impressions: 0 },
  );

  return {
    status: "ok",
    siteUrl,
    range: { from: base.startDate, to: base.endDate },
    totals: {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      position:
        byDate.length > 0
          ? byDate.reduce((s, d) => s + d.position, 0) / byDate.length
          : 0,
    },
    byDate,
    topQueries: queries.map((r) => ({
      query: r.keys[0]!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    topPages: pages.map((r) => ({
      page: r.keys[0]!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
  };
}
