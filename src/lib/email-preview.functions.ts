import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EmailPreview {
  name: string;
  displayName: string;
  subject: string;
  html: string;
  previewDataJson: string;
  error?: string;
}

/** Admin-only: renders every registered app-email template for preview. */
export const getEmailPreviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailPreview[]> => {
    const { isAdmin } = await import("@/lib/db.server");
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");

    const React = await import("react");
    const { render } = await import("@react-email/render");
    const { TEMPLATES } = await import("@/lib/email-templates/registry");

    const out: EmailPreview[] = [];
    for (const [name, entry] of Object.entries(TEMPLATES)) {
      const previewData = entry.previewData ?? {};
      const subject =
        typeof entry.subject === "function"
          ? entry.subject(previewData)
          : entry.subject;
      try {
        const html = await render(
          React.createElement(entry.component, previewData),
        );
        out.push({
          name,
          displayName: entry.displayName || name,
          subject,
          html,
          previewDataJson: JSON.stringify(previewData, null, 2),
        });
      } catch (e) {
        out.push({
          name,
          displayName: entry.displayName || name,
          subject,
          html: "",
          previewDataJson: JSON.stringify(previewData, null, 2),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return out;
  });
