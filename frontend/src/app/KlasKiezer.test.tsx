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
      { id: KLAS_L3, naam: "L3 — derde leerjaar", leerjaar: 3 },
      { id: KLAS_L4, naam: "L4 — vierde leerjaar", leerjaar: 4 },
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
    expect(within(klasKeuze()).queryByRole("option", { name: "L3 — derde leerjaar" })).toBeNull();
  });

  it("lists only the classes the chosen year contains", async () => {
    renderApp();

    fireEvent.change(await schooljaarKeuze(), { target: { value: JAAR_A } });

    await waitFor(() => expect(klasKeuze()).toBeEnabled());
    expect(within(klasKeuze()).getByRole("option", { name: "L3 — derde leerjaar" })).toBeInTheDocument();
    expect(within(klasKeuze()).getByRole("option", { name: "L4 — vierde leerjaar" })).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole("link", {
        name: `${t("navigatie.dekking")} ${t("navigatie.binnenkort")}`,
      }),
    );

    expect(await screen.findByText(t("binnenkort.dekking"))).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dekking");
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
