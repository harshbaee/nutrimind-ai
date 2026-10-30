import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { type User } from "@/lib/api";
import { fmtEur } from "@/lib/format";

export function UserSelector({
  users,
  activeId,
  onChange,
  isLoading,
  compact = false,
}: {
  users?: User[];
  activeId?: number;
  onChange: (id: number) => void;
  isLoading: boolean;
  compact?: boolean;
}) {
  const active = users?.find((u) => u.id === activeId);
  const initial = active?.name?.[0]?.toUpperCase() ?? "?";

  if (compact) {
    return (
      <div className="glass inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, var(--health), var(--intel))" }}
        >
          {initial}
        </div>
        <Select
          value={activeId ? String(activeId) : undefined}
          onValueChange={(v) => onChange(parseInt(v, 10))}
          disabled={isLoading || !users?.length}
        >
          <SelectTrigger className="h-7 w-[150px] border-0 bg-transparent px-1 text-[12px] font-medium shadow-none focus:ring-0 sm:w-[180px]">
            <SelectValue placeholder={isLoading ? "Loading..." : "Select profile"} />
          </SelectTrigger>
          <SelectContent>
            {users?.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-semibold text-white shadow-md"
          style={{ background: "linear-gradient(135deg, var(--health), var(--intel))" }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active profile
          </div>
          <Select
            value={activeId ? String(activeId) : undefined}
            onValueChange={(v) => onChange(parseInt(v, 10))}
            disabled={isLoading || !users?.length}
          >
            <SelectTrigger className="h-8 w-[230px] max-w-full border-0 bg-transparent px-0 text-[14px] font-semibold shadow-none focus:ring-0">
              <SelectValue placeholder={isLoading ? "Loading users..." : "Select user"} />
            </SelectTrigger>
            <SelectContent>
              {users?.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name} - {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {active ? (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="rounded-full bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] font-normal">
            {active.calorie_goal} kcal goal
          </Badge>
          <Badge variant="secondary" className="rounded-full bg-health-soft font-normal text-[color:var(--health)]">
            {active.protein_goal} g protein
          </Badge>
          <Badge variant="secondary" className="rounded-full bg-cost-soft font-normal text-[color:var(--cost)]">
            {fmtEur(active.budget_weekly)} / week
          </Badge>
          {active.dietary_preference ? (
            <Badge variant="outline" className="rounded-full font-normal">
              {active.dietary_preference}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
