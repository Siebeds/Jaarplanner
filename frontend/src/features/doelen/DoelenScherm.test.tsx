import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KlasWeergave, LeerplandoelDetail, MinimumdoelDetail, MinimumdoelRegel } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { zetSchermbreedte } from "../../test/setup";
import { useDoelenfilter } from "../../state/doelenfilter";
import { DoelenScherm } from "./DoelenScherm";

/**
 * "Koppel dit doel" opens a sheet that lists the CHOSEN klas's subthema's (fix round 1, F1). So the button asks about
 * that klas's leeftijden: a hoofdleerkracht of K3, who needs no klas (I20), with an L1 klas picked would otherwise open
 * a sheet with nothing to press (the E3-06 rule).
 *
 * The doel is opened from the minimumdoelen register, on a wide screen so the detail is the column beside the list
 * rather than a sheet. *Since TB-010 (merged here before the PR) that register is the decree's tree and a minimumdoel's
 * detail lists its concorded leerplandoelen, so the way in is: the branch the filter opens, the minimumdoel's row, then
 * the code in its detail. Until then the rows listed the codes themselves.*
 */

const selectie = vi.hoisted(() => ({ klas: null as unknown }));
vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => {
    const klas = selectie.klas as KlasWeergave;
    return {
      klas,
      klasId: klas.id,
      schooljaarId: klas.schooljaarId,
      schooljaar: null,
      schooljaren: [],
      klassen: [klas],
      laadt: false,
      kiesSchooljaar: () => {},
      kiesKlas: () => {},
    };
  },
}));

const CODE = "2.1.GL3.10";

const klasVan = (jaarfase: string): KlasWeergave => ({
  id: `klas-${jaarfase}`,
  schooljaarId: "jaar-1",
  naam: `${jaarfase} groen`,
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: [jaarfase],
  jaarfase,
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: jaarfase === "K3",
});

const REF = "K-2.1";

const REGEL: MinimumdoelRegel = {
  ref: REF,
  leeftijd: "K-",
  nr: "2.1",
  omschrijving: "Tellen.",
  leergebied: "Wiskunde",
  rubriek: "Getallen",
  subrubriek: "Tellen",
  aantalLeerplandoelen: 1,
  jaarFasen: ["K3"],
  zonderLeerplandoelReden: null,
  zonderLeerplandoelDoelsets: [],
};

const MINIMUMDOEL: MinimumdoelDetail = {
  ref: REF,
  leeftijd: "K-",
  nr: "2.1",
  omschrijving: "Tellen.",
  leergebied: "Wiskunde",
  rubriek: "Getallen",
  subrubriek: "Tellen",
  soort: "TeBereikenIndividueel",
  nietMeerInOpstap: false,
  aantalLeerplandoelen: 1,
  jaarFasen: [
    {
      jaarFase: "K3",
      leerplandoelen: [
        { code: CODE, tekst: "Tot tien tellen.", disciplineNaam: "Wiskunde", domein: "Getallen", subdomein: "Tellen", nietMeerInOpstap: false },
      ],
    },
  ],
  zonderLeerplandoelReden: null,
  zonderLeerplandoelDoelsets: [],
};

const DETAIL: LeerplandoelDetail = {
  code: CODE,
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  disciplineNummer: "2",
  disciplineNaam: "Wiskunde",
  domein: "Getallen",
  subdomein: "Tellen",
  cluster: null,
  tekst: "De kleuters tellen tot tien.",
  voorbeelden: null,
  toelichting: null,
  woordenschat: null,
  minimumdoelRef: null,
  minimumdoel: null,
  nietMeerInOpstap: false,
  koppelingen: [],
  gerelateerdeDoelen: [],
};

function antwoord(pad: string): unknown {
  switch (new URL(pad, "http://localhost").pathname) {
    case "/api/minimumdoelen/facetten":
      return {
        totaalAantalMinimumdoelen: 1,
        aantalTreffers: 1,
        aantalZonderOrdening: 0,
        leergebieden: [
          {
            naam: "Wiskunde",
            aantal: 1,
            rubrieken: [{ naam: "Getallen", aantal: 1, aantalZonderSubrubriek: 0, subrubrieken: [{ naam: "Tellen", aantal: 1 }] }],
          },
        ],
        leeftijden: [{ leeftijd: "K-", aantal: 1 }],
      };
    case "/api/minimumdoelen":
      return { regels: [REGEL], totaal: 1, overslaan: 0, aantal: 200 };
    case `/api/minimumdoelen/${REF}`:
      return MINIMUMDOEL;
    case "/api/leerplandoelen/facetten":
      return { totaalAantalDoelen: 1, disciplines: [], domeinen: [], doelsoorten: [], jaarFasen: [] };
    case `/api/leerplandoelen/${CODE}`:
      return DETAIL;
    case "/api/themas/bibliotheek":
      return [];
    default:
      return null;
  }
}

beforeEach(() => {
  zetSchermbreedte(true);
  useDoelenfilter.setState({ bron: "minimumdoelen", filter: {}, zoek: "", faseVanKlas: null });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string) => {
      const inhoud = antwoord(String(pad));
      return inhoud === null
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify(inhoud), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => {
  zetSchermbreedte(false);
  vi.unstubAllGlobals();
});

async function openDoel(klasJaarfase: string) {
  selectie.klas = klasVan(klasJaarfase);
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }),
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DoelenScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // The klas's one jaarfase is a filter, so the tree opens its first branch down to the minimumdoelen by itself.
  fireEvent.click((await screen.findByText(REF)).closest("button")!);
  fireEvent.click((await screen.findByText(CODE)).closest("button")!);
  await screen.findByText(DETAIL.tekst);
}

describe("DoelenScherm: Koppel dit doel", () => {
  it("biedt een hoofdleerkracht van K3 met een L1-klas gekozen het koppelen niet aan", async () => {
    await openDoel("L1");
    expect(screen.queryByRole("button", { name: t("doel.koppelAan") })).toBeNull();
  });

  it("biedt het wel aan met een K3-klas gekozen", async () => {
    await openDoel("K3");
    expect(screen.getByRole("button", { name: t("doel.koppelAan") })).toBeInTheDocument();
  });
});
