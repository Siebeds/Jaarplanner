import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndContext } from "@dnd-kit/core";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hoekenpaneel } from "./Hoekenpaneel";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { zetSchermbreedte } from "../../test/setup";
import { t } from "../../i18n";

/**
 * The side panel shows one list at a time, the one its switch opened (owner, 2026-09-14: "twee secties ... niet
 * gegroepeerd als fiches"), and a fiche chosen from it reaches the agenda as its own kind: a hoek and an algemene fiche
 * open different sheets and save through different endpoints. Both widths, because the panel has two shapes (see
 * `test/setup.ts`).
 */
const antwoord = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string) =>
      Promise.resolve(
        pad.includes("/algemene-fiches")
          ? antwoord([
              { id: "f-1", klasId: "k-1", naam: "turnen", omschrijving: null, aantalPlaatsingen: 0, doelen: [] },
            ])
          : antwoord([{ id: "h-1", klasId: "k-1", naam: "bouwhoek", omschrijving: null, aantalPlaatsingen: 0 }]),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useHoekenpaneel.setState({ open: false, soort: "hoeken" });
  zetSchermbreedte(false);
});

function toon(onKies = vi.fn(), onKiesAlgemeneFiche = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DndContext>
          <Hoekenpaneel klasId="k-1" onKies={onKies} onKiesAlgemeneFiche={onKiesAlgemeneFiche} />
        </DndContext>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onKies, onKiesAlgemeneFiche };
}

describe("Hoekenpaneel: één lijst per schakelaar", () => {
  it("toont naast de agenda alleen de algemene fiches wanneer die schakelaar het opende", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKies, onKiesAlgemeneFiche } = toon();

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.algemeenTitel") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /turnen/ }));
    expect(onKiesAlgemeneFiche).toHaveBeenCalledWith("f-1");
    expect(onKies).not.toHaveBeenCalled();
    // The corners are the other switch's list, not a second section of this one.
    expect(screen.queryByText("bouwhoek")).not.toBeInTheDocument();
  });

  it("toont de hoekenfiches wanneer die schakelaar het opende, en geeft een hoek als hoek door", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    const { onKies, onKiesAlgemeneFiche } = toon();

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.titel") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /bouwhoek/ }));
    expect(onKies).toHaveBeenCalledWith("h-1");
    expect(onKiesAlgemeneFiche).not.toHaveBeenCalled();
    expect(screen.queryByText("turnen")).not.toBeInTheDocument();
  });

  it("sluit op een telefoon eerst het blad, zodat ze niet twee bladen diep zit", async () => {
    zetSchermbreedte(false);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKiesAlgemeneFiche } = toon();

    fireEvent.click(await screen.findByRole("button", { name: /turnen/ }));
    expect(onKiesAlgemeneFiche).toHaveBeenCalledWith("f-1");
    expect(useHoekenpaneel.getState().open).toBe(false);
  });
});
