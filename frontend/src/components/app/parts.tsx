import type { CSSProperties, ReactNode } from "react";
import { fmtEur } from "@/lib/format";

export const round = (n: number) => Math.round(n).toLocaleString("en-GB");
export const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long" });
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// One section in the preview page's layout: a side column left of the 42% axis, heading and content on it.
export function Section({
  ground = "",
  page,
  title,
  intro,
  side,
  children,
}: {
  ground?: string;
  page?: boolean; // the first section of a screen carries the page title
  title: string;
  intro?: ReactNode;
  side: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`np-layout ${ground}`}>
      <div className="np-head" data-reveal>
        {page ? <h1 className="np-h2">{title}</h1> : <h2 className="np-h2">{title}</h2>}
        {intro ? <p className="np-intro">{intro}</p> : null}
      </div>
      <div className="np-side" data-reveal style={{ "--d": "80ms" } as CSSProperties}>{side}</div>
      <div className="np-body" data-reveal style={{ "--d": "160ms" } as CSSProperties}>{children}</div>
    </section>
  );
}

// A paper receipt: lines of name, quantity, amount; a dashed total; a note underneath.
export function Receipt({
  title,
  lines,
  empty,
  total,
  note,
}: {
  title: string;
  lines: { key: string | number; name: ReactNode; qty: string; amount?: number | null }[];
  empty: ReactNode;
  total?: number;
  note?: ReactNode;
}) {
  return (
    <div className="np-paper" data-ui>
      <h3>{title}</h3>
      {lines.length === 0 ? (
        <p className="na-empty">{empty}</p>
      ) : (
        <ul className="np-rlines">
          {lines.map((l) => (
            <li key={l.key} className="np-rline">
              <span>{l.name}</span>
              <span className="num">{l.qty}</span>
              <span className="num">{fmtEur(l.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="np-total">
        <span>Total</span>
        <span className="num">{fmtEur(total ?? lines.reduce((s, l) => s + (l.amount ?? 0), 0))}</span>
      </div>
      {note ? <div className="np-rmeta num">{note}</div> : null}
    </div>
  );
}

export function Meter({ label, value, goal, text }: { label: string; value: number; goal?: number; text: string }) {
  const share = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <li>
      <div className="na-meter-top">
        <span>{label}</span>
        <span className="num">{text}</span>
      </div>
      <div className="na-track" role="progressbar" aria-label={label} aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}

// A column per day against a target line. Coral columns missed the target; the value shows on hover, focus or tap.
export function Columns({
  rows,
  target,
  targetText,
  good,
  missText,
}: {
  rows: { key: string; label: string; value: number; text: string }[];
  target?: number;
  targetText?: string;
  good: "under" | "over"; // which side of the target line is a good day
  missText: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), target ?? 0, 1);
  const missed = (v: number) => target !== undefined && (good === "under" ? v > target : v < target);
  if (rows.length === 0) return <p className="na-empty">Nothing logged yet.</p>;
  return (
    <div className="na-chart num">
      <ol className="na-columns">
        {rows.map((r, i) => (
          <li key={r.key} tabIndex={0} className={missed(r.value) ? "is-miss" : undefined} aria-label={`${r.label}: ${r.text}${missed(r.value) ? `, ${missText}` : ""}`}>
            <span className="na-plot">
              <span className="na-col" style={{ height: `${(r.value / max) * 100}%`, "--i": i } as CSSProperties}>
                <span className="na-val">{r.text}</span>
              </span>
            </span>
            <span className="na-x" aria-hidden>{r.label}</span>
          </li>
        ))}
      </ol>
      {target !== undefined ? (
        <span className="na-target" style={{ "--at": target / max } as CSSProperties}>
          <span>{targetText}</span>
        </span>
      ) : null}
    </div>
  );
}

// One bar split into shares, with a legend that carries the figures.
export function Stack({ label, parts }: { label: string; parts: { name: string; value: number; text: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <div className="na-stack-wrap">
      <p className="na-stack-title">{label}</p>
      <div className="na-stack" aria-hidden>
        {parts.map((p) => <span key={p.name} style={{ flexGrow: p.value }} />)}
      </div>
      <ul className="na-legend num">
        {parts.map((p) => (
          <li key={p.name}>
            <i aria-hidden />
            {p.name} {Math.round((p.value / total) * 100)}% <small>{p.text}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
