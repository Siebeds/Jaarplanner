import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave, LeerplandoelDetail, ThemaBibliotheekItem, ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { Bestemmingsblad } from "./Bestemmingsblad";

/**
 * The register's destination sheet lists only the thema's where the gebruiker has something to press (E6-02 slice 4,
 * fix round 2; the E3-06 rule). A hoofdleerkracht of K3 met a thema without subthema's that opened onto nothing.
 */

const CODE = "2.1.GL3.10";

const KLAS: KlasWeergave = {
  id: "klas-K3",
  schooljaarId: "jaar-1",
  naam: "K3 groen",
  leerjaar: 0,
  aantalSubthemas: 1,
  jaarFasen: ["K3"],
  jaarfase: "K3",
  mogelijkeJaarfasen: [],
};

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: KLAS,
    klasId: KLAS.id,
    schooljaarId: KLAS.schooljaarId,
    schooljaar: null,
    schooljaren: [],
    klassen: [KLAS],
    laadt: false,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

function thema(id: string, naam: string, subthemas: ThemaWeergave["subthemas"]): ThemaWeergave {
  return {
    id,
    naam,
    duurWeken: 4,
    invalshoeken: null,
    kernwoordenschat: [],
    rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: false,
    themadoelen: [],
    subthemas,
  };
}

const HERFST = thema("thema-herfst", "Herfst", [
  {
    id: "sub-1",
    themaId: "thema-herfst",
    naam: "Bladeren",
    duurWeken: 2,
    leeftijd: "K3",
    onderzoeksvragen: [],
    subdoelen: [],
    activiteiten: [],
  },
]);
const LEEG = thema("thema-leeg", "Leeg thema", []);

function bibliotheekItem(item: ThemaWeergave): ThemaBibliotheekItem {
  return {
    id: item.id,
    naam: item.naam,
    duurWeken: item.duurWeken,
    invalshoeken: null,
    kernwoordenschat: [],
    rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: false,
    themadoelen: [],
    aantalAfgeleideKlassen: 0,
  };
}

function toon(ik: Ik, themas: ThemaWeergave[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-bibliotheek"], themas.map(bibliotheekItem));
  for (const item of themas) qc.setQueryData(["thema-voor-klas", item.id, KLAS.id], item);
  qc.setQueryData(["leerplandoel", CODE], {
    code: CODE,
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    tekst: "De kleuters tellen tot tien.",
  } as unknown as LeerplandoelDetail);
  metIk(qc, ik);

  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Bestemmingsblad code={CODE} open onOpenChange={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.getByRole("dialog");
}

describe("Bestemmingsblad", () => {
  it("toont een hoofdleerkracht van K3 geen leeg thema, wel het thema met een K3-subthema", () => {
    const blad = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [HERFST, LEEG]);

    expect(within(blad).getByText("Herfst")).toBeInTheDocument();
    expect(within(blad).queryByText("Leeg thema")).toBeNull();
  });

  it("toont directie en themabeheer ook het lege thema, waar ze op themaniveau koppelen", () => {
    for (const ik of [DIRECTIE, ikMet({ heeftThemabeheer: true })]) {
      const blad = toon(ik, [HERFST, LEEG]);
      expect(within(blad).getByText("Herfst")).toBeInTheDocument();
      expect(within(blad).getByText("Leeg thema")).toBeInTheDocument();
      cleanup();
    }
  });

  it("zegt dat er niets te koppelen is als er thema's zijn maar geen enkele knop, niet dat er geen thema's zijn", () => {
    const blad = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [LEEG]);

    expect(within(blad).getByText(t("koppelen.nietsTeKoppelen"))).toBeInTheDocument();
    expect(within(blad).queryByText(t("koppelen.geenThemas"))).toBeNull();
    expect(within(blad).queryByText("Leeg thema")).toBeNull();
  });
});
