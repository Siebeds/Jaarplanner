import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { ActiviteitWeergave, DoelMatchSuggestie, ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { STANDAARDDUUR } from "../plan/tijd";
import { ThemadetailScherm } from "./ThemadetailScherm";

/**
 * The thema fiche, as each right sees it (E6-02 slice 4, ADR-0030 §3).
 *
 * One thema with a K3 chapter and an L1 chapter, because the point of per-leeftijd rights is that one page carries
 * content a gebruiker edits and content they only read. The K3 chapter holds three activiteiten that differ only in
 * who made them and whether a goal is linked, which is what decides the maker's delete (R25, R33).
 */

const IK_ID = "ik-1";

function activiteit(id: string, naam: string, extra: Partial<ActiviteitWeergave> = {}): ActiviteitWeergave {
  return {
    id,
    naam,
    activiteitType: "Spel",
    hoek: null,
    verwachteUitkomsten: null,
    onderzoeksvraagId: null,
    kleur: null,
    doelkoppelingen: [],
    makerId: null,
    ...extra,
  };
}

const koppeling = (code: string) => ({ id: `k-${code}`, leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null });

const THEMA: ThemaWeergave = {
  id: "thema-1",
  naam: "Herfst",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [{ id: "td-1", koppeling: koppeling("NED-1") }],
  subthemas: [
    {
      id: "s-k3",
      themaId: "thema-1",
      naam: "Bladeren",
      duurWeken: 2,
      leeftijd: "K3",
      onderzoeksvragen: [],
      subdoelen: [{ id: "sd-1", leeftijd: "K3", koppeling: koppeling("WIS-1") }],
      activiteiten: [
        activiteit("a-eigen", "Eigen spel", { makerId: IK_ID }),
        activiteit("a-ander", "Andermans spel", { makerId: "iemand-anders" }),
        activiteit("a-gekoppeld", "Gekoppeld spel", { makerId: IK_ID, doelkoppelingen: [koppeling("WO-2")] }),
      ],
    },
    {
      id: "s-l1",
      themaId: "thema-1",
      naam: "Rekenen",
      duurWeken: 2,
      leeftijd: "L1",
      onderzoeksvragen: [],
      subdoelen: [],
      activiteiten: [activiteit("a-l1", "Tellen")],
    },
  ],
};

const SUGGESTIE: DoelMatchSuggestie = {
  id: "sug-1",
  leerplandoelCode: "WO-3",
  status: "Voorgesteld",
  aiMotivatie: "Past bij bladeren verzamelen.",
  tekst: "Een doel over seizoenen",
  doelsoort: "Gemeenschappelijk",
};

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

function toon(ik: Ik, opties: { weiger?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        return opties.weiger
          ? json({ title: "Geen toegang", detail: "Je hebt geen toegang tot deze actie." }, 403)
          : json({});
      }
      if (pad.endsWith("/doelsuggesties")) return json([SUGGESTIE]);
      if (pad.endsWith("/api/jaarfasen")) return json(["JK", "K2", "K3", "L1"]);
      if (pad.endsWith("/api/themas/thema-1")) return json(THEMA);
      return json({}, 404);
    }),
  );
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    { ...ik, id: IK_ID },
  );
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/themas/thema-1"]}>
        <Routes>
          <Route path="themas/:themaId" element={<ThemadetailScherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const knop = (naam: string) => screen.queryByRole("button", { name: naam });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemadetailScherm: wie wat mag", () => {
  it("geeft een leerkracht van K3 de activiteiten van K3, en de prullenbak alleen op wat zij zelf maakte zonder doel", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-k3"] }));
    await screen.findByText("Bladeren");

    // Not the thema, its themadoelen or the doelsuggesties (R4, R14), nor any subthema (R5, R21) or subdoel (R24).
    expect(knop(t("themabeheer.bewerkAria", { naam: "Herfst" }))).toBeNull();
    expect(knop(t("themabeheer.verwijderAria", { naam: "Herfst" }))).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).toBeNull();
    expect(knop(t("doelkiezer.koppel"))).toBeNull();
    expect(knop(t("activiteit.ontkoppel", { code: "NED-1" }))).toBeNull();
    expect(screen.queryByText(SUGGESTIE.aiMotivatie!)).toBeNull();
    expect(knop(t("subthemabeheer.toevoegen"))).toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Bladeren" }))).toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Bladeren" }))).toBeNull();
    expect(knop(t("activiteit.ontkoppel", { code: "WIS-1" }))).toBeNull();

    // A new activiteit and its content at K3, and only at K3 (R17, R23).
    expect(screen.getAllByRole("button", { name: t("activiteit.toevoegen") })).toHaveLength(1);
    expect(knop(t("activiteit.bewerkAria", { naam: "Eigen spel" }))).not.toBeNull();
    expect(knop(t("activiteit.bekijkAria", { naam: "Tellen" }))).not.toBeNull();
    // No goal links by hand (R19).
    expect(knop(t("activiteit.koppelAan", { naam: "Eigen spel" }))).toBeNull();

    // The maker's delete, while no goal is linked (R25, R33): hers, not a colleague's, and not a linked one.
    expect(knop(t("activiteit.verwijderAria", { naam: "Eigen spel" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Andermans spel" }))).toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Gekoppeld spel" }))).toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).toBeNull();
  });

  it("geeft een hoofdleerkracht van K3 het K3-hoofdstuk helemaal, en het L1-hoofdstuk niet", async () => {
    toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
    await screen.findByText("Bladeren");

    expect(knop(t("subthemabeheer.toevoegen"))).not.toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Bladeren" }))).not.toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Rekenen" }))).toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Bladeren" }))).not.toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Rekenen" }))).toBeNull();
    expect(knop(t("activiteit.koppelAan", { naam: "Andermans spel" }))).not.toBeNull();
    expect(knop(t("activiteit.koppelAan", { naam: "Tellen" }))).toBeNull();
    // Any K3 activiteit, linked or not, whoever made it.
    expect(knop(t("activiteit.verwijderAria", { naam: "Andermans spel" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Gekoppeld spel" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).toBeNull();
    // A hoofdleerkracht edits a thema only with themabeheer.
    expect(knop(t("themabeheer.bewerkAria", { naam: "Herfst" }))).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).toBeNull();
  });

  it("geeft themabeheer het thema, de themadoelen en de doelsuggesties, niet het verwijderen en niet de subthema's", async () => {
    toon(ikMet({ heeftThemabeheer: true }));
    await screen.findByText("Bladeren");

    expect(knop(t("themabeheer.bewerkAria", { naam: "Herfst" }))).not.toBeNull();
    expect(knop(t("doelkiezer.koppel"))).not.toBeNull();
    expect(knop(t("activiteit.ontkoppel", { code: "NED-1" }))).not.toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).not.toBeNull();
    expect(await screen.findByText(SUGGESTIE.aiMotivatie!)).toBeInTheDocument();
    expect(knop(t("thema.aanvaard"))).not.toBeNull();
    expect(knop(t("thema.weiger"))).not.toBeNull();

    // I26 needs a wizard run's state the frontend does not read, so the delete is directie's here.
    expect(knop(t("themabeheer.verwijderAria", { naam: "Herfst" }))).toBeNull();
    // Themabeheer holds nothing on the ordinary subthema and activiteit routes (I22).
    expect(knop(t("subthemabeheer.toevoegen"))).toBeNull();
    expect(knop(t("activiteit.toevoegen"))).toBeNull();
    expect(knop(t("activiteit.bekijkAria", { naam: "Eigen spel" }))).not.toBeNull();
  });

  it("geeft directie alles, ook het verwijderen van het thema", async () => {
    toon(DIRECTIE);
    await screen.findByText("Bladeren");

    expect(knop(t("themabeheer.verwijderAria", { naam: "Herfst" }))).not.toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Rekenen" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).not.toBeNull();
  });

  it("opent een activiteit voor wie haar niet mag aanpassen als feiten, zonder Bewaren", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["L1"] }));
    fireEvent.click(await screen.findByRole("button", { name: t("activiteit.bekijkAria", { naam: "Gekoppeld spel" }) }));

    const blad = await screen.findByRole("dialog");
    expect(within(blad).getByText(t("activiteit.minuten", { aantal: STANDAARDDUUR }))).toBeInTheDocument();
    expect(within(blad).getByText("WO-2")).toBeInTheDocument();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) })).toBeNull();
    expect(within(blad).getByRole("button", { name: t("algemeen.sluiten") })).toBeInTheDocument();
  });

  it("zegt het wanneer de server een oordeel over een doelsuggestie weigert", async () => {
    toon(ikMet({ heeftThemabeheer: true }), { weiger: true });
    fireEvent.click(await screen.findByRole("button", { name: t("thema.aanvaard") }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Je hebt geen toegang tot deze actie.");
  });
});
