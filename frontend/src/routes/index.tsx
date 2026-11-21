import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import previewCss from "@/components/preview/preview.css?url";
import appCss from "@/components/app/app.css?url";
import { useUsers } from "@/hooks/useNutriQueries";
import { API_BASE_URL } from "@/lib/api";
import { Today } from "@/components/app/Today";
import { Plan } from "@/components/app/Plan";
import { Pantry } from "@/components/app/Pantry";
import { Progress } from "@/components/app/Progress";
import { LogMeal } from "@/components/app/LogMeal";

export const Route = createFileRoute("/")({
  head: () => ({
    // The app wears the preview page's stylesheet; app.css only adds to it.
    links: [
      { rel: "stylesheet", href: previewCss },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        // Same as the preview page: hidden start states before first paint, dropped again if the app never starts.
        children:
          "document.documentElement.classList.add('np-js');setTimeout(function(){if(!window.__npReady)document.documentElement.classList.remove('np-js')},4000);",
      },
    ],
  }),
  component: App,
});

const SCREENS = [
  { key: "today", label: "Today" },
  { key: "plan", label: "Plan" },
  { key: "pantry", label: "Pantry" },
  { key: "progress", label: "Progress" },
] as const;
type Screen = (typeof SCREENS)[number]["key"];

function App() {
  const users = useUsers();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<number>();
  const [screen, setScreen] = useState<Screen>("today");
  const logDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!userId && users.data?.length) setUserId(users.data[0].id);
  }, [users.data, userId]);

  // The open screen lives in the address (?screen=plan), so it can be linked to and survives a reload.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("screen");
    if (SCREENS.some((x) => x.key === s)) setScreen(s as Screen);
  }, []);
  const goTo = (next: Screen) => {
    setScreen(next);
    const url = new URL(window.location.href);
    if (next === "today") url.searchParams.delete("screen");
    else url.searchParams.set("screen", next);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  // The preview page's scroll motion: its stylesheet animates [data-reveal] while .is-in is set, and replays on re-entry.
  useEffect(() => {
    (window as unknown as { __npReady: boolean }).__npReady = true;
    document.documentElement.classList.add("np-js");
    const enter = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-in")),
      { rootMargin: "0px 0px -8% 0px" },
    );
    const leave = new IntersectionObserver((entries) =>
      entries.forEach((e) => !e.isIntersecting && e.target.classList.remove("is-in")),
    );
    document.querySelectorAll(".na [data-reveal]").forEach((el) => {
      enter.observe(el);
      leave.observe(el);
    });
    return () => {
      enter.disconnect();
      leave.disconnect();
    };
  }, [screen]);

  const openLog = () => logDialog.current?.showModal();
  const user = users.data?.find((u) => u.id === userId);

  return (
    <div className="np na">
      <Toaster closeButton position="top-right" />

      <header className="np-header">
        <Link className="np-mark" to="/preview" title="About NutriMind">NutriMind</Link>
        <nav className="np-tab" aria-label="Screens">
          {SCREENS.map((s) => (
            <a
              key={s.key}
              className="np-link"
              href={s.key === "today" ? "/" : `/?screen=${s.key}`}
              aria-current={s.key === screen ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                goTo(s.key);
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="na-right">
          <select
            className="na-profile"
            aria-label="Profile"
            value={userId ?? ""}
            onChange={(e) => setUserId(Number(e.target.value))}
            disabled={!users.data?.length}
          >
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>) ?? <option value="">Loading…</option>}
          </select>
          <button type="button" className="np-btn" onClick={openLog}>Log a meal</button>
        </div>
      </header>

      {users.error ? (
        <div className="na-banner" role="alert">
          <span>Can't reach NutriMind's server at {API_BASE_URL}. Start the backend, then try again.</span>
          <button type="button" className="na-text-btn" onClick={() => queryClient.invalidateQueries()}>Try again</button>
        </div>
      ) : null}

      <main>
        {screen === "today" ? <Today userId={userId} onLog={openLog} onSeeSwaps={() => goTo("plan")} /> : null}
        {screen === "plan" ? <Plan user={user} /> : null}
        {screen === "pantry" ? <Pantry userId={userId} /> : null}
        {screen === "progress" ? <Progress userId={userId} /> : null}
      </main>

      <LogMeal dialog={logDialog} userId={userId} />
    </div>
  );
}
