import { type ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 pb-3 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--intel)]">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="mt-0.5 text-[17px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
