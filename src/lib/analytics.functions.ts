import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(500),
  section: z.string().trim().min(1).max(40).default("footer"),
  path: z.string().trim().max(300).nullable().default(null),
});

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .default(null);

const rangeSchema = z.object({ from: isoDay, to: isoDay });

/** Public: records a footer link click. Fire-and-forget from the client. */
export const trackFooterClick = createServerFn({ method: "POST" })
  .inputValidator((raw) => eventSchema.parse(raw))
  .handler(async ({ data }) => {
    const { recordFooterClick } = await import("@/lib/analytics.server");
    await recordFooterClick({ ...data, userId: null });
    return { ok: true as const };
  });

/** Authenticated: footer engagement rollup for the dashboard. */
export const getFooterAnalyticsData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => rangeSchema.parse(raw ?? { from: null, to: null }))
  .handler(async ({ data }) => {
    const { getFooterAnalytics } = await import("@/lib/analytics.server");
    return getFooterAnalytics(data.from, data.to);
  });
