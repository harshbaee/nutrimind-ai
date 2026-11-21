import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const qk = {
  users: ["users"] as const,
  daily: (uid: number) => ["daily", uid] as const,
  weekly: (uid: number) => ["weekly", uid] as const,
  spending: (uid: number) => ["spending", uid] as const,
  mealTypes: (uid: number) => ["mealTypes", uid] as const,
  saved: ["saved"] as const,
  history: (uid: number) => ["history", uid] as const,
  rankings: ["rankings"] as const,
  recommendations: (uid: number) => ["recommendations", uid] as const,
  behaviour: (uid: number) => ["behaviour", uid] as const,
  predictive: (uid: number) => ["predictive", uid] as const,
  gamification: (uid: number) => ["gamification", uid] as const,
  coach: (uid: number) => ["coach", uid] as const,
  shopping: (uid: number) => ["shopping", uid] as const,
};

export function useUsers() {
  return useQuery({ queryKey: qk.users, queryFn: api.listUsers });
}
export function useDaily(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.daily(uid) : ["daily", "none"],
    queryFn: () => api.dailySummary(uid!),
    enabled: !!uid,
  });
}
export function useWeekly(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.weekly(uid) : ["weekly", "none"],
    queryFn: () => api.weeklySummary(uid!),
    enabled: !!uid,
  });
}
export function useSpending(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.spending(uid) : ["spending", "none"],
    queryFn: () => api.spending(uid!),
    enabled: !!uid,
  });
}
export function useMealTypes(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.mealTypes(uid) : ["mealTypes", "none"],
    queryFn: () => api.mealTypes(uid!),
    enabled: !!uid,
  });
}
export function useSaved() {
  return useQuery({ queryKey: qk.saved, queryFn: api.savedProducts });
}
export function useHistory(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.history(uid) : ["history", "none"],
    queryFn: () => api.mealHistory(uid!),
    enabled: !!uid,
  });
}
export function useRankings() {
  return useQuery({ queryKey: qk.rankings, queryFn: api.rankings });
}
export function useRecommendations(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.recommendations(uid) : ["recommendations", "none"],
    queryFn: () => api.recommendations(uid!),
    enabled: !!uid,
  });
}
export function useBehaviour(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.behaviour(uid) : ["behaviour", "none"],
    queryFn: () => api.behaviour(uid!),
    enabled: !!uid,
  });
}
export function usePredictive(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.predictive(uid) : ["predictive", "none"],
    queryFn: () => api.predictive(uid!),
    enabled: !!uid,
  });
}
export function useGamification(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.gamification(uid) : ["gamification", "none"],
    queryFn: () => api.gamification(uid!),
    enabled: !!uid,
  });
}
export function useCoachBriefing(uid?: number) {
  return useQuery({
    queryKey: uid ? qk.coach(uid) : ["coach", "none"],
    queryFn: () => api.coachBriefing(uid!),
    enabled: !!uid,
  });
}

export function useShoppingList(uid?: number) {
  return useQuery({ queryKey: qk.shopping(uid!), queryFn: () => api.shoppingList(uid!), enabled: !!uid });
}

export function useRefreshUserData() {
  const qc = useQueryClient();
  return (uid?: number) => {
    if (uid) {
      qc.invalidateQueries({ queryKey: qk.daily(uid) });
      qc.invalidateQueries({ queryKey: qk.weekly(uid) });
      qc.invalidateQueries({ queryKey: qk.spending(uid) });
      qc.invalidateQueries({ queryKey: qk.mealTypes(uid) });
      qc.invalidateQueries({ queryKey: qk.history(uid) });
      qc.invalidateQueries({ queryKey: qk.recommendations(uid) });
      qc.invalidateQueries({ queryKey: qk.behaviour(uid) });
      qc.invalidateQueries({ queryKey: qk.predictive(uid) });
      qc.invalidateQueries({ queryKey: qk.gamification(uid) });
      qc.invalidateQueries({ queryKey: qk.coach(uid) });
      qc.invalidateQueries({ queryKey: qk.shopping(uid) });
    }
    qc.invalidateQueries({ queryKey: qk.saved });
    qc.invalidateQueries({ queryKey: qk.rankings });
  };
}

export { useMutation };
