import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import type { HoekWeergave } from "../hoeken/gegevens";
import { Hoekensectie } from "./Hoekensectie";

/**
 * A room's corners are that klas's planning (E6-02, ADR-0030 §3, R7): its own leerkrachten and directie change them,
 * anyone else reads them. The picker picks the first klas, so these tests are about K3 groen.
 */

const GROEN = { id: "klas-groen", naam: "K3 groen", jaarFasen: ["K3"], jaarfase: "K3" } as KlasWeergave;
const BLAUW = { id: "klas-blauw", naam: "K3 blauw", jaarFasen: ["K3"], jaarfase: "K3" } as KlasWeergave;
const HOEK = { id: "h-1", klasId: GROEN.id, naam: "bouwhoek", omschrijving: null, aantalPlaatsingen: 0 } as HoekWeergave;

function toon(ik: Ik) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify([HOEK]), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
  render(
    <QueryClientProvider client={metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik)}>
      <Hoekensectie klassen={[GROEN, BLAUW]} laadt={false} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Hoekensectie", () => {
  it("toont een leerkracht van een andere klas de hoeken zonder knoppen, en zegt het één keer", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: [BLAUW.id] }));

    expect(await screen.findByText("bouwhoek")).toBeInTheDocument();
    expect(screen.getByText(t("rechten.hoekenAlleenBekijken", { klas: "K3 groen" }))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoeken.toevoegen") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("hoeken.overnemen") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("themabeheer.bewerk") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("themabeheer.verwijder") })).toBeNull();
  });

  it("geeft een leerkracht van deze klas de knoppen, zonder de regel", async () => {
    toon(ikMet({ eigenKlasIds: [GROEN.id] }));

    expect(await screen.findByText("bouwhoek")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("hoeken.toevoegen") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("themabeheer.bewerk") })).toBeInTheDocument();
    expect(screen.queryByText(t("rechten.hoekenAlleenBekijken", { klas: "K3 groen" }))).toBeNull();
  });
});
