import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navigatie } from "./Navigatie";
import { useHoekenpaneel } from "../state/hoekenpaneel";
import { t } from "../i18n";
import type { Ik } from "../lib/aanmelding";
import { DIRECTIE, ikMet, metIk } from "../test/rechten";

/**
 * What the navigation does that is behaviour rather than style.
 *
 * Deliberately not a test of where anything sits or how wide the rail gets: jsdom applies no
 * stylesheet, so `hidden lg:block` is invisible to it and an assertion about the phone shape here
 * would pass whatever the class said. That half is a browser pass, not a unit test.
 *
 * What is testable is which routes offer the hoekenfiches switch at all, that leaving the agenda
 * closes the panel, and which routes collapse the navigation (read off the labels, not the width).
 * The panel reset is the one worth having: the store feeds `useZijkolom`, which drives the rail in
 * this component and the inline reservation in `Schil`, so a `true` that outlives the agenda dresses
 * both of them for a panel that has unmounted, and nothing else in the app would notice.
 */
/*
  The navigation reads who is signed in (E6-01), so it needs a query client. The network is a promise
  that never settles unless a test says otherwise: the signed-in row then draws nothing, and every test
  below sees the navigation exactly as it was before the row existed.

  Since E6-02 slice 4 the hoekenfiches switch is also a planning right (ADR-0030 §3, R7), so the tests
  that expect it put a directie in the cache first; directie plans every klas, with or without one chosen.
*/
const rendermetPad = (pad: string, ik?: Ik) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (ik) metIk(client, ik);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pad]}>
        <Navigatie />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const schakelaar = () => screen.queryByRole("button", { name: t("hoekenpaneel.titel") });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  useHoekenpaneel.setState({ open: false, soort: "hoeken" });
  vi.unstubAllGlobals();
});

describe("Navigatie, aangemeld", () => {
  it("toont wie aangemeld is en biedt afmelden aan", async () => {
    // Answers per path: the navigation also asks for the schooljaren and klassen now (the hoekenfiches switch is a
    // right on the chosen klas), and an Ik handed back for those would not be a list.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (pad: string) =>
        String(pad).endsWith("/api/ik")
          ? new Response(JSON.stringify(ikMet({ id: "1", naam: "An Peeters", email: "an@school.be" })), { status: 200 })
          : new Response("[]", { status: 200 }),
      ),
    );

    rendermetPad("/doelen");

    expect(await screen.findByText("An Peeters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("aanmelding.afmelden") })).toBeInTheDocument();
  });
});

describe("Navigatie", () => {
  it("biedt de hoekenschakelaar aan op de agenda", () => {
    rendermetPad("/agenda", DIRECTIE);
    expect(schakelaar()).toBeInTheDocument();
  });

  it("biedt hem ook aan op een losse dag van de agenda", () => {
    rendermetPad("/agenda/dag/2026-09-01", DIRECTIE);
    expect(schakelaar()).toBeInTheDocument();
  });

  it("biedt hem niet aan op een ander scherm", () => {
    rendermetPad("/doelen", DIRECTIE);
    expect(schakelaar()).not.toBeInTheDocument();
  });

  it("biedt hem niet aan bij thema's per periode, want daar staat geen paneel", () => {
    rendermetPad("/agenda/periodes", DIRECTIE);
    expect(schakelaar()).not.toBeInTheDocument();
  });

  it("biedt hem niet aan wie de gekozen klas niet mag plannen, want elke fiche plant een hoek", () => {
    // A hoofdleerkracht with themabeheer and no klas: every right but the planning of a klas.
    rendermetPad("/agenda", ikMet({ heeftThemabeheer: true, hoofdleerkrachtLeeftijden: ["K3"] }));
    expect(schakelaar()).not.toBeInTheDocument();
    // Nor the algemene fiches' switch: every fiche in that list plans one too.
    expect(screen.queryByRole("button", { name: t("hoekenpaneel.algemeenTitel") })).not.toBeInTheDocument();
  });

  it("biedt hem niet aan zolang niet bekend is wie er aangemeld is", () => {
    rendermetPad("/agenda");
    expect(schakelaar()).not.toBeInTheDocument();
  });

  it("opent het paneel en zegt dat het open staat", () => {
    rendermetPad("/agenda", DIRECTIE);
    const knop = schakelaar();
    expect(knop).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(knop!);

    expect(useHoekenpaneel.getState().open).toBe(true);
    expect(schakelaar()).toHaveAttribute("aria-pressed", "true");
  });

  /*
    TWO SWITCHES, ONE COLUMN (owner, 2026-09-14: "twee secties ... niet gegroepeerd als fiches"). Pressing the other
    switch swaps the list without closing the column first; pressing the one that is on closes it.
  */
  it("heeft een eigen schakelaar voor de algemene fiches, die de lijst wisselt en niet eerst sluit", () => {
    rendermetPad("/agenda", DIRECTIE);
    const algemeen = () => screen.getByRole("button", { name: t("hoekenpaneel.algemeenTitel") });

    fireEvent.click(algemeen());
    expect(useHoekenpaneel.getState()).toMatchObject({ open: true, soort: "algemeen" });
    expect(algemeen()).toHaveAttribute("aria-pressed", "true");
    expect(schakelaar()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(schakelaar()!);
    expect(useHoekenpaneel.getState()).toMatchObject({ open: true, soort: "hoeken" });
    expect(schakelaar()).toHaveAttribute("aria-pressed", "true");
    expect(algemeen()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(schakelaar()!);
    expect(useHoekenpaneel.getState().open).toBe(false);
  });

  it("sluit het paneel wanneer de leerkracht naar een ander scherm gaat", () => {
    useHoekenpaneel.setState({ open: true });
    rendermetPad("/agenda", DIRECTIE);

    fireEvent.click(screen.getByRole("link", { name: t("navigatie.doelen") }));

    expect(useHoekenpaneel.getState().open).toBe(false);
    expect(schakelaar()).not.toBeInTheDocument();
  });

  /*
    The rail itself is a width, which jsdom cannot see. What it can see is the other half of the
    collapse: in the rail a destination's label is gone and its name moves to `title` and
    `aria-label`, and that is decided by the same flag that sets the width.
  */
  it("klapt in tot een rail in Instellingen, waar de onderdelen de kolom innemen", () => {
    rendermetPad("/instellingen/klassen");
    expect(screen.getByRole("link", { name: t("navigatie.doelen") })).toHaveAttribute("title", t("navigatie.doelen"));
  });

  it("staat voluit op een scherm zonder tweede kolom", () => {
    rendermetPad("/doelen");
    expect(screen.getByRole("link", { name: t("navigatie.doelen") })).not.toHaveAttribute("title");
  });
});
