import { type ReactNode } from "react";

type Accent = "health" | "intel" | "cost" | "ai" | "ink";

const ICON_BG: Record<Accent, string> = {
  health: "bg-health-soft text-[color:var(--health)]",
  intel: "bg-intel-soft text-[color:var(--intel)]",
  cost: "bg-cost-soft text-[color:var(--cost)]",
  ai: "bg-ai-soft text-[color:var(--ai)]",
  ink: "bg-[color-mix(in_oklab,var(--ink)_6%,white)] text-[color:var(--ink)]",
};

const BAR_BG: Record<Accent, string> = {
  health: "bg-[color:var(--health)]",
  intel: "bg-[color:var(--intel)]",
  cost: "bg-[color:var(--cost)]",
  ai: "bg-[color:var(--ai)]",
  ink: "bg-[color:var(--ink)]",
};

export function KpiCard({
  label,
  value,
  sub,
  micro,
  progress,
  accent = "ink",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  micro?: ReactNode;
  progress?: number;
  accent?: Accent;
  icon?: ReactNode;
}) {
  return (
    <div className="glass lift relative min-h-[128px] overflow-hidden rounded-2xl p-4">
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${ICON_BG[accent]}`}>
            {icon}
          </span>
        ) : null}
      </div>

      <div className="relative mt-2 flex items-baseline gap-1.5">
        <span className="tnum text-[25px] font-semibold leading-none tracking-tight text-foreground md:text-[28px]">
          {value}
        </span>
      </div>

      {sub ? <div className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</div> : null}

      {typeof progress === "number" ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]">
          <div
            className={`h-full rounded-full ${BAR_BG[accent]} transition-[width] duration-700`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}

      {micro ? <div className="mt-2 text-[10.5px] font-medium text-muted-foreground/90">{micro}</div> : null}
    </div>
  );
}
