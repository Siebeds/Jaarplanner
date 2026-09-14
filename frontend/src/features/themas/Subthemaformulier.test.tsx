import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubthemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Subthemaformulier } from "./Subthemaformulier";

/**
 * The subthema form offers only the leeftijden this gebruiker may use (E6-02, ADR-0030 §3 and I13). A single one is
 * stated rather than offered, since a select with one option is a control that does nothing.
 */

const BESTAAND: SubthemaWeergave = {
  id: "s-1",
  themaId: "thema-1",
  naam: "Bladeren",
  duurWeken: 2,
  leeftijd: "K3",
  onderzoeksvragen: [],
  subdoelen: [],
  activiteiten: [],
};

function toon(magLeeftijd: (leeftijd: string) => boolean, subthema?: SubthemaWeergave, onBewaar = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Subthemaformulier
        open
        subthema={subthema}
        magLeeftijd={magLeeftijd}
        onBewaar={onBewaar}
        onSluit={vi.fn()}
        bezig={false}
      />
    </QueryClientProvider>,
  );
  return onBewaar;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(["JK", "K2", "K3", "L1"]), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Subthemaformulier: de leeftijden", () => {
  it("noemt de ene leeftijd van een hoofdleerkracht in plaats van ze te laten kiezen, en bewaart ze", async () => {
    const bewaar = toon((leeftijd) => leeftijd === "K3");

    const blad = await screen.findByRole("dialog");
    expect(await within(blad).findByText("K3")).toBeInTheDocument();
    expect(within(blad).queryByRole("combobox")).toBeNull();

    fireEvent.change(within(blad).getByLabelText(t("themabeheer.naam")), { target: { value: "Bladeren" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.bewaar") }));
    expect(bewaar.mock.calls[0][0]).toMatchObject({ naam: "Bladeren", leeftijd: "K3" });
  });

  it("biedt alleen de leeftijden aan waar dit mag, in de volgorde van de server", async () => {
    toon((leeftijd) => leeftijd === "K3" || leeftijd === "K2");

    const keuze = await screen.findByRole("combobox", { name: t("subthemabeheer.leeftijd") });
    const opties = within(keuze)
      .getAllByRole("option")
      .map((optie) => optie.textContent);
    expect(opties).toEqual([t("subthemabeheer.kiesLeeftijd"), "K2", "K3"]);
  });

  // Fix round 1, F4: "the list did not load" and "you may use none of it" are two facts, and only the first is a
  // loading problem.
  it("zegt niets over laden als de lijst er is maar geen enkele leeftijd mag", async () => {
    toon(() => false);

    const blad = await screen.findByRole("dialog");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((klaar) => setTimeout(klaar, 0));
    expect(within(blad).queryByText(t("klasbeheer.leeftijdenOnbekend"))).toBeNull();
    expect(within(blad).queryByRole("combobox")).toBeNull();
  });

  it("zegt wel dat de leeftijden niet laadden als de lijst niet aankwam", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    toon(() => true);

    expect(await screen.findByText(t("klasbeheer.leeftijdenOnbekend"))).toBeInTheDocument();
  });

  it("verplaatst een bestaand subthema alleen naar een leeftijd waar dit ook mag (I13)", async () => {
    // A hoofdleerkracht of K3 only: the subthema stays where it is, so its leeftijd is a fact.
    toon((leeftijd) => leeftijd === "K3", BESTAAND);

    const blad = await screen.findByRole("dialog");
    expect(await within(blad).findByText("K3")).toBeInTheDocument();
    expect(within(blad).queryByRole("combobox")).toBeNull();
  });
});
