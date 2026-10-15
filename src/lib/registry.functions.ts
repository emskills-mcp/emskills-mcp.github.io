import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { isAdmin } = await import("@/lib/db.server");
  if (!(await isAdmin(userId))) throw new Error("Admin access required.");
}

export const getRegistrySourceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { getRegistrySource } = await import("@/lib/registry-sync.server");
    return getRegistrySource();
  });

export const setRegistrySourceFn = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        repo: z.string().min(3),
        branch: z.string().trim().max(120).optional(),
        pathPrefix: z.string().trim().max(120).optional(),
        autoSyncEnabled: z.boolean().optional(),
        syncIntervalMinutes: z.number().int().min(15).max(10080).optional(),
      })
      .parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { setRegistrySource } = await import("@/lib/registry-sync.server");
    return setRegistrySource({ ...data, userId: context.userId });
  });

export const syncRegistryRepoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { syncRegistryRepo } = await import("@/lib/registry-sync.server");
    return syncRegistryRepo({ reviewerId: context.userId });
  });

/** Runs a scheduled sync when the configured interval has elapsed. */
export const syncIfDueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { syncIfDue } = await import("@/lib/registry-sync.server");
    return syncIfDue();
  });

export const getWebhookStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { getWebhookStatus } = await import("@/lib/registry-sync.server");
    return getWebhookStatus();
  });

/** Field-level and SKILL.md diff of a pending submission against what is live. */
export const getSubmissionDiffFn = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { getSubmissionDiff } = await import("@/lib/db.server");
    return getSubmissionDiff(data.id);
  });

// ---- Version history ----

export const listVersionedSkillsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { listVersionedSkills } = await import("@/lib/db.server");
    return listVersionedSkills();
  });

export const listSkillVersionsFn = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string().min(1) }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { listSkillVersions } = await import("@/lib/db.server");
    return listSkillVersions(data.slug);
  });

export const rollbackSkillFn = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ versionId: z.string().uuid() }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { rollbackSkillToVersion } = await import("@/lib/db.server");
    return rollbackSkillToVersion(data.versionId, context.userId);
  });
