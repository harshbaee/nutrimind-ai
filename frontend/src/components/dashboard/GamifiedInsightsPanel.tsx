import type { ReactNode } from "react";
import { BadgeCheck, CalendarDays, Flame, Medal, Star, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGamification } from "@/hooks/useNutriQueries";
import { fmtDate, fmtNum } from "@/lib/format";
import { ErrorBanner } from "./ErrorBanner";

const severityClass: Record<string, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const levelClass: Record<string, string> = {
  bronze: "border-amber-200 bg-amber-50 text-amber-800",
  silver: "border-slate-200 bg-slate-50 text-slate-700",
  gold: "border-yellow-200 bg-yellow-50 text-yellow-800",
};

export function GamifiedInsightsPanel({ userId }: { userId?: number }) {
  const { data, isLoading, error } = useGamification(userId);
  const chartData = (data?.daily ?? []).slice(-14).map((day) => ({
    ...day,
    label: fmtDate(day.date),
  }));
  const earnedBadges = data?.badges.filter((badge) => badge.earned).length ?? 0;
  const levelProgress = data ? Math.min(100, Math.round((data.score / data.next_level_score) * 100)) : 0;

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-yellow-600" />
          Gamified insights
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
          <div className="py-8 text-center text-xs text-muted-foreground">No gamified data yet</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <MomentumStat
                label="Momentum score"
                value={fmtNum(data.score, 0)}
                sub={`${levelProgress}% to level ${data.level + 1}`}
                icon={<Star className="h-4 w-4" />}
                progress={levelProgress}
              />
              <MomentumStat
                label="Level"
                value={`${data.level}`}
                sub={`${fmtNum(data.next_level_score - data.score, 0)} points to next level`}
                icon={<Medal className="h-4 w-4" />}
              />
              <MomentumStat
                label="Current streak"
                value={`${data.current_logging_streak} d`}
                sub={`${data.best_logging_streak} day best streak`}
                icon={<Flame className="h-4 w-4" />}
              />
              <MomentumStat
                label="Badges earned"
                value={`${earnedBadges}/${data.badges.length}`}
                sub={`${data.logged_days} logged days`}
                icon={<BadgeCheck className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Daily momentum
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={32} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="score" fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                  Weekly challenges
                </div>
                <ul className="space-y-2">
                  {data.challenges.map((challenge) => {
                    const progress = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
                    return (
                      <li key={challenge.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{challenge.title}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">{challenge.description}</div>
                          </div>
                          <Badge variant="outline" className="shrink-0 border-yellow-200 bg-yellow-50 text-yellow-800">
                            +{challenge.reward_points}
                          </Badge>
                        </div>
                        <Progress value={progress} className="mt-2 h-1.5 [&>div]:bg-yellow-500" />
                        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {fmtNum(challenge.progress, 0)} / {fmtNum(challenge.target, 0)} {challenge.unit}
                          </span>
                          <span>Ends {fmtDate(challenge.expires_on)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-md border p-3">
                <div className="mb-2 text-sm font-semibold">Badges</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {data.badges.map((badge) => {
                    const progress = Math.min(100, Math.round((badge.progress / badge.target) * 100));
                    return (
                      <div key={badge.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{badge.title}</div>
                          <Badge
                            variant="outline"
                            className={levelClass[badge.level] ?? levelClass.silver}
                          >
                            {badge.earned ? "earned" : badge.level}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{badge.description}</div>
                        <Progress
                          value={progress}
                          className={`mt-2 h-1.5 ${badge.earned ? "[&>div]:bg-emerald-500" : "[&>div]:bg-yellow-500"}`}
                        />
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {fmtNum(badge.progress, 0)} / {fmtNum(badge.target, 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-2 text-sm font-semibold">Momentum insights</div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MomentumStat({
  label,
  value,
  sub,
  icon,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  progress?: number;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase text-muted-foreground">
        <span>{label}</span>
        <span className="text-yellow-600">{icon}</span>
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {typeof progress === "number" ? (
        <Progress value={progress} className="mt-2 h-1.5 [&>div]:bg-yellow-500" />
      ) : null}
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
