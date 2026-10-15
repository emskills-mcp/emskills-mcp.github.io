// Server-only analytics helpers for footer link engagement.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FooterEventInput = {
  label: string;
  href: string;
  section: string;
  path: string | null;
  userId: string | null;
};

export async function recordFooterClick(input: FooterEventInput): Promise<void> {
  const { error } = await supabaseAdmin.from("footer_link_events").insert({
    label: input.label.slice(0, 80),
    href: input.href.slice(0, 500),
    section: input.section.slice(0, 40),
    path: input.path ? input.path.slice(0, 300) : null,
    user_id: input.userId,
  });
  if (error) console.error("footer_link_events insert failed", error.message);
}

export type FooterLinkStat = {
  label: string;
  section: string;
  href: string;
  clicks: number;
  lastClickedAt: string | null;
  series: { date: string; clicks: number }[];
};

export type FooterAnalytics = {
  from: string;
  to: string;
  days: number;
  total: number;
  links: FooterLinkStat[];
  series: { date: string; clicks: number }[];
};

const DAY = 86_400_000;

function dayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  for (let t = start; t <= end; t += DAY) keys.push(new Date(t).toISOString().slice(0, 10));
  return keys;
}

/** Aggregate footer clicks between two dates (inclusive, UTC day boundaries). */
export async function getFooterAnalytics(
  fromDate?: string | null,
  toDate?: string | null,
): Promise<FooterAnalytics> {
  const to = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();
  const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(to.getTime() - 29 * DAY);

  const { data, error } = await supabaseAdmin
    .from("footer_link_events")
    .select("label, section, href, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(20000);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const keys = dayKeys(from, to);

  const byLabel = new Map<string, FooterLinkStat & { _days: Map<string, number> }>();
  const byDay = new Map<string, number>();

  for (const row of rows) {
    const day = String(row.created_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    const key = `${row.section}::${row.label}`;
    let stat = byLabel.get(key);
    if (!stat) {
      stat = {
        label: row.label,
        section: row.section,
        href: row.href,
        clicks: 0,
        lastClickedAt: row.created_at,
        series: [],
        _days: new Map(),
      };
      byLabel.set(key, stat);
    }
    stat.clicks += 1;
    stat._days.set(day, (stat._days.get(day) ?? 0) + 1);
  }

  const links: FooterLinkStat[] = [...byLabel.values()]
    .map(({ _days, ...s }) => ({
      ...s,
      series: keys.map((d) => ({ date: d, clicks: _days.get(d) ?? 0 })),
    }))
    .sort((a, b) => b.clicks - a.clicks);

  return {
    from: keys[0] ?? from.toISOString().slice(0, 10),
    to: keys[keys.length - 1] ?? to.toISOString().slice(0, 10),
    days: keys.length,
    total: rows.length,
    links,
    series: keys.map((d) => ({ date: d, clicks: byDay.get(d) ?? 0 })),
  };
}
