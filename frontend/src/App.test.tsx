import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { NAVIGATIE } from "./app/routes";
import { t } from "./i18n";

/**
 * Pins E0-10's acceptance criteria on the **real** `App`, including its own `BrowserRouter`, so the
 * redirect, the URL and browser history are exercised rather than a `MemoryRouter` stand-in.
 *
 * The API is faked at the fetch boundary (the convention `Jaarplankalender.test.tsx` set), so the real
 * navigation, the real nl.json copy and the real TanStack Query wiring are under test.
 */

const SCHOOLJAAR_ID = "22222222-2222-2222-2222-222222222222";
const KLAS_ID = "11111111-1111-1111-1111-111111111111";

const schooljaren = [
  {
    id: SCHOOLJAAR_ID,
    naam: "2026-2027",
    start: "2026-09-01",
    eind: "2027-06-30",
    klassen: [{ id: KLAS_ID, naam: "L3 derde leerjaar", leerjaar: 3 }],
  },
];

/** Serves the schooljaren list; anything else 404s loudly, so an unexpected call fails the test. */
function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/schooljaren")) {
        return new Response(JSON.stringify(schooljaren), { status: 200 });
      }

      return new Response("unexpected request", { status: 404 });
    }),
  );
}

function renderApp(pad = "/") {
  window.history.pushState({}, "", pad);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  // Wrapped in StrictMode because `main.tsx` is: it double-invokes effects in development, and a
  // focus-management bug hid in exactly that gap — a ref-based "skip the first render" guard passed here
  // and failed in a real browser. A test harness that is gentler than the dev runtime is not a harness.
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

/** The nav, awaited — it renders once the shell is up. */
function vindNavigatie() {
  return screen.findByRole("navigation", { name: t("navigatie.hoofdnavigatie") });
}

/**
 * The shell fully settled: nav rendered *and* the schooljaren query resolved, so the selector is on
 * screen. Waiting for the nav alone let the query land mid-assertion, which React reports as an
 * un-acted state update.
 */
async function wachtOpShell() {
  const navigatie = await vindNavigatie();
  await screen.findByLabelText(t("selectie.schooljaarLabel"));
  return navigatie;
}

/** The nav entry for a path — by path, not index, so reordering `NAVIGATIE` cannot silently retarget a test. */
function bestemming(pad: string) {
  const gevonden = NAVIGATIE.find((kandidaat) => kandidaat.pad === pad);
  if (!gevonden) throw new Error(`No navigation entry for ${pad}`);
  return gevonden;
}

/** Label a nav link is found by: unbuilt items carry the marker inside their accessible name. */
function navLabel(item: (typeof NAVIGATIE)[number]) {
  return item.isGebouwd
    ? t(item.labelKey)
    : `${t(item.labelKey)} ${t("navigatie.binnenkort")}`;
}

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("App shell — routing (E0-10 clause 1)", () => {
  it("redirects the root to the jaarplan, the anchor screen", async () => {
    renderApp("/");

    await waitFor(() => expect(window.location.pathname).toBe("/jaarplan"));
  });

  it("opens a deep link directly, without passing through the root", async () => {
    renderApp("/dekking");

    expect(await screen.findByText(t("binnenkort.dekking"))).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dekking");
  });

  it("navigates on click and honours the browser Back button", async () => {
    renderApp("/jaarplan");
    await vindNavigatie();

    fireEvent.click(screen.getByRole("link", { name: navLabel(bestemming("/dekking")) }));
    expect(await screen.findByText(t("binnenkort.dekking"))).toBeInTheDocument();

    window.history.back();

    await waitFor(() => expect(window.location.pathname).toBe("/jaarplan"));
  });

  it("shows an honest not-found page for a URL that matches no route", async () => {
    renderApp("/bestaat-niet");

    expect(await screen.findByText(t("navigatie.nietGevondenUitleg"))).toBeInTheDocument();
  });
});

describe("App shell — navigation (E0-10 clause 2)", () => {
  it("renders every destination of the §3 information architecture", async () => {
    renderApp("/jaarplan");
    const navigatie = await vindNavigatie();

    for (const item of NAVIGATIE) {
      expect(within(navigatie).getByRole("link", { name: navLabel(item) })).toBeInTheDocument();
    }
  });

  it("marks an unbuilt destination as unavailable in visible text, never a tooltip", async () => {
    renderApp("/jaarplan");
    const navigatie = await vindNavigatie();
    const ongebouwd = NAVIGATIE.filter((item) => !item.isGebouwd);

    expect(ongebouwd.length).toBeGreaterThan(0);
    // Rendered text inside the link, so screen readers get it as part of the accessible name. A `title`
    // would be invisible on touch, unreachable by keyboard and unread by most screen readers (E3-06).
    expect(within(navigatie).getAllByText(t("navigatie.binnenkort"))).toHaveLength(
      ongebouwd.length,
    );

    for (const item of ongebouwd) {
      expect(within(navigatie).getByRole("link", { name: navLabel(item) })).not.toHaveAttribute(
        "title",
      );
    }
  });

  // Was `/import` until **E1-13** built that screen; moved to `/dekking`, which is still a placeholder
  // (E5-02/E5-03/E5-05 own it). The route is read from `NAVIGATIE` rather than hard-coded so the next story to
  // build a screen finds this assertion instead of silently testing a page that has since grown controls.
  it("says plainly that an unbuilt screen does not work yet, and offers no controls", async () => {
    const ongebouwd = NAVIGATIE.find((item) => !item.isGebouwd && item.binnenkortKey);
    expect(ongebouwd).toBeDefined();
    renderApp(ongebouwd!.pad);

    expect(await screen.findByText(t("binnenkort.titel"))).toBeInTheDocument();
    expect(screen.getByText(t(ongebouwd!.binnenkortKey!))).toBeInTheDocument();

    // "A control that does nothing teaches a review the wrong thing" (E3-06): the page itself is inert.
    const hoofdinhoud = document.getElementById("hoofdinhoud")!;
    expect(within(hoofdinhoud).queryByRole("button")).toBeNull();
    expect(within(hoofdinhoud).queryByRole("link")).toBeNull();
    expect(within(hoofdinhoud).queryByRole("textbox")).toBeNull();
    expect(within(hoofdinhoud).queryByRole("combobox")).toBeNull();
  });

  it("marks the current route with aria-current, so the signal is not colour alone", async () => {
    renderApp("/dekking");

    expect(await screen.findByRole("link", { name: navLabel(bestemming("/dekking")) })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: t("navigatie.jaarplan") })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("App shell — accessibility (E0-10 clause 5)", () => {
  it("offers a skip-link that targets the main region", async () => {
    renderApp("/jaarplan");

    const overslaan = await screen.findByRole("link", { name: t("navigatie.overslaan") });
    expect(overslaan).toHaveAttribute("href", "#hoofdinhoud");
    expect(document.getElementById("hoofdinhoud")).not.toBeNull();
  });

  it("puts the skip-link first, ahead of the navigation", async () => {
    const { container } = renderApp("/jaarplan");
    await wachtOpShell();

    const focusbaar = container.querySelectorAll("a[href], button, select, input, [tabindex]");
    // `main` carries tabIndex=-1 as a script focus target, so filter to genuinely tabbable elements.
    const eerste = [...focusbaar].find(
      (element) => element.getAttribute("tabindex") !== "-1",
    );

    expect(eerste).toHaveAccessibleName(t("navigatie.overslaan"));
  });

  it("moves focus into the main region after a navigation", async () => {
    renderApp("/jaarplan");
    await vindNavigatie();

    fireEvent.click(screen.getByRole("link", { name: navLabel(bestemming("/doelen")) }));

    await waitFor(() => expect(document.getElementById("hoofdinhoud")).toHaveFocus());
  });

  it("does not steal focus on first render", async () => {
    renderApp("/jaarplan");
    await wachtOpShell();

    expect(document.getElementById("hoofdinhoud")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("does not move focus on the root redirect, so the header stays ahead of the user", async () => {
    // Found by opening the app, not by a test: `/` → `/jaarplan` is a pathname change, so the
    // focus-after-navigation effect fired on the very first visit and dropped focus into an empty
    // `<main>`. Everything in the header — including the class selector a teacher needs first — was then
    // *behind* the focus position, reachable only by Shift+Tab.
    renderApp("/");
    await waitFor(() => expect(window.location.pathname).toBe("/jaarplan"));
    await wachtOpShell();

    expect(document.getElementById("hoofdinhoud")).not.toHaveFocus();
  });

  it("keeps the main region out of the tab order", async () => {
    renderApp("/jaarplan");
    await vindNavigatie();

    // E3-06's audit removed a tabIndex that made every inert card a tab stop; -1 is focusable by
    // script only, which is what the post-navigation focus move needs.
    expect(document.getElementById("hoofdinhoud")).toHaveAttribute("tabindex", "-1");
  });

  it("passes an axe smoke check", async () => {
    // Structure only: jsdom cannot evaluate colour contrast, so a green run here says nothing about the
    // palette — the lesson from E3-06's two WCAG contrast failures that axe had missed.
    const { container } = renderApp("/jaarplan");
    await wachtOpShell();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("App shell — brand and copy", () => {
  it("renders the brand heading and the subtitle from nl.json", async () => {
    renderApp("/jaarplan");

    expect(await screen.findByRole("heading", { level: 1, name: "Jaarplanner" })).toBeInTheDocument();
    // Asserting against t() proves the copy comes from the catalogue, not a literal.
    expect(screen.getByText(t("app.ondertitel"))).toBeInTheDocument();
  });
});
