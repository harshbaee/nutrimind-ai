import { useEffect, useState, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type User } from "@/lib/api";
import { qk, useRefreshUserData } from "@/hooks/useNutriQueries";

// Your account: goals and budget, password, and logging out.
export function Settings({ dialog, user, onLogOut }: { dialog: RefObject<HTMLDialogElement | null>; user: User; onLogOut: () => void }) {
  const queryClient = useQueryClient();
  const refresh = useRefreshUserData();
  const fromUser = () => ({
    name: user.name,
    calorie_goal: String(user.calorie_goal),
    protein_goal: String(user.protein_goal),
    budget_weekly: String(user.budget_weekly),
    dietary_preference: user.dietary_preference || "none",
  });
  const [goals, setGoals] = useState(fromUser);
  useEffect(() => setGoals(fromUser()), [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const goal = (key: keyof ReturnType<typeof fromUser>) => ({
    value: goals[key],
    onChange: (e: { target: { value: string } }) => setGoals((g) => ({ ...g, [key]: e.target.value })),
  });

  const saveGoals = useMutation({
    mutationFn: () =>
      api.updateUser(user.id, {
        name: goals.name.trim(),
        calorie_goal: Number(goals.calorie_goal),
        protein_goal: Number(goals.protein_goal),
        budget_weekly: Number(goals.budget_weekly),
        dietary_preference: goals.dietary_preference,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.users, updated);
      refresh(user.id); // every screen's figures are measured against these goals
      toast.success("Goals saved");
    },
    onError: (e: Error) => toast.error(`Couldn't save your goals. ${e.message}`),
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const changePassword = useMutation({
    mutationFn: () => api.changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      toast.success("Password changed. You've been logged out everywhere else.");
    },
  });
  const passwordError = changePassword.error?.message ?? "";

  return (
    <dialog ref={dialog} className="na-dialog" aria-labelledby="settings-title">
      <div className="na-dialog-head">
        <h2 id="settings-title" className="np-h2">Your account</h2>
        <button type="button" className="na-text-btn" onClick={() => dialog.current?.close()}>Close</button>
      </div>
      <p className="np-intro">Logged in as {user.email}.</p>

      <form
        className="na-form"
        aria-labelledby="goals-title"
        onSubmit={(e) => {
          e.preventDefault();
          saveGoals.mutate();
        }}
      >
        <h3 id="goals-title">Goals and budget</h3>
        <label>
          Name
          <input className="na-input" required maxLength={100} autoComplete="name" {...goal("name")} />
        </label>
        <div className="na-row">
          <label>
            Calories a day
            <input className="na-input num" type="number" required min={1} max={10000} {...goal("calorie_goal")} />
          </label>
          <label>
            Protein a day (g)
            <input className="na-input num" type="number" required min={0} max={1000} {...goal("protein_goal")} />
          </label>
        </div>
        <label>
          Food budget a week (€)
          <input className="na-input num" type="number" required min={0} step="0.01" {...goal("budget_weekly")} />
        </label>
        <label>
          Diet
          <select className="na-input" {...goal("dietary_preference")}>
            <option value="none">No preference</option>
            <option value="high-protein">High protein</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
          </select>
        </label>
        <button type="submit" className="na-ink-btn" disabled={saveGoals.isPending}>
          {saveGoals.isPending ? "Saving…" : "Save goals"}
        </button>
      </form>

      <form
        className="na-form na-sub"
        aria-labelledby="password-title"
        onSubmit={(e) => {
          e.preventDefault();
          changePassword.mutate();
        }}
      >
        <h3 id="password-title">Password</h3>
        {/* Lets password managers tie the new password to this account */}
        <input type="email" value={user.email} autoComplete="username" readOnly hidden />
        <label>
          Current password
          <input className="na-input" type="password" required maxLength={128} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label>
          New password (at least 8 characters)
          <input className="na-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        {passwordError ? (
          <p role="alert">
            {passwordError.startsWith("400")
              ? "Your current password isn't right."
              : passwordError.startsWith("429")
                ? "Too many wrong passwords. Wait 15 minutes, then try again."
                : `Couldn't change your password. ${passwordError}`}
          </p>
        ) : null}
        <button type="submit" className="na-ink-btn" disabled={changePassword.isPending}>
          {changePassword.isPending ? "Changing…" : "Change password"}
        </button>
      </form>

      <p className="na-sub">
        <button type="button" className="na-text-btn" onClick={onLogOut}>Log out</button>
      </p>
    </dialog>
  );
}
