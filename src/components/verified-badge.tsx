export type BadgeLevel = "community" | "verified" | "certified";

const meta: Record<BadgeLevel, { label: string; title: string; cls: string; mark: string }> = {
  community: {
    label: "community",
    title: "Community submission — reviewed by a maintainer, publisher identity unverified.",
    cls: "border-border text-muted-foreground",
    mark: "◦",
  },
  verified: {
    label: "verified publisher",
    title: "Publisher identity verified against the submitting organisation.",
    cls: "border-signal/40 bg-signal/10 text-signal",
    mark: "✓",
  },
  certified: {
    label: "certified vendor",
    title: "Certified instrument-vendor publisher — calibration claims validated on real hardware.",
    cls: "border-brass/50 bg-brass/10 text-brass",
    mark: "✦",
  },
};

export function VerifiedBadge({
  level,
  className = "",
}: {
  level: string | null | undefined;
  className?: string;
}) {
  const key: BadgeLevel = level === "verified" || level === "certified" ? level : "community";
  const m = meta[key];
  return (
    <span
      title={m.title}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] ${m.cls} ${className}`}
    >
      <span aria-hidden>{m.mark}</span>
      {m.label}
    </span>
  );
}
