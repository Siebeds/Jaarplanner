import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type {
  ActiviteitWeergave,
  DoelMatchResultaat,
  DoelMatchSuggestie,
  ThemaDoelenoverzicht,
  ThemaWeergave,
} from "../../lib/types";
import { t, telWoord } from "../../i18n";
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
  minimumdoelen: [{ id: "tm-1", minimumdoelRef: "K-MD-1" }],
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
      subdoelen: [{ id: "sd-2", leeftijd: "L1", koppeling: koppeling("REK-1") }],
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

function toon(
  ik: Ik,
  opties: {
    weiger?: boolean;
    thema?: ThemaWeergave;
    overzicht?: ThemaDoelenoverzicht;
    /** Answers "Vraag suggesties", given the body it was sent. */
    genereer?: (body: unknown) => Response;
    /** Where the page opens, for a link that asks for one subthema (FB-037). */
    pad?: string;
  } = {},
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        if (opties.genereer && pad.endsWith("/doelsuggesties/genereer")) {
          return opties.genereer(JSON.parse(String(init.body ?? "{}")));
        }
        return opties.weiger
          ? json({ title: "Geen toegang", detail: "Je hebt geen toegang tot deze actie." }, 403)
          : json({});
      }
      if (pad.endsWith("/doelsuggesties")) return json([SUGGESTIE]);
      if (pad.endsWith("/api/jaarfasen")) return json(["JK", "K2", "K3", "L1"]);
      if (pad.endsWith("/api/themas/thema-1/doelenoverzicht")) {
        return json(opties.overzicht ?? { themaId: "thema-1", leeftijden: [] });
      }
      if (pad.endsWith("/api/themas/thema-1")) return json(opties.thema ?? THEMA);
      return json({}, 404);
    }),
  );
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    { ...ik, id: IK_ID },
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opties.pad ?? "/themas/thema-1"]}>
        <Routes>
          <Route path="themas/:themaId" element={<ThemadetailScherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const knop = (naam: string) => screen.queryByRole("button", { name: naam });

/** A chapter's fold button, found by the subthema's name; its summary follows the name in the same label. */
const hoofdstuk = (naam: string, open: boolean) =>
  screen.getByRole("button", { name: new RegExp(`^${naam}`), expanded: open });

/**
 * Opens both chapters. They start shut (FB-011), and on a shut chapter every "this control is absent" check below
 * would pass without testing anything, so the rights tests open them first.
 */
async function openHoofdstukken() {
  await screen.findByText("Bladeren");
  fireEvent.click(hoofdstuk("Bladeren", false));
  fireEvent.click(hoofdstuk("Rekenen", false));
  // The guard: `getByRole` throws unless both are open now, so no absence check below can pass on a shut chapter.
  hoofdstuk("Bladeren", true);
  hoofdstuk("Rekenen", true);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemadetailScherm: doelsuggesties vragen voor gekozen leeftijden (TB-007)", () => {
  const resultaat = (extra: Partial<DoelMatchResultaat> = {}): DoelMatchResultaat => ({
    isGeslaagd: true,
    fout: null,
    bewaard: [SUGGESTIE, { ...SUGGESTIE, id: "sug-2" }, { ...SUGGESTIE, id: "sug-3" }],
    overgeslagenOnbekend: [],
    overgeslagenDuplicaat: [],
    aantalKandidaten: 535,
    jaarFasen: ["K3", "L1"],
    ...extra,
  });

  const leeftijden = () => screen.findByRole("group", { name: t("thema.leeftijdenLabel") });
  const vraag = () => fireEvent.click(screen.getByRole("button", { name: t("thema.suggestiesVragen") }));

  it("duidt de leeftijden van de subthema's aan en vraagt voor precies die leeftijden", async () => {
    const verzonden: unknown[] = [];
    toon(DIRECTIE, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat());
      },
    });

    const groep = await leeftijden();
    expect(within(groep).getByRole("button", { name: "K3" })).toHaveAttribute("aria-pressed", "true");
    expect(within(groep).getByRole("button", { name: "L1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(groep).getByRole("button", { name: "JK" })).toHaveAttribute("aria-pressed", "false");
    expect(within(groep).getByRole("button", { name: "K2" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(t("thema.kiesLeeftijd"))).toBeNull();

    vraag();

    const zin = t("thema.suggestiesNieuw", {
      aantal: 3,
      doelen: t("thema.kandidatenMeer", { aantal: 535 }),
      leeftijden: t("thema.opsommingEn", { eerste: "K3", laatste: "L1" }),
    });
    expect(await screen.findByText(zin)).toBeInTheDocument();
    expect(verzonden).toEqual([{ selectie: { jaarFasen: ["K3", "L1"] } }]);
  });

  it("stuurt een gewijzigde keuze in de volgorde van de jaarfasen, hoe er ook geklikt werd", async () => {
    const verzonden: unknown[] = [];
    toon(DIRECTIE, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat({ jaarFasen: ["K2", "K3"] }));
      },
    });

    const groep = await leeftijden();
    fireEvent.click(within(groep).getByRole("button", { name: "L1" }));
    fireEvent.click(within(groep).getByRole("button", { name: "K2" }));
    expect(within(groep).getByRole("button", { name: "L1" })).toHaveAttribute("aria-pressed", "false");
    vraag();

    await waitFor(() => expect(verzonden).toEqual([{ selectie: { jaarFasen: ["K2", "K3"] } }]));
  });

  it("laat bij een thema zonder subthema's eerst een leeftijd kiezen, en zegt waarom de knop uit staat", async () => {
    const verzonden: unknown[] = [];
    toon(DIRECTIE, {
      thema: { ...THEMA, subthemas: [] },
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat({ bewaard: [], aantalKandidaten: 1, jaarFasen: ["K2"] }));
      },
    });

    const groep = await leeftijden();
    expect(within(groep).queryByRole("button", { pressed: true })).toBeNull();
    expect(screen.getByRole("button", { name: t("thema.suggestiesVragen") })).toBeDisabled();
    expect(screen.getByText(t("thema.kiesLeeftijd"))).toBeInTheDocument();

    fireEvent.click(within(groep).getByRole("button", { name: "K2" }));
    expect(screen.queryByText(t("thema.kiesLeeftijd"))).toBeNull();
    vraag();

    expect(
      await screen.findByText(t("thema.suggestiesGeenNieuwe", { doelen: t("thema.kandidaatEen"), leeftijden: "K2" })),
    ).toBeInTheDocument();
    expect(verzonden).toEqual([{ selectie: { jaarFasen: ["K2"] } }]);
  });

  it("zegt het wanneer er voor de gekozen leeftijden geen doelen geladen zijn", async () => {
    toon(DIRECTIE, { genereer: () => json(resultaat({ bewaard: [], aantalKandidaten: 0 })) });

    await leeftijden();
    vraag();

    expect(
      await screen.findByText(
        t("thema.suggestiesGeenDoelen", { leeftijden: t("thema.opsommingEn", { eerste: "K3", laatste: "L1" }) }),
      ),
    ).toBeInTheDocument();
  });

  it("toont de Nederlandse weigering van de server", async () => {
    const weigering =
      "Deze aanvraag is te groot voor de AI: de tekst van 1.742 doelen is meer dan één aanvraag mag bevatten (ongeveer 91.000 tokens, de grens is 50.000). Kies minder leeftijden.";
    toon(DIRECTIE, { genereer: () => json({ title: "Ongeldige aanvraag", detail: weigering }, 400) });

    await leeftijden();
    vraag();

    expect(await screen.findByText(weigering)).toBeInTheDocument();
  });

  it("toont bij een kapot AI-antwoord de eigen zin, niet de Engelse diagnose", async () => {
    toon(DIRECTIE, { genereer: () => json({ title: "Invalid AI response", detail: "Response is not valid JSON." }, 422) });

    await leeftijden();
    vraag();

    expect(await screen.findByText(t("thema.suggestiesMislukt"))).toBeInTheDocument();
    expect(screen.queryByText("Response is not valid JSON.")).toBeNull();
  });
});

describe("ThemadetailScherm: wie wat mag", () => {
  it("geeft een leerkracht van K3 de activiteiten van K3, en de prullenbak alleen op wat zij zelf maakte zonder doel", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-k3"] }));
    await openHoofdstukken();

    // Not the thema, its themadoelen or the doelsuggesties (R4, R14), nor any subthema (R5, R21) or subdoel (R24).
    expect(knop(t("themabeheer.bewerkAria", { naam: "Herfst" }))).toBeNull();
    expect(knop(t("themabeheer.verwijderAria", { naam: "Herfst" }))).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).toBeNull();
    expect(knop(t("doelkiezer.koppel"))).toBeNull();
    expect(knop(t("thema.minimumdoelKoppelen"))).toBeNull();
    expect(knop(t("thema.minimumdoelOntkoppel", { ref: "K-MD-1" }))).toBeNull();
    expect(screen.queryByText(SUGGESTIE.aiMotivatie!)).toBeNull();
    // She reads which minimumdoelen the thema aims at (FB-043), and no leerplandoel as a themadoel.
    expect(screen.getByRole("button", { name: /K-MD-1/, expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("NED-1")).toBeNull();
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
    await openHoofdstukken();

    expect(knop(t("subthemabeheer.toevoegen"))).not.toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Bladeren" }))).not.toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Rekenen" }))).toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Bladeren" }))).not.toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Rekenen" }))).toBeNull();
    // The subdoel unlink, on a `Gekoppelddoel` row since TB-016: on the K3 subdoel, not on the L1 one (R24).
    expect(knop(t("activiteit.ontkoppel", { code: "WIS-1" }))).not.toBeNull();
    expect(knop(t("activiteit.ontkoppel", { code: "REK-1" }))).toBeNull();
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
    await openHoofdstukken();

    expect(knop(t("themabeheer.bewerkAria", { naam: "Herfst" }))).not.toBeNull();
    // A themadoel is a minimumdoel (FB-043): linked and unlinked here, and no leerplandoel picker on the thema.
    expect(knop(t("thema.minimumdoelKoppelen"))).not.toBeNull();
    expect(knop(t("thema.minimumdoelOntkoppel", { ref: "K-MD-1" }))).not.toBeNull();
    expect(knop(t("doelkiezer.koppel"))).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).not.toBeNull();
    // It calls the model, so it wears the AI ring (ADR-0039).
    expect(knop(t("thema.suggestiesVragen"))).toHaveClass("knop-ai");
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
    await openHoofdstukken();

    expect(knop(t("themabeheer.verwijderAria", { naam: "Herfst" }))).not.toBeNull();
    expect(knop(t("subthemabeheer.bewerkAria", { naam: "Rekenen" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).not.toBeNull();
  });

  it("opent een activiteit voor wie haar niet mag aanpassen als feiten, zonder Bewaren", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["L1"] }));
    await openHoofdstukken();
    fireEvent.click(screen.getByRole("button", { name: t("activiteit.bekijkAria", { naam: "Gekoppeld spel" }) }));

    const blad = await screen.findByRole("dialog");
    expect(
      within(blad).getByText(t("activiteit.duurFeit", { lesuren: t("activiteit.eenLesuur"), minuten: STANDAARDDUUR })),
    ).toBeInTheDocument();
    expect(within(blad).getByText("WO-2")).toBeInTheDocument();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) })).toBeNull();
    expect(within(blad).getByRole("button", { name: t("algemeen.sluiten") })).toBeInTheDocument();
  });

  // Fix round 1, F2: the empty thema is the one I26 case the thema read carries, and the server lets themabeheer
  // delete it (`HeeftAndermansInhoud` false, no linked leeftijd).
  it("geeft themabeheer de prullenbak op een leeg thema, zoals de server", async () => {
    toon(ikMet({ heeftThemabeheer: true }), { thema: { ...THEMA, themadoelen: [], subthemas: [] } });

    expect(
      await screen.findByRole("button", { name: t("themabeheer.verwijderAria", { naam: "Herfst" }) }),
    ).toBeInTheDocument();
  });

  // Fix round 1, F4: a form left open with no leeftijd to offer is a Bewaren that can only be refused, and it used to
  // blame the loading. When the rights go, the form goes.
  it("sluit het subthemaformulier wanneer er geen leeftijd meer is om het te maken", async () => {
    const client = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
    fireEvent.click(await screen.findByRole("button", { name: t("subthemabeheer.toevoegen") }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Awaited for one task: TanStack Query hands `setQueryData` to its observers on the next one.
    await act(async () => {
      client.setQueryData(["ik"], { ...ikMet({}), id: IK_ID });
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText(t("klasbeheer.leeftijdenOnbekend"))).toBeNull();
  });

  it("zegt het wanneer de server een oordeel over een doelsuggestie weigert", async () => {
    toon(ikMet({ heeftThemabeheer: true }), { weiger: true });
    fireEvent.click(await screen.findByRole("button", { name: t("thema.aanvaard") }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Je hebt geen toegang tot deze actie.");
  });
});

describe("ThemadetailScherm: subthema's staan ingeklapt (FB-011)", () => {
  it("toont elk subthema ingeklapt, met zijn samenvatting in plaats van zijn lijsten", async () => {
    toon(DIRECTIE);
    await screen.findByText("Bladeren");

    const bladeren = hoofdstuk("Bladeren", false);
    expect(hoofdstuk("Rekenen", false)).toBeInTheDocument();
    expect(within(bladeren).getByText(telWoord(3, "thema.eenActiviteit", "thema.activiteiten"))).toBeInTheDocument();
    // Its one subdoel, WIS-1, is on none of its activiteiten (FB-010 wrote this figure).
    expect(within(bladeren).getByText(t("thema.subdoelInActiviteitEen", { aantal: 0 }))).toBeInTheDocument();
    expect(screen.queryByText("Eigen spel")).toBeNull();
    expect(screen.queryByText("Tellen")).toBeNull();
  });

  // The fold is a native button (`getByRole` above finds it with `aria-expanded`), which answers Enter and Space by
  // itself; jsdom does not turn a key press into a click, so the keyboard half is checked in the browser pass.
  it("klapt één subthema open met een klik, en bij een tweede klik weer in", async () => {
    toon(DIRECTIE);
    await screen.findByText("Bladeren");

    fireEvent.click(hoofdstuk("Bladeren", false));
    expect(screen.getByText("Eigen spel")).toBeInTheDocument();
    expect(hoofdstuk("Rekenen", false)).toBeInTheDocument();
    expect(screen.queryByText("Tellen")).toBeNull();

    fireEvent.click(hoofdstuk("Bladeren", true));
    expect(screen.queryByText("Eigen spel")).toBeNull();
  });
});

describe("ThemadetailScherm: een link vanuit de agenda opent één subthema (FB-037)", () => {
  it("klapt het gevraagde subthema open, geeft zijn knop de focus en laat de andere ingeklapt", async () => {
    toon(DIRECTIE, { pad: "/themas/thema-1?subthema=s-l1" });
    await screen.findByText("Rekenen");

    const rekenen = await waitFor(() => hoofdstuk("Rekenen", true));
    expect(rekenen).toHaveFocus();
    expect(screen.getByText("Tellen")).toBeInTheDocument();
    expect(hoofdstuk("Bladeren", false)).toBeInTheDocument();
  });

  it("opent niets voor een subthema dat niet bij dit thema hoort", async () => {
    toon(DIRECTIE, { pad: "/themas/thema-1?subthema=elders" });
    await screen.findByText("Rekenen");

    expect(hoofdstuk("Rekenen", false)).toBeInTheDocument();
    expect(hoofdstuk("Bladeren", false)).toBeInTheDocument();
  });
});

describe("ThemadetailScherm: welke subdoelen al een activiteit hebben (FB-010)", () => {
  // Three subdoelen: one on two activiteiten, one on one, one on none; and an activiteit doel that is no subdoel.
  const MET_DRAGERS: ThemaWeergave = {
    ...THEMA,
    subthemas: [
      {
        ...THEMA.subthemas[0],
        subdoelen: [
          { id: "sd-a", leeftijd: "K3", koppeling: koppeling("WIS-1") },
          { id: "sd-b", leeftijd: "K3", koppeling: koppeling("WIS-2") },
          { id: "sd-c", leeftijd: "K3", koppeling: koppeling("WIS-3") },
        ],
        activiteiten: [
          activiteit("a-1", "Tellen met bladeren", { doelkoppelingen: [koppeling("WIS-1"), koppeling("WIS-2")] }),
          activiteit("a-2", "Bladeren wegen", { doelkoppelingen: [koppeling("WIS-1"), koppeling("NED-9")] }),
        ],
      },
    ],
  };

  /** The rows of one Subkop in the open chapter, found by its heading. */
  const groep = (titel: string) => screen.getByRole("heading", { name: titel }).closest("section")!;
  // The doel row's own button: the remove control beside it names the code too, but in an `aria-label`.
  const rij = (sectie: HTMLElement, code: string) => {
    const knoppen = within(sectie).getAllByRole("button", { name: new RegExp(code) });
    const regel = knoppen.find((k) => !k.hasAttribute("aria-label"));
    if (!regel) throw new Error(`no doel row for ${code}`);
    return regel;
  };

  it("toont bij elk subdoel zijn activiteiten, en markeert een subdoel zonder activiteit met tekst", async () => {
    toon(DIRECTIE, { thema: MET_DRAGERS });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    const subdoelen = groep(t("thema.subdoelenTitel"));
    expect(rij(subdoelen, "WIS-1")).toHaveTextContent(
      t("thema.inActiviteiten", { aantal: 2, namen: "Tellen met bladeren, Bladeren wegen" }),
    );
    expect(rij(subdoelen, "WIS-2")).toHaveTextContent(t("thema.inEenActiviteit", { namen: "Tellen met bladeren" }));
    expect(rij(subdoelen, "WIS-3")).toHaveTextContent(t("thema.nogGeenActiviteit"));
    expect(rij(subdoelen, "WIS-1")).not.toHaveTextContent(t("thema.nogGeenActiviteit"));
  });

  it("zet een doel van een activiteit dat geen subdoel is apart, met die activiteit", async () => {
    toon(DIRECTIE, { thema: MET_DRAGERS });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    const andere = groep(t("thema.andereDoelenTitel"));
    expect(rij(andere, "NED-9")).toHaveTextContent(t("thema.inEenActiviteit", { namen: "Bladeren wegen" }));
    expect(within(andere).queryByRole("button", { name: /WIS-/ })).toBeNull();
  });

  it("vat een ingeklapt subthema samen met hoeveel subdoelen al in een activiteit zitten", async () => {
    toon(DIRECTIE, { thema: MET_DRAGERS });
    await screen.findByText("Bladeren");

    expect(
      within(hoofdstuk("Bladeren", false)).getByText(t("thema.subdoelenInActiviteit", { aantal: 2, totaal: 3 })),
    ).toBeInTheDocument();
  });

  it("geeft een subthema zonder subdoelen de gewone telling", async () => {
    toon(DIRECTIE, { thema: { ...THEMA, subthemas: [{ ...THEMA.subthemas[0], subdoelen: [] }] } });
    await screen.findByText("Bladeren");

    expect(
      within(hoofdstuk("Bladeren", false)).getByText(telWoord(0, "thema.eenSubdoel", "thema.subdoelen")),
    ).toBeInTheDocument();
  });

  it("toont geen groep andere doelen wanneer elk doel van een activiteit een subdoel is", async () => {
    const alleenSubdoelen: ThemaWeergave = {
      ...MET_DRAGERS,
      subthemas: [
        {
          ...MET_DRAGERS.subthemas[0],
          activiteiten: [activiteit("a-1", "Tellen met bladeren", { doelkoppelingen: [koppeling("WIS-1")] })],
        },
      ],
    };
    toon(DIRECTIE, { thema: alleenSubdoelen });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    // The chapter is open: its subdoelen are on screen, and only the other group is absent.
    expect(groep(t("thema.subdoelenTitel"))).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: t("thema.andereDoelenTitel") })).toBeNull();
  });

  it("markeert een subdoel dat nog niet beslist is niet als gat", async () => {
    const voorgesteld: ThemaWeergave = {
      ...MET_DRAGERS,
      subthemas: [
        {
          ...MET_DRAGERS.subthemas[0],
          subdoelen: [{ id: "sd-v", leeftijd: "K3", koppeling: { ...koppeling("WIS-7"), status: "Voorgesteld" } }],
          activiteiten: [],
        },
      ],
    };
    toon(DIRECTIE, { thema: voorgesteld });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    const regel = rij(groep(t("thema.subdoelenTitel")), "WIS-7");
    expect(regel).not.toHaveTextContent(t("thema.nogGeenActiviteit"));
  });
});

describe("ThemadetailScherm: doelen per leeftijd (FB-009)", () => {
  const OVERZICHT: ThemaDoelenoverzicht = {
    themaId: "thema-1",
    leeftijden: [
      {
        leeftijd: "K3",
        leerplandoelen: [
          {
            code: "WIS-1",
            doelsoort: "Gemeenschappelijk",
            tekst: "Tellen tot tien",
            nietMeerInOpstap: false,
            minimumdoelRef: "K-7",
            plaatsen: [
              { soort: "Subdoel", naam: "Bladeren" },
              { soort: "Activiteit", naam: "Eigen spel" },
              { soort: "Activiteit", naam: "Andermans spel" },
            ],
          },
          {
            code: "NED-1",
            doelsoort: "Gemeenschappelijk",
            tekst: "Luisteren naar een verhaal",
            nietMeerInOpstap: false,
            minimumdoelRef: null,
            plaatsen: [{ soort: "Themadoel", naam: null }],
          },
        ],
        minimumdoelen: [{ ref: "K-7", leeftijd: "K-", nr: "7", omschrijving: "Getallen tot tien", leerplandoelen: ["WIS-1"] }],
      },
    ],
  };

  const leeftijdrij = () => screen.findByRole("button", { name: /^K3/, expanded: false });
  const groep = (titel: string) => screen.getByRole("heading", { name: titel }).closest("section")!;

  it("toont per leeftijd een ingeklapte rij met hoeveel leerplandoelen en minimumdoelen", async () => {
    toon(DIRECTIE, { overzicht: OVERZICHT });

    const rij = await leeftijdrij();
    expect(rij).toHaveTextContent(telWoord(2, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen"));
    expect(rij).toHaveTextContent(telWoord(1, "thema.overzichtEenMinimumdoel", "thema.overzichtMinimumdoelen"));
    expect(screen.queryByRole("heading", { name: t("thema.overzichtLeerplandoelenTitel") })).toBeNull();
  });

  it("toont opengeklapt waar elk leerplandoel hangt, en langs welke leerplandoelen een minimumdoel bereikt wordt", async () => {
    toon(DIRECTIE, { overzicht: OVERZICHT });
    fireEvent.click(await leeftijdrij());

    const leerplandoelen = groep(t("thema.overzichtLeerplandoelenTitel"));
    const plaatsen = [
      t("thema.plaatsSubdoel", { naam: "Bladeren" }),
      telWoord(2, "thema.plaatsEenActiviteit", "thema.plaatsActiviteiten"),
    ].join(", ");
    expect(within(leerplandoelen).getByRole("button", { name: /WIS-1/ })).toHaveTextContent(
      t("thema.overzichtVia", { lijst: plaatsen }),
    );
    expect(within(leerplandoelen).getByRole("button", { name: /NED-1/ })).toHaveTextContent(
      t("thema.overzichtVia", { lijst: t("thema.plaatsThemadoel") }),
    );
    expect(within(groep(t("thema.overzichtMinimumdoelenTitel"))).getByRole("button", { name: /K-7/ })).toHaveTextContent(
      t("thema.overzichtVia", { lijst: "WIS-1" }),
    );
  });

  it("opent een minimumdoel in het detailblad", async () => {
    toon(DIRECTIE, { overzicht: OVERZICHT });
    fireEvent.click(await leeftijdrij());

    fireEvent.click(within(groep(t("thema.overzichtMinimumdoelenTitel"))).getByRole("button", { name: /K-7/ }));

    expect(await screen.findByRole("dialog", { name: t("minimumdoel.titel") })).toBeInTheDocument();
  });

  it("noemt een aanvaarde doelsuggestie zo, en zegt het wanneer geen leerplandoel naar een minimumdoel leidt", async () => {
    toon(DIRECTIE, {
      overzicht: {
        themaId: "thema-1",
        leeftijden: [
          {
            leeftijd: "K3",
            leerplandoelen: [
              {
                code: "TAAL-2",
                doelsoort: "Gemeenschappelijk",
                tekst: "Een prentenboek navertellen",
                nietMeerInOpstap: false,
                minimumdoelRef: null,
                plaatsen: [{ soort: "Doelsuggestie", naam: null }],
              },
            ],
            minimumdoelen: [],
          },
        ],
      },
    });
    fireEvent.click(await leeftijdrij());

    const regel = within(groep(t("thema.overzichtLeerplandoelenTitel"))).getByRole("button", { name: /TAAL-2/ });
    expect(regel).toHaveTextContent(t("thema.overzichtVia", { lijst: t("thema.plaatsDoelsuggestie") }));
    expect(regel).not.toHaveTextContent(t("thema.plaatsThemadoel"));
    expect(within(groep(t("thema.overzichtMinimumdoelenTitel"))).getByText(t("thema.overzichtGeenMinimumdoel")))
      .toBeInTheDocument();
  });

  it("toont geen blok zolang het thema geen beslist gekoppelde doelen heeft", async () => {
    toon(DIRECTIE);
    await screen.findByText("Bladeren");

    // First that the overview was asked for at all, so the absence below is an answer and not a component never mounted.
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([pad]) => String(pad).endsWith("/doelenoverzicht"))).toBe(true),
    );
    // It shows its heading while loading, so this waits until the answer (no leeftijden) has removed it.
    await waitFor(() => expect(screen.queryByRole("heading", { name: t("thema.overzichtTitel") })).toBeNull());
  });
});

describe("ThemadetailScherm: een activiteit toont het aantal doelen, niet hun codes (FB-046)", () => {
  const MET_DOELEN: ThemaWeergave = {
    ...THEMA,
    subthemas: [
      {
        ...THEMA.subthemas[0],
        subdoelen: [],
        activiteiten: [
          activiteit("a-3", "Drie doelen", {
            doelkoppelingen: [koppeling("WIS-11"), koppeling("WIS-12"), koppeling("NED-13")],
          }),
          activiteit("a-1", "Een doel", { doelkoppelingen: [koppeling("WIS-14")] }),
          activiteit("a-0", "Geen doel"),
        ],
      },
    ],
  };

  /** One activiteit row: the box that holds its opening overlay. */
  const regel = (naam: string) =>
    screen.getByRole("button", { name: t("activiteit.bekijkAria", { naam }) }).parentElement!;

  async function open(ik: Ik = DIRECTIE) {
    toon(ik, { thema: MET_DOELEN });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
  }

  it("telt de doelen in het meervoud en in het enkelvoud, zonder een doelcode", async () => {
    await open(ikMet({}));

    expect(regel("Drie doelen")).toHaveTextContent(telWoord(3, "activiteit.eenDoel", "activiteit.aantalDoelen"));
    expect(regel("Een doel")).toHaveTextContent(telWoord(1, "activiteit.eenDoel", "activiteit.aantalDoelen"));
    expect(regel("Een doel")).toHaveTextContent("1 doel");
    for (const naam of ["Drie doelen", "Een doel", "Geen doel"]) {
      expect(regel(naam)).not.toHaveTextContent(/WIS-|NED-/);
    }
  });

  it("maakt een activiteit zonder doel herkenbaar met tekst", async () => {
    await open(ikMet({}));

    expect(regel("Geen doel")).toHaveTextContent(t("activiteit.geenDoel"));
    expect(regel("Drie doelen")).not.toHaveTextContent(t("activiteit.geenDoel"));
  });

  it("laat de hoofdleerkracht in de regel nog een doel koppelen", async () => {
    await open(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));

    expect(knop(t("activiteit.koppelAan", { naam: "Drie doelen" }))).not.toBeNull();
    expect(screen.getAllByText(telWoord(3, "activiteit.eenDoel", "activiteit.aantalDoelen"))).not.toHaveLength(0);
  });
});
