import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave, SchooljaarSamenvatting } from "../../lib/types";
import { t } from "../../i18n";
import type { GebruikersOverzicht } from "./gebruikerbeheer";
import { KlassenScherm } from "./KlassenScherm";

/**
 * Instellingen, Klassen, as E6-04 changed it: directie defines the klassen and sees who teaches
 * them; anyone else reads the list without a single control the server would refuse (the E3-06
 * rule), and a klas without a leeftijd says, in its one callout, that it grants no rights (I12).
 */

const JAAR: SchooljaarSamenvatting = { id: "jaar-1", naam: "2026-2027", start: "2026-09-01", eind: "2027-06-30" };
const K3: KlasWeergave = {
  id: "klas-k3",
  schooljaarId: JAAR.id,
  naam: "K3 groen",
  leerjaar: 0,
  aantalSubthemas: 2,
  jaarFasen: ["K3"],
  jaarfase: "K3",
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: true,
};
const OUD: KlasWeergave = { ...K3, id: "klas-oud", naam: "Oude klas", jaarFasen: ["JK", "K2", "K3"], jaarfase: null };

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    schooljaar: JAAR,
    schooljaren: [JAAR],
    klassen: [K3, OUD],
    laadt: false,
    kiesSchooljaar: () => {},
  }),
}));

const IK: Ik = {
  id: "ik-1",
  naam: "Bert Claes",
  email: "bert@school.be",
  isDirectie: false,
  heeftThemabeheer: true,
  hoofdleerkrachtLeeftijden: ["K3"],
  leerkrachtLeeftijden: ["K3"],
  eigenKlasIds: [K3.id],
  rapportklasIds: [],
  lopendeRapportklasIds: [],
};

const OVERZICHT: GebruikersOverzicht = {
  voorbijeSchooljaarIds: [],
  gebruikers: [
    {
      id: "g-1",
      naam: "An Peeters",
      email: "an@school.be",
      isDirectie: false,
      heeftThemabeheer: false,
      isAangemeld: true,
      klastoewijzingen: [{ klasId: K3.id, klasNaam: K3.naam, jaarfase: "K3", schooljaarId: JAAR.id, teltVoorGedeeldeInhoud: true }],
      hoofdleerkrachtaanstellingen: [],
    },
  ],
};

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

function toon(isDirectie: boolean) {
  const fetchMock = vi.fn(async (pad: string) => {
    if (pad.endsWith("/api/ik")) return json({ ...IK, isDirectie });
    if (pad.endsWith("/api/jaarfasen")) return json(["JK", "K2", "K3"]);
    if (pad.endsWith("/api/gebruikers")) return isDirectie ? json(OVERZICHT) : json({}, 403);
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/instellingen/klassen"]}>
        <KlassenScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KlassenScherm", () => {
  it("is voor wie geen directie is alleen te lezen, en vraagt de gebruikers niet op", async () => {
    const fetchMock = toon(false);

    expect(await screen.findByText(K3.naam)).toBeInTheDocument();
    // Wait until `/api/ik` has answered, so the absence below is a decision and not a loading state.
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([pad]) => String(pad).endsWith("/api/ik"))).toBe(true));
    await new Promise((klaar) => setTimeout(klaar, 0));

    expect(screen.queryByRole("button", { name: t("klasbeheer.toevoegen") })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("themabeheer.bewerk") })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("klasbeheer.leeftijdInstellen") })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("themabeheer.verwijder") })).not.toBeInTheDocument();
    expect(screen.queryByText(t("klasbeheer.geenLeerkracht"))).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([pad]) => String(pad).endsWith("/api/gebruikers"))).toBe(false);
  });

  it("zegt bij een klas zonder leeftijd in dezelfde melding dat ze haar leerkrachten geen rechten geeft", async () => {
    toon(false);

    const melding = (await screen.findByText(t("klasbeheer.leeftijdOntbreekt"))).parentElement!;
    expect(melding).toHaveTextContent(t("klasbeheer.geenLeeftijdsrechten"));
    expect(screen.getAllByText(t("klasbeheer.geenLeeftijdsrechten"))).toHaveLength(1);
  });

  it("toont directie de knoppen en wie elke klas geeft", async () => {
    toon(true);

    expect(await screen.findByText(t("klasbeheer.eenLeerkracht", { namen: "An Peeters" }))).toBeInTheDocument();
    expect(screen.getByText(t("klasbeheer.geenLeerkracht"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("klasbeheer.toevoegen") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("themabeheer.bewerk") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("klasbeheer.leeftijdInstellen") })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: t("themabeheer.verwijder") })).toHaveLength(2);
  });
});
