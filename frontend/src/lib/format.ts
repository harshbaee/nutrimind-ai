export const fmtEur = (n?: number | null) =>
  typeof n === "number" ? `€${n.toFixed(2)}` : "—";
export const fmtNum = (n?: number | null, digits = 0) =>
  typeof n === "number" ? n.toFixed(digits) : "—";
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const pct = (value: number, goal: number) =>
  goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
