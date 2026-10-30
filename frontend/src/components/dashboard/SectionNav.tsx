import { type ReactNode } from "react";
import { Boxes, CalendarRange, LayoutGrid, LineChart, Sparkles } from "lucide-react";

export type SectionKey = "overview" | "coach" | "plan" | "analytics" | "workspace";

const ITEMS: { key: SectionKey; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { key: "coach", label: "Coach", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: "plan", label: "Plan", icon: <CalendarRange className="h-3.5 w-3.5" /> },
  { key: "analytics", label: "Analytics", icon: <LineChart className="h-3.5 w-3.5" /> },
  { key: "workspace", label: "Workspace", icon: <Boxes className="h-3.5 w-3.5" /> },
];

export function SectionNav({
  active,
  onChange,
}: {
  active: SectionKey;
  onChange: (key: SectionKey) => void;
}) {
  return (
    <div className="glass flex w-full gap-0.5 overflow-x-auto rounded-full p-1 md:w-auto">
      {ITEMS.map((item) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-all md:flex-none ${
              selected
                ? "bg-[color:var(--ink)] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
