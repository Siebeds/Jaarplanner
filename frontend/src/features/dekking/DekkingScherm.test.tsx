import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DekkingWeergave, LeerplandoelDekking, MinimumdoelDekking } from "../../lib/types";
import type { Ik } from "../../lib/aanmelding";
import { t } from "../../i18n";
import { ADMIN, NIEMAND, ikMet, metIk } from "../../test/rechten";
import { DekkingScherm } from "./DekkingScherm";

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: null,
    klasId: "klas-1",
    schooljaarId: "jaar-1",
    schooljaar: null,
    schooljaren: [],
    klassen: [],
    laadt: false,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

const doel = (code: string, delen: Partial<LeerplandoelDekking> = {}): LeerplandoelDekking => ({
  code,
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  disciplineNummer: "2",
  disciplineNaam: "Wiskunde",
  domein: "Getallen",
  subdomein: "Tellen",
  tekst: `Tekst van ${code}`,
  minimumdoelRef: null,
  nietMeerInOpstap: false,
  isGedekt: false,
  dekkendeThemas: [],
  dekkendeFiches: [],
  oorzaak: "GeenThema",
  kandidaatThemas: [],
  stap: "Geen",
  prognoseBronnen: [],
  ...delen,
});

/**
 * Wiskunde 1 of 3 covered, Muzische vorming 0 of 2: so Muzische vorming is the least covered.
 * Two doelsoorten, because the doelsoort filter (FB-080) narrows to one of them: MD holds W1 (gedekt) and M1 (no
 * thema), so narrowing to it moves every figure on the screen.
 */
const DOELEN: LeerplandoelDekking[] = [
  doel("W1", { doelsoort: "Minimumdoel", isGedekt: true, dekkendeThemas: ["Plassen (Herfst)"], oorzaak: null, stap: "Gedekt" }),
  doel("W2", { oorzaak: "NietIngepland", kandidaatThemas: ["Sneeuw (Winter)"], stap: "Prognose", prognoseBronnen: ["Sneeuw (Winter)"] }),
  doel("W3", {
    domein: "Meten",
    oorzaak: "NietIngepland",
    kandidaatThemas: ["Sneeuw (Winter)"],
    stap: "Prognose",
    prognoseBronnen: ["Sneeuw (Winter)"],
  }),
  doel("M1", { doelsoort: "Minimumdoel", disciplineNummer: "6", disciplineNaam: "Muzische vorming", domein: "Beeld" }),
  doel("M2", {
    disciplineNummer: "6",
    disciplineNaam: "Muzische vorming",
    domein: "Beeld",
    oorzaak: "KoppelingNietBeslist",
    kandidaatThemas: ["Herfst"],
  }),
];

const minimumdoel = (ref: string, delen: Partial<MinimumdoelDekking> = {}): MinimumdoelDekking => ({
  ref,
  leeftijd: "K-",
  nr: "1",
  omschrijving: `Tekst van ${ref}`,
  leergebied: "Wiskunde",
  rubriek: "Getallen",
  subrubriek: null,
  nietMeerInOpstap: false,
  stap: "Geen",
  isGedekt: false,
  prognoseThemas: [],
  dekkendeThemas: [],
  oorzaak: "GeenThema",
  kandidaatThemas: [],
  ...delen,
});

/** One gedekt, one in the prognose waiting on a thema, one on no thema. */
const MINIMUMDOELEN: MinimumdoelDekking[] = [
  minimumdoel("K-1", { stap: "Gedekt", isGedekt: true, prognoseThemas: ["Herfst"], dekkendeThemas: ["Herfst"], oorzaak: null }),
  minimumdoel("K-2", { stap: "Prognose", prognoseThemas: ["Winter"], oorzaak: "NietIngepland", kandidaatThemas: ["Winter"] }),
  minimumdoel("K-3", { leergebied: "Nederlands" }),
];

const weergave = (delen: Partial<DekkingWeergave> = {}): DekkingWeergave => ({
  klasId: "klas-1",
  klasNaam: "K3 groen",
  schooljaarId: "jaar-1",
  schooljaarNaam: "2026-2027",
  bereik: "EigenJaarFase",
  gemetenJaarFasen: ["K3"],
  beschikbareJaarFasen: ["K3"],
  isTerugvalNaarHeelCurriculum: false,
  aantalBuitenBereik: 0,
  isBetrouwbaar: true,
  aantalOnopgelosteVervallenPlaatsingen: 0,
  aantalGedekt: 1,
  aantalLeerplandoelen: DOELEN.length,
  doelen: DOELEN,
  aantalInPrognose: 2,
  aantalMinimumdoelenGedekt: 1,
  aantalMinimumdoelenInPrognose: 1,
  aantalMinimumdoelen: MINIMUMDOELEN.length,
  minimumdoelen: MINIMUMDOELEN,
  ...delen,
});

let antwoord: DekkingWeergave = weergave();

beforeEach(() => {
  antwoord = weergave();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string) =>
      new URL(String(pad), "http://localhost").pathname === "/api/klassen/klas-1/dekking"
        ? new Response(JSON.stringify(antwoord), { status: 200, headers: { "Content-Type": "application/json" } })
        : new Response("{}", { status: 404 }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function toon(ik: Ik = ADMIN) {
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  const gevolg = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DekkingScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("radio", { name: t("dekking.minimumdoelen") });
  return gevolg;
}

/** The leerplandoel level, where the TB-022 cases below live. */
async function toonLeerplandoelen(ik: Ik = ADMIN) {
  const gevolg = await toon(ik);
  fireEvent.click(screen.getByRole("radio", { name: t("dekking.leerplandoelen") }));
  return gevolg;
}

const disciplineknop = (naam: string) => screen.getByRole("button", { name: new RegExp(`^${naam}`) });
const actielijst = () => screen.getByRole("region", { name: t("dekking.acties") });

describe("DekkingScherm: dekkingsprognose en dekking (FB-045)", () => {
  it("toont per niveau hoeveel gedekt en hoeveel in de prognose staat, met woorden bij de balk", async () => {
    await toon();

    expect(
      screen.getByText(
        t("dekking.meterAria", { soort: t("dekking.minimumdoelen"), gedekt: 1, totaal: 3, deel: 33, prognose: 1 }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        t("dekking.meterAria", { soort: t("dekking.leerplandoelen"), gedekt: 1, totaal: 5, deel: 20, prognose: 2 }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(t("dekking.stapPrognose"))).toBeInTheDocument();
  });

  it("opent op de minimumdoelen, per leergebied, met per doel zijn stap in woorden", async () => {
    await toon();

    expect(screen.getByRole("radio", { name: t("dekking.minimumdoelen") })).toHaveAttribute("aria-checked", "true");
    // Nog te doen: Nederlands and Wiskunde both hold a gap.
    fireEvent.click(screen.getByRole("button", { name: /^Wiskunde/ }));
    expect(screen.queryByText("Tekst van K-1")).toBeNull();
    expect(screen.getByText("Tekst van K-2")).toBeInTheDocument();
    expect(screen.getByText(t("dekking.prognoseVia", { bronnen: "Winter" }))).toBeInTheDocument();
    expect(screen.getAllByText(t("dekking.stapPrognose")).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: /^Nederlands/ }));
    expect(screen.getByText(t("dekking.oorzaakMinimumdoelGeenThema"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleDoelen") }));
    expect(screen.getByText(t("dekking.gedektDoor", { bronnen: "Herfst" }))).toBeInTheDocument();
  });

  it("stuurt een minimumdoel dat op een thema wacht naar de periodes, en telt de minimumdoelen zonder thema", async () => {
    await toon(ADMIN);

    const link = within(actielijst()).getByRole("link", { name: t("dekking.actieInplannen", { thema: "Winter" }) });
    expect(link).toHaveAttribute("href", "/agenda/periodes");
    expect(within(actielijst()).getByText(t("dekking.zonderThemaMinimumdoelEen"))).toBeInTheDocument();
  });

  it("stuurt een leerplandoel dat op een subthema wacht naar de agenda", async () => {
    await toonLeerplandoelen(ADMIN);

    const link = within(actielijst()).getByRole("link", { name: t("dekking.actieInplannen", { thema: "Sneeuw (Winter)" }) });
    expect(link).toHaveAttribute("href", "/agenda");
  });
});

describe("DekkingScherm (TB-022)", () => {
  it("opent op Nog te doen, met één dichte rij per discipline en de minst gedekte bovenaan", async () => {
    await toonLeerplandoelen();

    expect(screen.getByRole("radio", { name: t("dekking.nogTeDoen") })).toHaveAttribute("aria-checked", "true");

    const knoppen = screen.getAllByRole("button", { expanded: false });
    expect(knoppen.map((knop) => knop.textContent)).toEqual([
      expect.stringMatching(/^Muzische vorming/),
      expect.stringMatching(/^Wiskunde/),
    ]);
    expect(screen.queryByText("Tekst van W2")).toBeNull();
  });

  it("houdt de teller van een discipline gelijk bij het wisselen van weergave", async () => {
    await toonLeerplandoelen();
    const telling = t("dekking.groepTelling", { gedekt: 1, totaal: 3, deel: 33, prognose: 2 });

    expect(within(disciplineknop("Wiskunde")).getByText(telling)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleDoelen") }));
    expect(within(disciplineknop("Wiskunde")).getByText(telling)).toBeInTheDocument();
  });

  it("toont na openklikken de domeinen en per ontbrekend doel de reden, en verbergt gedekte doelen onder Nog te doen", async () => {
    await toonLeerplandoelen();
    fireEvent.click(disciplineknop("Wiskunde"));

    expect(disciplineknop("Wiskunde")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: /^Getallen/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Meten/ })).toBeInTheDocument();
    expect(screen.getByText("Tekst van W2")).toBeInTheDocument();
    expect(screen.getAllByText(t("dekking.prognoseVia", { bronnen: "Sneeuw (Winter)" }))).toHaveLength(2);
    expect(screen.queryByText("Tekst van W1")).toBeNull();
  });

  it("zet de acties per thema bovenaan, met links naar de kalender en naar Thema's voor admin", async () => {
    await toonLeerplandoelen(ADMIN);

    const link = within(actielijst()).getByRole("link", { name: t("dekking.actieInplannen", { thema: "Sneeuw (Winter)" }) });
    expect(link).toHaveAttribute("href", "/agenda");
    expect(within(actielijst()).getByText(t("dekking.winst", { aantal: 2 }))).toBeInTheDocument();
    expect(within(actielijst()).getByText(t("dekking.onbeslistEen"))).toBeInTheDocument();
    expect(within(actielijst()).getByRole("link", { name: t("dekking.naarThemas") })).toHaveAttribute("href", "/themas");
    expect(within(actielijst()).getByText(t("dekking.zonderThemaEen"))).toBeInTheDocument();
  });

  it("geeft een leerkracht van deze klas de kalenderlinks, maar niet de link naar Thema's zonder beoordelingsrecht", async () => {
    await toonLeerplandoelen(ikMet({ eigenKlasIds: ["klas-1"] }));

    expect(
      within(actielijst()).getByRole("link", { name: t("dekking.actieInplannen", { thema: "Sneeuw (Winter)" }) }),
    ).toBeInTheDocument();
    expect(within(actielijst()).getByText(t("dekking.onbeslistEen"))).toBeInTheDocument();
    expect(within(actielijst()).queryByRole("link", { name: t("dekking.naarThemas") })).toBeNull();
  });

  it("toont de acties zonder link aan wie de planning van deze klas niet mag bewerken", async () => {
    await toonLeerplandoelen(NIEMAND);

    expect(within(actielijst()).getByText(t("dekking.actieInplannen", { thema: "Sneeuw (Winter)" }))).toBeInTheDocument();
    expect(within(actielijst()).queryByRole("link")).toBeNull();
  });

  it("toont geen enkele teller en geen acties zolang het cijfer ingehouden wordt, maar wel de reden per doel", async () => {
    antwoord = weergave({
      isBetrouwbaar: false,
      aantalOnopgelosteVervallenPlaatsingen: 1,
      aantalGedekt: null,
      aantalInPrognose: null,
      aantalMinimumdoelenGedekt: null,
      aantalMinimumdoelenInPrognose: null,
    });
    const { container } = await toonLeerplandoelen();

    expect(screen.queryByRole("region", { name: t("dekking.acties") })).toBeNull();
    expect(screen.queryByText(/van \d+ gedekt/)).toBeNull();
    expect(screen.getByText(t("dekking.geenCijfer"))).toBeInTheDocument();

    fireEvent.click(disciplineknop("Wiskunde"));
    expect(screen.getAllByText(t("dekking.prognoseVia", { bronnen: "Sneeuw (Winter)" }))).toHaveLength(2);

    // Nothing a figure could hide in either: no fraction, no percentage, and nothing in an attribute.
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(container.textContent).not.toMatch(/\d+\s*%/);
    for (const element of container.querySelectorAll("[aria-label], [title]")) {
      expect(`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""}`).not.toMatch(/\d/);
    }
  });
});

describe("DekkingScherm: per discipline, met de doelsoortfilter (FB-080)", () => {
  const soortenfilter = () => screen.getByRole("radiogroup", { name: t("dekking.doelsoort") });
  const soortknop = (soort: string) =>
    within(soortenfilter()).getByRole("radio", { name: new RegExp(`^${soort}`) });

  it("toont per discipline een aantal en een percentage, voor de dekking en voor de prognose", async () => {
    await toonLeerplandoelen();

    // Wiskunde: 1 van 3 gedekt, 2 in de prognose. Muzische vorming: 0 van 2, 0 in de prognose.
    expect(within(disciplineknop("Wiskunde")).getByText("33% gedekt · 2 in prognose")).toBeInTheDocument();
    expect(
      within(disciplineknop("Wiskunde")).getByText(t("dekking.groepTelling", { gedekt: 1, totaal: 3, deel: 33, prognose: 2 })),
    ).toBeInTheDocument();
    expect(within(disciplineknop("Muzische vorming")).getByText("0% gedekt · 0 in prognose")).toBeInTheDocument();
  });

  it("laat de disciplines optellen tot het totaal dat de meter toont", async () => {
    await toonLeerplandoelen();

    const tellingen = screen
      .getAllByRole("button", { expanded: false })
      .map((knop) => /(\d+) van (\d+) gedekt \((\d+)%\), (\d+) in/.exec(knop.textContent ?? ""))
      .map((gevonden) => (gevonden ?? []).slice(1).map(Number));

    expect(tellingen).toHaveLength(2);
    const som = (kolom: number) => tellingen.reduce((totaal, rij) => totaal + rij[kolom], 0);
    expect([som(0), som(1), som(3)]).toEqual([
      antwoord.aantalGedekt,
      antwoord.aantalLeerplandoelen,
      antwoord.aantalInPrognose,
    ]);
  });

  it("laat de cijfers de gekozen doelsoort volgen, bovenaan en per discipline, en zegt bovenaan welke soort", async () => {
    await toonLeerplandoelen();
    fireEvent.click(soortknop(t("doelsoort.Minimumdoel")));

    // Alleen W1 (gedekt, Wiskunde) en M1 (nergens, Muzische vorming) zijn minimumdoelen: 1 van 2.
    expect(
      screen.getByText(
        t("dekking.meterAria", {
          soort: t("dekking.leerplandoelenSoort", { soort: t("doelsoort.Minimumdoel") }),
          gedekt: 1,
          totaal: 2,
          deel: 50,
          prognose: 0,
        }),
      ),
    ).toBeInTheDocument();
    expect(within(disciplineknop("Muzische vorming")).getByText("0% gedekt · 0 in prognose")).toBeInTheDocument();
    expect(screen.getByText(t("dekking.soortMinimumdoel"))).toBeInTheDocument();

    // Wiskunde houdt onder Nog te doen geen enkel ontbrekend minimumdoel over, dus staat het bij Alle doelen.
    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleDoelen") }));
    expect(within(disciplineknop("Wiskunde")).getByText("100% gedekt · 0 in prognose")).toBeInTheDocument();

    // En terug: Alle soorten geeft de volle cijfers.
    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleSoorten") }));
    expect(within(disciplineknop("Wiskunde")).getByText("33% gedekt · 2 in prognose")).toBeInTheDocument();
  });

  it("laat 'Nog te doen' de cijfers met rust, want die verandert alleen wat er staat", async () => {
    await toonLeerplandoelen();
    const telling = "33% gedekt · 2 in prognose";

    expect(within(disciplineknop("Wiskunde")).getByText(telling)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleDoelen") }));
    expect(within(disciplineknop("Wiskunde")).getByText(telling)).toBeInTheDocument();
  });

  it("toont na het openklikken van een discipline zowel het gedekte doel als wat ontbreekt", async () => {
    await toonLeerplandoelen();
    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleDoelen") }));
    fireEvent.click(disciplineknop("Wiskunde"));

    expect(screen.getByText("Tekst van W1")).toBeInTheDocument();
    expect(screen.getByText(t("dekking.gedektDoor", { bronnen: "Plassen (Herfst)" }))).toBeInTheDocument();
    expect(screen.getByText("Tekst van W2")).toBeInTheDocument();
    expect(screen.getByText("Tekst van W3")).toBeInTheDocument();
    expect(screen.queryByText("Tekst van M1")).toBeNull();
  });

  it("laat de doelsoortfilter met het niveau meegaan, zodat geen onzichtbare keuze het cijfer stuurt", async () => {
    await toonLeerplandoelen();
    fireEvent.click(soortknop(t("doelsoort.Minimumdoel")));

    fireEvent.click(screen.getByRole("radio", { name: t("dekking.minimumdoelen") }));
    expect(screen.queryByRole("radiogroup", { name: t("dekking.doelsoort") })).toBeNull();
    expect(
      screen.getByText(
        t("dekking.meterAria", { soort: t("dekking.leerplandoelen"), gedekt: 1, totaal: 5, deel: 20, prognose: 2 }),
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: t("dekking.leerplandoelen") }));
    expect(screen.getByRole("radio", { name: t("dekking.alleSoorten") })).toHaveAttribute("aria-checked", "true");
  });
});
