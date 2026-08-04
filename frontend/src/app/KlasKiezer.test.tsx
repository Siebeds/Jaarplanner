import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { t } from "../i18n";

/**
 * E0-10 clause 3: a class is **chosen from a list**, not typed as a GUID, and the choice survives moving
 * between screens.
 *
 * Driven through the real `App` so the selector, the URL (ADR-0021's single source of truth) and the
 * navigation's query-string preservation are tested together — the bug this guards against is a nav link
 * that quietly drops the chosen class, which no test of the selector alone would catch.
 */

const JAAR_A = "22222222-2222-2222-2222-222222222222";
const JAAR_B = "33333333-3333-3333-3333-333333333333";
const KLAS_L3 = "11111111-1111-1111-1111-111111111111";
const KLAS_L4 = "44444444-4444-4444-4444-444444444444";

const schooljaren = [
  {
    id: JAAR_A,
    naam: "2026-2027",
    start: "2026-09-01",
    eind: "2027-06-30",
    klassen: [
      { id: KLAS_L3, naam: "L3 derde leerjaar", leerjaar: 3 },
      { id: KLAS_L4, naam: "L4 vierde leerjaar", leerjaar: 4 },
    ],
  },
  { id: JAAR_B, naam: "2027-2028", start: "2027-09-01", eind: "2028-06-30", klassen: [] },
];

function stubFetch(body: unknown = schooljaren, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/schooljaren")) {
        return new Response(JSON.stringify(body), { status });
      }
      // The jaarplan call once a class is chosen: not this test's subject, so it 404s and the kalender
      // renders its own error. Asserted on nowhere below.
      return new Response("niet gevonden", { status: 404 });
    }),
  );
}

function renderApp(pad = "/jaarplan") {
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

function schooljaarKeuze() {
  return screen.findByLabelText(t("selectie.schooljaarLabel"));
}

function klasKeuze() {
  return screen.getByLabelText(t("selectie.klasLabel"));
}

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("KlasKiezer — choosing from a list (E0-10 clause 3)", () => {
  it("offers the school years the server returns, with no id to paste anywhere", async () => {
    renderApp();

    const jaar = await schooljaarKeuze();
    expect(within(jaar).getByRole("option", { name: "2026-2027" })).toBeInTheDocument();
    expect(within(jaar).getByRole("option", { name: "2027-2028" })).toBeInTheDocument();

    // The GUID inputs this replaced were textboxes; the jaarplan screen must no longer have one.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps the class list empty until a year is chosen, and disables it", async () => {
    renderApp();
    await schooljaarKeuze();

    expect(klasKeuze()).toBeDisabled();
    expect(within(klasKeuze()).queryByRole("option", { name: "L3 derde leerjaar" })).toBeNull();
  });

  // Found by opening the app rather than by a test: before a year is chosen the control claimed "Geen klassen
  // in dit schooljaar" — a statement about a schooljaar the teacher had not picked, shown on first load, and
  // false (the demo year does contain a class). The real-empty-year branch below was always correct; the two
  // states had simply been collapsed into one message. Both are pinned now so they cannot re-merge.
  it("asks for a year first instead of claiming the unchosen year has no classes", async () => {
    renderApp();
    await schooljaarKeuze();

    expect(within(klasKeuze()).getByRole("option", { name: t("selectie.eerstSchooljaar") })).toBeInTheDocument();
    expect(within(klasKeuze()).queryByRole("option", { name: t("selectie.geenKlassen") })).toBeNull();
  });

  // A saved link naming a year that has since been deleted is a different event from an untouched selector, so
  // it gets its own sentence: "kies eerst een schooljaar" would ask the teacher to redo what they thought they
  // had done. Both branches resolve through a falsy `gekozenSchooljaar`, which is why this is asserted and not
  // left to the reader of the ternary.
  it("says the year is gone when a deep link names one that no longer exists", async () => {
    renderApp("/jaarplan?schooljaar=00000000-0000-0000-0000-000000000000");
    await schooljaarKeuze();

    expect(
      within(klasKeuze()).getByRole("option", { name: t("selectie.onbekendSchooljaar") }),
    ).toBeInTheDocument();
    expect(within(klasKeuze()).queryByRole("option", { name: t("selectie.eerstSchooljaar") })).toBeNull();
  });

  it("lists only the classes the chosen year contains", async () => {
    renderApp();

    fireEvent.change(await schooljaarKeuze(), { target: { value: JAAR_A } });

    await waitFor(() => expect(klasKeuze()).toBeEnabled());
    expect(within(klasKeuze()).getByRole("option", { name: "L3 derde leerjaar" })).toBeInTheDocument();
    expect(within(klasKeuze()).getByRole("option", { name: "L4 vierde leerjaar" })).toBeInTheDocument();
  });

  it("writes the choice to the URL, so the screen is deep-linkable", async () => {
    renderApp();

    fireEvent.change(await schooljaarKeuze(), { target: { value: JAAR_A } });
    await waitFor(() => expect(klasKeuze()).toBeEnabled());
    fireEvent.change(klasKeuze(), { target: { value: KLAS_L3 } });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("schooljaar")).toBe(JAAR_A);
      expect(params.get("klas")).toBe(KLAS_L3);
    });
  });

  it("restores the choice from the URL on a deep link", async () => {
    renderApp(`/jaarplan?schooljaar=${JAAR_A}&klas=${KLAS_L4}`);

    await waitFor(() => expect(klasKeuze()).toHaveValue(KLAS_L4));
    expect(await schooljaarKeuze()).toHaveValue(JAAR_A);
  });

  it("clears the class when the year changes — a class belongs to one year (Art. IX.3)", async () => {
    renderApp(`/jaarplan?schooljaar=${JAAR_A}&klas=${KLAS_L3}`);
    await waitFor(() => expect(klasKeuze()).toHaveValue(KLAS_L3));

    fireEvent.change(await schooljaarKeuze(), { target: { value: JAAR_B } });

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).has("klas")).toBe(false);
    });
    expect(screen.getByText(t("selectie.geenKlassen"))).toBeInTheDocument();
  });

  it("keeps the chosen class when navigating to another screen", async () => {
    renderApp(`/jaarplan?schooljaar=${JAAR_A}&klas=${KLAS_L3}`);
    await waitFor(() => expect(klasKeuze()).toHaveValue(KLAS_L3));

    // Retargeted from `/dekking` to `/beheer` by **E5-02**, which replaced `/dekking`'s placeholder with the real
    // dekkingsoverzicht. `/beheer` is the destination that is still a placeholder (E6-03/E6-04), so this test keeps
    // testing what it was written to test — that the class selection survives a cross-screen click — without also
    // firing a coverage request this file's fetch stub knows nothing about.
    fireEvent.click(
      screen.getByRole("link", {
        name: `${t("navigatie.beheer")} ${t("navigatie.binnenkort")}`,
      }),
    );

    expect(await screen.findByText(t("binnenkort.beheer"))).toBeInTheDocument();
    expect(window.location.pathname).toBe("/beheer");
    // The whole point of routing every nav link through one component (ADR-0021).
    expect(new URLSearchParams(window.location.search).get("klas")).toBe(KLAS_L3);
  });

  it("selects nothing when the URL names a year that no longer exists", async () => {
    renderApp("/jaarplan?schooljaar=99999999-9999-9999-9999-999999999999&klas=" + KLAS_L3);

    // A stale bookmark must not leave a class list belonging to nobody, nor silently rewrite the URL.
    await waitFor(() => expect(klasKeuze()).toBeDisabled());
    expect(await schooljaarKeuze()).toHaveValue("");
    expect(klasKeuze()).toHaveValue("");
  });
});

describe("KlasKiezer — failure states", () => {
  it("reports a load failure in Dutch, from the catalogue", async () => {
    stubFetch({ title: "Internal Server Error" }, 500);
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(t("selectie.fout"));
  });

  it("says so when the school has no school year yet", async () => {
    stubFetch([]);
    renderApp();

    expect(await screen.findByText(t("selectie.geenSchooljaren"))).toBeInTheDocument();
  });
});
