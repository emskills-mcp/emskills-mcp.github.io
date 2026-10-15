import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "system", label: "System", Icon: Monitor },
  { mode: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle() {
  const { mode, setMode, mounted } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color mode"
      className="flex items-center gap-0.5 rounded-md border border-border bg-panel p-0.5"
    >
      {options.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          aria-label={label}
          aria-pressed={mounted && mode === m}
          onClick={() => setMode(m)}
          className={cn(
            "grid size-6 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground",
            mounted && mode === m && "bg-signal text-signal-foreground hover:text-signal-foreground",
          )}
        >
          <Icon className="size-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
