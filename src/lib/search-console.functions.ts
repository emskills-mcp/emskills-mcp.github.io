import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Search performance for emskills.org — admin-only, resolved via the live property list. */
export const getSearchPerformance = createServerFn({ method: "GET" })
  .inputValidator((raw) =>
    z
      .object({ siteUrl: z.string().max(300).optional() })
      .parse(raw ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { isAdmin } = await import("@/lib/db.server");
    if (!(await isAdmin(context.userId))) throw new Error("Admin access required.");
    const { getPerformance } = await import("@/lib/search-console.server");
    return getPerformance(data.siteUrl);
  });
