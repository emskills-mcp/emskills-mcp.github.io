import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Dashboard ----------

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listApiKeys, getUsage, getVerification, getMonthlyQuota } = await import(
      "@/lib/billing.server"
    );
    const [keys, usage, verification, quota] = await Promise.all([
      listApiKeys(context.userId),
      getUsage(context.userId, 30),
      getVerification(context.userId),
      getMonthlyQuota(context.userId),
    ]);
    return { keys, usage, verification, quota };
  });

/** Keys page payload: keys plus the fair-use ceilings that apply to them. */
export const getApiKeysPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listApiKeys, getMonthlyQuota, getApiKeyActivity } = await import(
      "@/lib/billing.server"
    );
    const [keys, quota, activity] = await Promise.all([
      listApiKeys(context.userId),
      getMonthlyQuota(context.userId),
      getApiKeyActivity(context.userId, 30),
    ]);
    return { keys, quota, activity };
  });

// ---------- API keys ----------

export const createApiKey = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ name: z.string().trim().min(2).max(60) }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { createApiKeyRow, listApiKeys } = await import("@/lib/billing.server");
    const existing = await listApiKeys(context.userId);
    if (existing.filter((k) => !k.revoked_at).length >= 10) {
      return { ok: false as const, message: "Key limit reached (10 active). Revoke one first." };
    }
    const { key, secret } = await createApiKeyRow(context.userId, data.name);
    return { ok: true as const, key, secret };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { revokeApiKeyRow } = await import("@/lib/billing.server");
    await revokeApiKeyRow(context.userId, data.id);
    return { ok: true as const };
  });

export const rotateApiKey = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { rotateApiKeyRow } = await import("@/lib/billing.server");
    try {
      const { key, secret } = await rotateApiKeyRow(context.userId, data.id);
      return { ok: true as const, key, secret };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
    }
  });

// ---------- Publisher verification ----------

export const requestVerification = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        org: z.string().trim().min(2).max(120),
        contactEmail: z.string().trim().email(),
        evidenceUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { requestVerificationRow } = await import("@/lib/billing.server");
    return requestVerificationRow({
      userId: context.userId,
      org: data.org,
      contactEmail: data.contactEmail,
      evidenceUrl: data.evidenceUrl || undefined,
      notes: data.notes ?? undefined,
    });
  });

export const getMyVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getVerification } = await import("@/lib/billing.server");
    return { verification: await getVerification(context.userId) };
  });

export const getPendingPublisherVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin } = await import("@/lib/db.server");
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");
    const { listPendingVerifications } = await import("@/lib/billing.server");
    return listPendingVerifications();
  });

export const reviewPublisherVerification = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      badge: z.enum(["verified", "certified"]).optional(),
      notes: z.string().trim().max(1000).optional(),
    }).parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { isAdmin } = await import("@/lib/db.server");
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");
    const { reviewVerificationRow } = await import("@/lib/billing.server");
    await reviewVerificationRow({
      id: data.id,
      reviewerId: context.userId,
      action: data.action,
      ...(data.badge ? { badge: data.badge } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    });
    return { ok: true };
  });

export const getCertifiedPublishers = createServerFn({ method: "GET" }).handler(async () => {
  const { listCertifiedPublishers } = await import("@/lib/billing.server");
  return listCertifiedPublishers();
});
