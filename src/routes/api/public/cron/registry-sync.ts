import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled resync of the registry repository. Authenticated with the managed
 * cron secret; runs only when auto-sync is enabled and the configured interval
 * has elapsed. Imports land in the moderated queue, never published directly.
 */
export const Route = createFileRoute("/api/public/cron/registry-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { syncIfDue } = await import("@/lib/registry-sync.server");
        try {
          const result = await syncIfDue();
          return Response.json(result);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("registry cron sync failed:", message);
          return Response.json({ ran: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
