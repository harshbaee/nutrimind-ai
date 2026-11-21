import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import previewCss from "@/components/preview/preview.css?url";
import appCss from "@/components/app/app.css?url";
import { qk, useMe } from "@/hooks/useNutriQueries";
import { API_BASE_URL, LOGGED_OUT_EVENT, api, authToken, type AuthResponse } from "@/lib/api";
import { Today } from "@/components/app/Today";
import { Plan } from "@/components/app/Plan";
import { Pantry } from "@/components/app/Pantry";
import { Progress } from "@/components/app/Progress";
import { LogMeal } from "@/components/app/LogMeal";
import { Auth } from "@/components/app/Auth";

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
  const queryClient = useQueryClient();
  // undefined until the browser's stored login has been read (the server render can't see it)
  const [token, setToken] = useState<string | null>();
  const me = useMe(!!token);
  const user = me.data;
  const userId = user?.id;
  const [screen, setScreen] = useState<Screen>("today");
  const logDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setToken(authToken.get());
    const loggedOut = () => {
      queryClient.clear();
      setToken(null);
    };
    window.addEventListener(LOGGED_OUT_EVENT, loggedOut);
    return () => window.removeEventListener(LOGGED_OUT_EVENT, loggedOut);
  }, [queryClient]);
  const logIn = (auth: AuthResponse) => {
    authToken.set(auth.token);
    queryClient.setQueryData(qk.users, auth.user);
    setToken(auth.token);
  };
  const logOut = () => {
    api.logOut().catch(() => {}); // the login is dropped here either way
    authToken.set(null);
    queryClient.clear();
    setToken(null);
  };

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
  }, [screen, token, userId]);

  const openLog = () => logDialog.current?.showModal();

  return (
    <div className="np na">
      <Toaster closeButton position="top-right" />

      <header className="np-header">
        <Link className="np-mark" to="/preview" title="About NutriMind">NutriMind</Link>
        <nav className="np-tab" aria-label="Screens">
          {!user ? null : SCREENS.map((s) => (
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
        {user ? (
          <div className="na-right">
            <button type="button" className="na-profile" onClick={logOut} title={`Logged in as ${user.email}`}>
              {user.name} · Log out
            </button>
            <button type="button" className="np-btn" onClick={openLog}>Log a meal</button>
          </div>
        ) : null}
      </header>

      {me.error && !me.error.message.startsWith("401") ? (
        <div className="na-banner" role="alert">
          <span>Can't reach NutriMind's server at {API_BASE_URL}. Start the backend, then try again.</span>
          <button type="button" className="na-text-btn" onClick={() => queryClient.invalidateQueries()}>Try again</button>
        </div>
      ) : null}

      {token === null ? (
        <main>
          <Auth onLoggedIn={logIn} />
        </main>
      ) : user ? (
        <>
          <main>
            {screen === "today" ? <Today userId={userId} onLog={openLog} onSeeSwaps={() => goTo("plan")} /> : null}
            {screen === "plan" ? <Plan user={user} /> : null}
            {screen === "pantry" ? <Pantry userId={userId} /> : null}
            {screen === "progress" ? <Progress userId={userId} /> : null}
          </main>
          <LogMeal dialog={logDialog} userId={userId} />
        </>
      ) : null}
    </div>
  );
}
