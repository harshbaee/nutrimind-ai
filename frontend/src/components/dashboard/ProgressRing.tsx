import { type ReactNode } from "react";

type Accent = "health" | "intel" | "cost" | "ai" | "warn" | "ink";

const COLOR: Record<Accent, string> = {
  health: "var(--health)",
  intel: "var(--intel)",
  cost: "var(--cost)",
  ai: "var(--ai)",
  warn: "var(--warn)",
  ink: "var(--ink)",
};

export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  accent = "health",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  accent?: Accent;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = COLOR[accent];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="color-mix(in oklab, white 18%, transparent)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.22,.61,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
