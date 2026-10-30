import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpending } from "@/hooks/useNutriQueries";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDate } from "@/lib/format";
import { ErrorBanner } from "./ErrorBanner";

export function SpendingProteinCharts({ userId }: { userId?: number }) {
  const { data, isLoading, error } = useSpending(userId);
  const history = (data?.history ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const formatted = history.map((d) => ({ ...d, label: fmtDate(d.date) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Spending over time</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorBanner error={error} />
          ) : isLoading ? (
            <ChartSkeleton />
          ) : formatted.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={formatted} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
                <Tooltip
                  formatter={(v: number) => [`€${v.toFixed(2)}`, "Spent"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="spent"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#spendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Protein over time</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorBanner error={error} />
          ) : isLoading ? (
            <ChartSkeleton />
          ) : formatted.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formatted} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)} g`, "Protein"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="protein"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[220px] animate-pulse rounded-md bg-muted" />;
}
function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
      No data yet
    </div>
  );
}
