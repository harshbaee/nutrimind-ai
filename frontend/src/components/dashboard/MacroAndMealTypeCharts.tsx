import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDaily, useMealTypes } from "@/hooks/useNutriQueries";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorBanner } from "./ErrorBanner";

const MACRO_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];
const TYPE_COLORS = ["#10b981", "#3b82f6", "#f97316", "#a855f7", "#ec4899"];

export function MacroAndMealTypeCharts({ userId }: { userId?: number }) {
  const { data: daily, isLoading: dl, error: de } = useDaily(userId);
  const { data: mealTypesRaw, isLoading: ml, error: me } = useMealTypes(userId);

  const macros = daily
    ? [
        { name: "Protein", value: daily.total_protein },
        { name: "Carbs", value: daily.total_carbs },
        { name: "Fat", value: daily.total_fat },
      ].filter((m) => m.value > 0)
    : [];

  const mealTypeList = Array.isArray(mealTypesRaw)
    ? mealTypesRaw
    : (mealTypesRaw as any)?.breakdown ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Today's macros (g)</CardTitle>
        </CardHeader>
        <CardContent>
          {de ? (
            <ErrorBanner error={de} />
          ) : dl ? (
            <Skeleton />
          ) : macros.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={macros}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {macros.map((_, i) => (
                    <Cell key={i} fill={MACRO_COLORS[i % MACRO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n) => [`${v.toFixed(1)} g`, n as string]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {macros.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {macros.map((m, i) => (
                <span key={m.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: MACRO_COLORS[i] }}
                  />
                  {m.name} · {m.value.toFixed(1)}g
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Meal types</CardTitle>
        </CardHeader>
        <CardContent>
          {me ? (
            <ErrorBanner error={me} />
          ) : ml ? (
            <Skeleton />
          ) : mealTypeList.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mealTypeList} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="meal_type" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={32} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {mealTypeList.map((_: any, i: number) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Skeleton() {
  return <div className="h-[220px] animate-pulse rounded-md bg-muted" />;
}
function Empty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
      No data yet
    </div>
  );
}
