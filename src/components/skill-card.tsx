import { Link } from "@tanstack/react-router";
import type { Skill } from "@/data/skills";

export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <Link
      to="/skills/$slug"
      params={{ slug: skill.slug }}
      className="group block rounded-lg border border-border bg-card p-5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-signal/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold">{skill.name}</h3>
            <span className="rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[10px] text-signal">
              {skill.technique}
            </span>
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {skill.kind}
            </span>
          </div>
          <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">
            {skill.summary}
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs text-brass">
          ★ {skill.stars.toLocaleString()}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
        <span className="text-foreground">@{skill.org}</span>
        <span>updated {skill.updated}</span>
        <span className="ml-auto">{skill.version}</span>
      </div>
    </Link>
  );
}
