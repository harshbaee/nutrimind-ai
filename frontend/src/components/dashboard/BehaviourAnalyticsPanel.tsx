import type { ReactNode } from "react";
import { Activity, AlertTriangle, CalendarCheck, Moon, Target, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBehaviour } from "@/hooks/useNutriQueries";
import { fmtDate, fmtEur, fmtNum } from "@/lib/format";
import { ErrorBanner } from "./ErrorBanner";

const severityClass: Record<string, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

export function BehaviourAnalyticsPanel({ userId }: { userId?: number }) {
  const { data, isLoading, error } = useBehaviour(userId);
  const trend = (data?.daily ?? []).slice(-14).map((day) => ({
    ...day,
    label: fmtDate(day.date),
  }));

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-emerald-600" />
          Behavioural analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <ErrorBanner error={error} /> : null}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No behavioural data yet</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <ScoreCard
                label="Overall adherence"
                value={data.overall_adherence_score}
                sub={`${data.days_logged}/${data.days_considered} days logged`}
                icon={<Target className="h-4 w-4" />}
              />
              <ScoreCard
                label="Meal consistency"
                value={data.meal_consistency_score}
                sub={`${data.meal_count} meals tracked`}
                icon={<CalendarCheck className="h-4 w-4" />}
              />
              <ScoreCard
                label="Protein adherence"
                value={data.protein_adherence_score}
                sub={`${fmtNum(data.avg_protein_logged_day, 1)}g avg logged day`}
                icon={<Activity className="h-4 w-4" />}
              />
              <ScoreCard
                label="Budget adherence"
                value={data.budget_adherence_score}
                sub={`${fmtEur(data.avg_cost_logged_day)} avg logged day`}
                icon={<Wallet className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    Calories and protein
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={42} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Line type="monotone" dataKey="calories" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="protein" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    Meal frequency
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={32} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Bar dataKey="meal_count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <PatternStat label="Low protein days" value={data.low_protein_days} />
                  <PatternStat label="Calorie spikes" value={data.calorie_spike_days} />
                  <PatternStat label="Overspending days" value={data.overspending_days} />
                  <PatternStat
                    label="Late meals"
                    value={data.late_night_meal_count}
                    icon={<Moon className="h-3.5 w-3.5" />}
                  />
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Pattern insights
                  </div>
                  <ul className="space-y-2">
                    {data.insights.map((insight, index) => (
                      <li key={`${insight.type}-${index}`} className="rounded-md border px-3 py-2">
                        <Badge
                          variant="outline"
                          className={`mb-1 h-5 px-1.5 text-[10px] uppercase ${
                            severityClass[insight.severity] ?? severityClass.info
                          }`}
                        >
                          {insight.severity}
                        </Badge>
                        <p className="text-xs leading-5">{insight.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase text-muted-foreground">
        <span>{label}</span>
        <span className="text-emerald-600">{icon}</span>
      </div>
      <div className="mt-1 text-lg font-semibold">{fmtNum(value, 0)}%</div>
      <Progress value={value} className="mt-2 h-1.5 [&>div]:bg-emerald-500" />
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function PatternStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
