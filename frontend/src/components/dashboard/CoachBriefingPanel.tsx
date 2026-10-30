import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, MessageSquare, Send, ShieldAlert, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api, type CoachAction, type CoachAnswer } from "@/lib/api";
import { useCoachBriefing } from "@/hooks/useNutriQueries";
import { ErrorBanner } from "./ErrorBanner";

const statusClass: Record<string, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const categoryClass: Record<string, string> = {
  nutrition: "border-emerald-200 bg-emerald-50 text-emerald-700",
  budget: "border-orange-200 bg-orange-50 text-orange-700",
  behaviour: "border-blue-200 bg-blue-50 text-blue-700",
  engagement: "border-yellow-200 bg-yellow-50 text-yellow-800",
  recommendation: "border-purple-200 bg-purple-50 text-purple-700",
};

export function CoachBriefingPanel({ userId }: { userId?: number }) {
  const { data, isLoading, error } = useCoachBriefing(userId);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);

  const ask = useMutation({
    mutationFn: (prompt: string) => api.askCoach({ user_id: userId!, question: prompt }),
    onSuccess: (response) => {
      setAnswer(response);
      setQuestion("");
    },
    onError: (e: Error) => toast.error(`Coach question failed: ${e.message}`),
  });

  return (
    <Card className="rounded-md border-emerald-200 bg-white">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-emerald-600" />
            AI coach briefing
          </CardTitle>
          {data ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Focus: {data.focus_area}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <ErrorBanner error={error} /> : null}
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No coach briefing yet</div>
        ) : (
          <>
            <div className="rounded-md border bg-emerald-50/40 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    {data.headline}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    {data.data_quality_notes[0]}
                  </div>
                </div>
                <div className="min-w-[150px] rounded-md border bg-white px-3 py-2">
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">Readiness</div>
                  <div className="mt-1 text-xl font-semibold">{data.readiness_score}%</div>
                  <Progress value={data.readiness_score} className="mt-2 h-1.5 [&>div]:bg-emerald-500" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {data.summary_cards.map((card) => (
                <div key={card.label} className="rounded-md border px-3 py-2">
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">{card.label}</div>
                  <div className="mt-1 text-base font-semibold">{card.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{card.detail}</div>
                  <Badge
                    variant="outline"
                    className={`mt-2 h-5 px-1.5 text-[10px] uppercase ${
                      statusClass[card.status] ?? statusClass.info
                    }`}
                  >
                    {card.status}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-emerald-600" />
                  Action plan
                </div>
                <ul className="space-y-2">
                  {data.action_plan.map((action, index) => (
                    <ActionRow key={`${action.title}-${index}`} action={action} />
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    Risk flags
                  </div>
                  <ul className="space-y-2">
                    {data.risk_flags.map((risk, index) => (
                      <li key={`${risk.type}-${index}`} className="rounded-md border px-3 py-2">
                        <Badge
                          variant="outline"
                          className={`mb-1 h-5 px-1.5 text-[10px] uppercase ${
                            statusClass[risk.severity] ?? statusClass.info
                          }`}
                        >
                          {risk.severity}
                        </Badge>
                        <p className="text-xs leading-5">{risk.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    Coach question
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={question}
                      placeholder="Budget, protein, or momentum"
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && question.trim() && userId && !ask.isPending) {
                          ask.mutate(question.trim());
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!userId || !question.trim() || ask.isPending}
                      onClick={() => ask.mutate(question.trim())}
                    >
                      {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {answer ? (
                    <div className="mt-3 rounded-md border bg-blue-50/40 px-3 py-2">
                      <p className="text-xs leading-5">{answer.answer}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {answer.sources.map((source) => (
                          <Badge key={source} variant="outline" className="border-blue-200 bg-white text-blue-700">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.talking_points.slice(0, 3).map((point) => (
                        <Button
                          key={point}
                          variant="outline"
                          size="sm"
                          className="h-auto min-h-8 justify-start whitespace-normal px-2 py-1 text-left text-xs"
                          disabled={!userId || ask.isPending}
                          onClick={() => {
                            setQuestion(point);
                            ask.mutate(point);
                          }}
                        >
                          {point}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActionRow({ action }: { action: CoachAction }) {
  return (
    <li className="rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{action.title}</div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`h-5 px-1.5 text-[10px] uppercase ${
              categoryClass[action.category] ?? categoryClass.recommendation
            }`}
          >
            {action.category}
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
            P{action.priority}
          </Badge>
        </div>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.rationale}</p>
      <p className="mt-1 text-xs leading-5">{action.impact}</p>
    </li>
  );
}
