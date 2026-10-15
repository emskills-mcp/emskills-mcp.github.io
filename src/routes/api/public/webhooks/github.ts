import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Push webhook for the registry repository: re-syncs skill folders into the
 * moderated queue. Requires GITHUB_WEBHOOK_SECRET and verifies the signature
 * before touching the payload. Nothing is published without admin approval.
 * Every delivery outcome is logged for the admin webhook panel.
 */
export const Route = createFileRoute("/api/public/webhooks/github")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          endpoint: "/api/public/webhooks/github",
          expects: "POST push events, signed with GITHUB_WEBHOOK_SECRET",
          secretConfigured: Boolean(process.env["GITHUB_WEBHOOK_SECRET"]),
        }),

      POST: async ({ request }) => {
        const deliveryId = request.headers.get("x-github-delivery");
        const event = request.headers.get("x-github-event");
        const log = async (status: string, message?: string, repo?: string, ref?: string) => {
          try {
            const { recordWebhookDelivery } = await import("@/lib/registry-sync.server");
            await recordWebhookDelivery({
              deliveryId,
              event,
              status,
              message: message ?? null,
              repo: repo ?? null,
              ref: ref ?? null,
            });
          } catch (e) {
            console.error("webhook log failed:", e);
          }
        };

        const secret = process.env["GITHUB_WEBHOOK_SECRET"];
        if (!secret) {
          await log("misconfigured", "GITHUB_WEBHOOK_SECRET is not set on the server.");
          return new Response("Webhook not configured", { status: 503 });
        }

        const signature = request.headers.get("x-hub-signature-256") ?? "";
        const body = await request.text();
        const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          await log("unauthorized", "Signature did not match GITHUB_WEBHOOK_SECRET.");
          return new Response("Invalid signature", { status: 401 });
        }

        if (event === "ping") {
          await log("verified", "Ping received — signature valid.");
          return Response.json({ ok: true, pong: true });
        }
        if (event !== "push") {
          await log("ignored", `Event "${event}" is not handled.`);
          return new Response("ignored");
        }

        let payload: { repository?: { full_name?: string }; ref?: string } = {};
        try {
          payload = JSON.parse(body) as typeof payload;
        } catch {
          await log("error", "Payload was not valid JSON.");
          return new Response("Invalid JSON", { status: 400 });
        }

        const repoName = payload.repository?.full_name ?? "";
        const ref = payload.ref ?? "";

        const { getRegistrySource, syncRegistryRepo, recordWebhookDelivery } = await import(
          "@/lib/registry-sync.server"
        );
        const source = await getRegistrySource();
        if (!source) {
          await log("error", "No registry repository configured in the admin panel.", repoName, ref);
          return new Response("No registry source configured", { status: 409 });
        }

        if (
          repoName.toLowerCase() !== source.repo.toLowerCase() ||
          (ref && ref !== `refs/heads/${source.branch}`)
        ) {
          await log(
            "ignored",
            `Push to ${repoName || "unknown"} ${ref} does not match ${source.repo}@${source.branch}.`,
            repoName,
            ref,
          );
          return new Response("ignored");
        }

        try {
          const result = await syncRegistryRepo({
            reviewerId: source.created_by ?? "00000000-0000-0000-0000-000000000000",
          });
          const queued = result.items.filter((i) => i.status === "queued").length;
          const updated = result.items.filter((i) => i.status === "updated").length;
          const failed = result.items.filter((i) => i.status === "error").length;
          await recordWebhookDelivery({
            deliveryId,
            event,
            repo: repoName,
            ref,
            status: failed ? "synced_with_errors" : "synced",
            message: `${result.scanned} scanned — ${queued} new, ${updated} updated, ${failed} failed.`,
          });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("registry_sources")
            .update({ last_webhook_at: new Date().toISOString() })
            .eq("id", source.id);
          return Response.json({ ok: true, scanned: result.scanned, queued, updated, failed });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await log("error", message, repoName, ref);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
