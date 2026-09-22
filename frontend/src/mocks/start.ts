/**
 * Starts the mock mode (TB-046): `pnpm dev:mock` runs the frontend without an API or a database.
 *
 * Every `fetch` to `/api` is answered in the page from `routes.ts`; anything else goes to the network as usual. The
 * state is built when the page loads, so a reload is a fresh start. A small label in the corner says the page runs on
 * mock data, and lists every request the mock mode does not answer, because a screen may show such a failure only as
 * a generic error.
 *
 * Loaded only from `main.tsx` when Vite runs in mode `mock`; a production build drops the import with its condition.
 * The label is developer tooling that never ships, so it speaks English (Art. II.3) and stays out of `nl.json`.
 */
import { beantwoord } from "./routes";
import { beginToestand, katDeurmat } from "./toestand";

/** Where the app opens: the week of 16 november 2026, where the agenda is full. */
const STARTADRES = "/agenda/dag/2026-11-16?weergave=week";

const VERTRAGING_MS = 120;

function label(): { meld: (tekst: string) => void } {
  // Bottom right, and on a phone above the bottom navigation, so it covers no control the app draws there.
  const stijl = document.createElement("style");
  stijl.textContent =
    ".mockmodus-label{position:fixed;right:8px;bottom:8px;z-index:2147483647;" +
    "max-width:min(420px,calc(100vw - 16px));font:12px/1.4 system-ui,sans-serif;background:#1f2937;color:#fff;" +
    "border-radius:6px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,.3)}" +
    "@media (max-width:767px){.mockmodus-label{bottom:72px}}";
  document.head.append(stijl);
  const kader = document.createElement("div");
  kader.className = "mockmodus-label";
  kader.setAttribute("role", "status");
  const titel = document.createElement("strong");
  titel.textContent = "Mock mode: fixed fake data, a reload resets it";
  const lijst = document.createElement("ul");
  lijst.style.cssText = "margin:4px 0 0;padding-left:16px;max-height:30vh;overflow:auto";
  kader.append(titel, lijst);
  document.body.append(kader);

  const gemeld = new Set<string>();
  return {
    meld(tekst) {
      if (gemeld.has(tekst)) return;
      gemeld.add(tekst);
      const regel = document.createElement("li");
      regel.textContent = `Not mocked: ${tekst}`;
      lijst.append(regel);
    },
  };
}

async function leesBody(invoer: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const ruw = init?.body ?? (invoer instanceof Request ? await invoer.clone().text() : undefined);
  if (typeof ruw !== "string" || ruw.length === 0) return undefined;
  try {
    return JSON.parse(ruw);
  } catch {
    return undefined;
  }
}

export function startMock(): void {
  const toestand = beginToestand();
  // Chuck's posture survives a reload, so each of the four can be looked at (FB-071): set it with
  // localStorage.setItem("mockmodus-kat", "niets" | "klaar" | "gevaar" | "spint").
  const katHouding = (() => {
    try {
      return localStorage.getItem("mockmodus-kat");
    } catch {
      return null;
    }
  })();
  if (katHouding === "niets" || katHouding === "klaar" || katHouding === "gevaar" || katHouding === "spint") {
    toestand.kat = { isZichtbaar: true, houding: katHouding, deurmat: katDeurmat(katHouding) };
  }
  const melding = label();
  const echteFetch = window.fetch.bind(window);

  window.fetch = async (invoer, init) => {
    const adres = new URL(invoer instanceof Request ? invoer.url : String(invoer), window.location.origin);
    if (adres.origin !== window.location.origin || !adres.pathname.startsWith("/api/")) {
      return echteFetch(invoer, init);
    }
    const methode = (init?.method ?? (invoer instanceof Request ? invoer.method : "GET")).toUpperCase();
    const body = await leesBody(invoer, init);
    const antwoord = beantwoord(toestand, methode, adres, body);
    if (antwoord.status === 501) melding.meld(`${methode} ${adres.pathname}`);
    // A short delay, so loading states show as they would against a real server.
    await new Promise((klaar) => setTimeout(klaar, VERTRAGING_MS));
    if (antwoord.status === 204 || antwoord.body === undefined) {
      return new Response(null, { status: antwoord.status === 200 ? 204 : antwoord.status });
    }
    const soort = antwoord.status >= 400 ? "application/problem+json" : "application/json";
    return new Response(JSON.stringify(antwoord.body), { status: antwoord.status, headers: { "Content-Type": soort } });
  };

  if (window.location.pathname === "/" || window.location.pathname === "/agenda") {
    window.history.replaceState(null, "", STARTADRES);
  }
}
