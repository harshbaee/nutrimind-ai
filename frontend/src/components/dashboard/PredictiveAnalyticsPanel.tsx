import type { ReactNode } from "react";
import { AlertTriangle, BrainCircuit, Gauge, LineChart as LineChartIcon, Target, Wallet } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePredictive } from "@/hooks/useNutriQueries";
import { fmtDate, fmtEur, fmtNum } from "@/lib/format";
import { ErrorBanner } from "./ErrorBanner";

const severityClass: Record<string, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

export function PredictiveAnalyticsPanel({ userId }: { userId?: number }) {
  const { data, isLoading, error } = usePredictive(userId);
  const chartData = (data?.forecast ?? []).map((point) => ({
    ...point,
    label: fmtDate(point.date),
  }));
  const loggedDays =
    data?.daily.filter((point) => point.calories > 0 || point.protein > 0 || point.cost_eur > 0).length ?? 0;
  const confidence = data ? Math.min(100, Math.round((loggedDays / 14) * 100)) : 0;

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-4 w-4 text-indigo-600" />
          Predictive analytics
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
          <div className="py-8 text-center text-xs text-muted-foreground">No predictive data yet</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <ForecastStat
                label="Forecast weekly cost"
                value={fmtEur(data.predicted_weekly_cost_eur)}
                sub={`${data.horizon_days}-day horizon`}
                icon={<Wallet className="h-4 w-4" />}
              />
              <ForecastStat
                label="Forecast weekly protein"
                value={`${fmtNum(data.predicted_weekly_protein, 0)} g`}
                sub="Projected from logged meals"
                icon={<Target className="h-4 w-4" />}
              />
              <ForecastStat
                label="Avg daily calories"
                value={`${fmtNum(data.predicted_avg_daily_calories, 0)} kcal`}
                sub="Next forecast window"
                icon={<LineChartIcon className="h-4 w-4" />}
              />
              <div className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase text-muted-foreground">
                  <span>Forecast confidence</span>
                  <Gauge className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="mt-1 text-lg font-semibold">{confidence}%</div>
                <Progress value={confidence} className="mt-2 h-1.5 [&>div]:bg-indigo-500" />
                <div className="mt-1 text-[11px] text-muted-foreground">{loggedDays} logged days in range</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <RiskBadge active={data.budget_risk} activeLabel="Budget risk" quietLabel="Budget stable" />
              <RiskBadge active={data.protein_goal_risk} activeLabel="Protein risk" quietLabel="Protein stable" />
              <RiskBadge active={data.calorie_goal_risk} activeLabel="Calorie risk" quietLabel="Calories stable" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Seven-day forecast
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis yAxisId="nutrition" tick={{ fontSize: 11 }} stroke="#94a3b8" width={42} />
                    <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" width={32} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar yAxisId="cost" dataKey="cost_eur" name="Cost EUR" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="nutrition"
                      type="monotone"
                      dataKey="calories"
                      name="Calories"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="nutrition"
                      type="monotone"
                      dataKey="protein"
                      name="Protein"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-3">
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Anomaly detection
                  </div>
                  {data.anomalies.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      No unusual signals detected
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {data.anomalies.slice(0, 4).map((anomaly, index) => (
                        <li key={`${anomaly.metric}-${anomaly.date}-${index}`} className="rounded-md border px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={`h-5 px-1.5 text-[10px] uppercase ${
                                severityClass[anomaly.severity] ?? severityClass.info
                              }`}
                            >
                              {anomaly.metric}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{fmtDate(anomaly.date)}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5">{anomaly.message}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtNum(anomaly.value, 1)} vs expected {fmtNum(anomaly.expected_value, 1)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 text-sm font-semibold">Forecast insights</div>
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

function ForecastStat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase text-muted-foreground">
        <span>{label}</span>
        <span className="text-indigo-600">{icon}</span>
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function RiskBadge({
  active,
  activeLabel,
  quietLabel,
}: {
  active: boolean;
  activeLabel: string;
  quietLabel: string;
}) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }
    >
      {active ? activeLabel : quietLabel}
    </Badge>
  );
}
