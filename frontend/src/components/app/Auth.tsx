import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, type AuthResponse } from "@/lib/api";
import { Section } from "./parts";

const START = { name: "", email: "", password: "", calorie_goal: "2000", protein_goal: "150", budget_weekly: "50", dietary_preference: "none" };

// Shown until someone logs in: log in, or create an account with its own goals and budget.
export function Auth({ onLoggedIn }: { onLoggedIn: (auth: AuthResponse) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState(START);
  const field = (key: keyof typeof START) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const submit = useMutation({
    mutationFn: () =>
      mode === "login"
        ? api.logIn({ email: form.email, password: form.password })
        : api.signUp({
            name: form.name.trim(),
            email: form.email,
            password: form.password,
            calorie_goal: Number(form.calorie_goal),
            protein_goal: Number(form.protein_goal),
            budget_weekly: Number(form.budget_weekly),
            dietary_preference: form.dietary_preference,
          }),
    onSuccess: onLoggedIn,
  });
  const error = submit.error?.message ?? "";
  const message = error.startsWith("401")
    ? "Wrong email or password."
    : error.startsWith("409")
      ? "That email already has an account. Log in instead."
      : error.startsWith("429")
        ? "Too many wrong passwords. Wait 15 minutes, then try again."
        : error
          ? `Something went wrong. ${error}`
          : "";
  const switchTo = (next: "login" | "signup") => {
    submit.reset();
    setMode(next);
  };

  return (
    <Section
      page
      title={mode === "login" ? "Log in" : "Create your account"}
      intro={
        mode === "login"
          ? "Your meals, pantry and progress, kept to your own account."
          : "Each account keeps its own meals, goals and budget."
      }
      side={
        <form
          className="na-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          {mode === "signup" ? (
            <label>
              Name
              <input className="na-input" required maxLength={100} autoComplete="name" {...field("name")} />
            </label>
          ) : null}
          <label>
            Email
            <input className="na-input" type="email" required maxLength={150} autoComplete="email" {...field("email")} />
          </label>
          <label>
            Password{mode === "signup" ? " (at least 8 characters)" : ""}
            <input
              className="na-input"
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              maxLength={128}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              {...field("password")}
            />
          </label>
          {mode === "signup" ? (
            <>
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
            </>
          ) : null}
          {message ? <p role="alert">{message}</p> : null}
          <button type="submit" className="np-btn" disabled={submit.isPending}>
            {submit.isPending ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      }
    >
      <p className="np-note">
        {mode === "login" ? (
          <>
            New here? <button type="button" className="na-text-btn" onClick={() => switchTo("signup")}>Create an account</button>
          </>
        ) : (
          <>
            Already have an account? <button type="button" className="na-text-btn" onClick={() => switchTo("login")}>Log in</button>
          </>
        )}
      </p>
    </Section>
  );
}
