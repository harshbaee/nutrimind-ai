import { useState, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type User } from "@/lib/api";
import { qk } from "@/hooks/useNutriQueries";

const START = { name: "", email: "", calorie_goal: "2000", protein_goal: "150", budget_weekly: "50", dietary_preference: "none" };

// Sign-up for another person on this device: a profile with its own goals, budget and meals.
// shortcut: no password or login, anyone using the app can switch profiles; add auth before hosting it for strangers.
export function SignUp({ dialog, onCreated }: { dialog: RefObject<HTMLDialogElement | null>; onCreated: (user: User) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(START);
  const field = (key: keyof typeof START) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        calorie_goal: Number(form.calorie_goal),
        protein_goal: Number(form.protein_goal),
        budget_weekly: Number(form.budget_weekly),
        dietary_preference: form.dietary_preference,
      }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: qk.users });
      toast.success(`Welcome, ${user.name}. Log your first meal to get started.`);
      setForm(START);
      onCreated(user);
      dialog.current?.close();
    },
    onError: (e: Error) =>
      toast.error(e.message.startsWith("409") ? "That email already has a profile. Pick it from the profile list." : `Couldn't create the profile. ${e.message}`),
  });

  return (
    <dialog ref={dialog} className="na-dialog" aria-labelledby="signup-title">
      <div className="na-dialog-head">
        <h2 id="signup-title" className="np-h2">New profile</h2>
        <button type="button" className="na-text-btn" onClick={() => dialog.current?.close()}>Close</button>
      </div>
      <p className="np-intro">Each profile keeps its own meals, goals and budget.</p>

      <form
        className="na-form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label>
          Name
          <input className="na-input" required maxLength={100} autoComplete="name" {...field("name")} />
        </label>
        <label>
          Email
          <input className="na-input" type="email" required maxLength={150} autoComplete="email" {...field("email")} />
        </label>
        <div className="na-row">
          <label>
            Calories a day
            <input className="na-input num" type="number" required min={1} max={10000} {...field("calorie_goal")} />
          </label>
          <label>
            Protein a day (g)
            <input className="na-input num" type="number" required min={0} max={1000} {...field("protein_goal")} />
          </label>
        </div>
        <label>
          Food budget a week (€)
          <input className="na-input num" type="number" required min={0} step="0.01" {...field("budget_weekly")} />
        </label>
        <label>
          Diet
          <select className="na-input" {...field("dietary_preference")}>
            <option value="none">No preference</option>
            <option value="high-protein">High protein</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
          </select>
        </label>
        <button type="submit" className="np-btn" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create profile"}
        </button>
      </form>
    </dialog>
  );
}
