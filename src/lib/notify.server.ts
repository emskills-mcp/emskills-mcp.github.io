// Server-only: resolves who to notify and sends registry emails.
// Every send is best-effort — moderation must never fail because of email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { SITE_URL } from "@/lib/seo";

async function emailForUser(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function adminEmails(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = (data ?? []).map((r) => r.user_id as string);
  const emails = await Promise.all(ids.map(emailForUser));
  return [...new Set(emails.filter((e): e is string => !!e))];
}

/** One admin email per submission entering the review queue. */
export async function notifyAdminsOfSubmission(sub: {
  id: string;
  slug: string;
  name: string;
  technique: string;
  kind: string;
  org: string;
  repo: string;
  origin?: string | null;
}) {
  const recipients = await adminEmails();
  await Promise.all(
    recipients.map((to) =>
      sendTemplateEmail("submission-review-request", to, {
        idempotencyKey: `submission-review-request-${sub.id}-${to}`,
        templateData: {
          skillName: sub.name,
          slug: sub.slug,
          technique: sub.technique,
          kind: sub.kind,
          org: sub.org,
          repo: sub.repo,
          origin: sub.origin || "manual submission",
          reviewUrl: `${SITE_URL}/admin/review`,
        },
      }).catch((e: unknown) => {
        console.error("admin submission notification failed", e);
      }),
    ),
  );
}

/** Approve/reject outcome sent to the contributor who submitted the skill. */
export async function notifySubmitterOfDecision(args: {
  submissionId: string;
  submitterId: string | null;
  slug: string;
  name: string;
  decision: "approve" | "reject";
  notes?: string | undefined;
}) {
  if (!args.submitterId) return;
  const to = await emailForUser(args.submitterId);
  if (!to) return;
  const decision = args.decision === "approve" ? "approved" : "rejected";
  try {
    await sendTemplateEmail("submission-decision", to, {
      idempotencyKey: `submission-decision-${args.submissionId}-${decision}`,
      templateData: {
        skillName: args.name,
        slug: args.slug,
        decision,
        notes: args.notes ?? "",
        reviewedAt: new Date().toISOString().slice(0, 10),
        skillUrl: `${SITE_URL}/skills/${args.slug}`,
        contributeUrl: `${SITE_URL}/contribute`,
      },
    });
  } catch (e) {
    console.error("submitter decision notification failed", e);
  }
}
