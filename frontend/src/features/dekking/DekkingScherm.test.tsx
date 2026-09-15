import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DekkingWeergave, LeerplandoelDekking } from "../../lib/types";
import type { Ik } from "../../lib/aanmelding";
import { t } from "../../i18n";
import { DIRECTIE, NIEMAND, ikMet, metIk } from "../../test/rechten";
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
  ...delen,
});

/** Wiskunde 1 of 3 covered, Muzische vorming 0 of 2: so Muzische vorming is the least covered. */
const DOELEN: LeerplandoelDekking[] = [
  doel("W1", { isGedekt: true, dekkendeThemas: ["Herfst"], oorzaak: null }),
  doel("W2", { oorzaak: "NietIngepland", kandidaatThemas: ["Winter"] }),
  doel("W3", { domein: "Meten", oorzaak: "NietIngepland", kandidaatThemas: ["Winter"] }),
  doel("M1", { disciplineNummer: "6", disciplineNaam: "Muzische vorming", domein: "Beeld" }),
  doel("M2", {
    disciplineNummer: "6",
    disciplineNaam: "Muzische vorming",
    domein: "Beeld",
    oorzaak: "KoppelingNietBeslist",
    kandidaatThemas: ["Herfst"],
  }),
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

async function toon(ik: Ik = DIRECTIE) {
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  const gevolg = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DekkingScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText(t("dekking.gedekteDoelen"));
  return gevolg;
}

const disciplineknop = (naam: string) => screen.getByRole("button", { name: new RegExp(`^${naam}`) });
const actielijst = () => screen.getByRole("region", { name: t("dekking.acties") });

describe("DekkingScherm (TB-022)", () => {
  it("opent op Nog te doen, met één dichte rij per discipline en de minst gedekte bovenaan", async () => {
    await toon();

    expect(screen.getByRole("radio", { name: t("dekking.nogTeDoen") })).toHaveAttribute("aria-checked", "true");

    const knoppen = screen.getAllByRole("button", { expanded: false });
    expect(knoppen.map((knop) => knop.textContent)).toEqual([
      expect.stringMatching(/^Muzische vorming/),
      expect.stringMatching(/^Wiskunde/),
    ]);
    expect(screen.queryByText("Tekst van W2")).toBeNull();
  });

  it("houdt de teller van een discipline gelijk bij het wisselen van weergave", async () => {
    await toon();
    const telling = t("dekking.groepTelling", { gedekt: 1, totaal: 3 });

    expect(within(disciplineknop("Wiskunde")).getByText(telling)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: t("dekking.alleDoelen") }));
    expect(within(disciplineknop("Wiskunde")).getByText(telling)).toBeInTheDocument();
  });

  it("toont na openklikken de domeinen en per ontbrekend doel de reden, en verbergt gedekte doelen onder Nog te doen", async () => {
    await toon();
    fireEvent.click(disciplineknop("Wiskunde"));

    expect(disciplineknop("Wiskunde")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: /^Getallen/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Meten/ })).toBeInTheDocument();
    expect(screen.getByText("Tekst van W2")).toBeInTheDocument();
    expect(screen.getAllByText(t("dekking.oorzaakNietIngepland", { themas: "Winter" }))).toHaveLength(2);
    expect(screen.queryByText("Tekst van W1")).toBeNull();
  });

  it("zet de acties per thema bovenaan, met links naar de kalender en naar Thema's voor directie", async () => {
    await toon(DIRECTIE);

    const link = within(actielijst()).getByRole("link", { name: t("dekking.actieInplannen", { thema: "Winter" }) });
    expect(link).toHaveAttribute("href", "/agenda/periodes");
    expect(within(actielijst()).getByText(t("dekking.winst", { aantal: 2 }))).toBeInTheDocument();
    expect(within(actielijst()).getByText(t("dekking.onbeslistEen"))).toBeInTheDocument();
    expect(within(actielijst()).getByRole("link", { name: t("dekking.naarThemas") })).toHaveAttribute("href", "/themas");
    expect(within(actielijst()).getByText(t("dekking.zonderThemaEen"))).toBeInTheDocument();
  });

  it("geeft een leerkracht van deze klas de kalenderlinks, maar niet de link naar Thema's zonder beoordelingsrecht", async () => {
    await toon(ikMet({ eigenKlasIds: ["klas-1"] }));

    expect(within(actielijst()).getByRole("link", { name: t("dekking.actieInplannen", { thema: "Winter" }) })).toBeInTheDocument();
    expect(within(actielijst()).getByText(t("dekking.onbeslistEen"))).toBeInTheDocument();
    expect(within(actielijst()).queryByRole("link", { name: t("dekking.naarThemas") })).toBeNull();
  });

  it("toont de acties zonder link aan wie de planning van deze klas niet mag bewerken", async () => {
    await toon(NIEMAND);

    expect(within(actielijst()).getByText(t("dekking.actieInplannen", { thema: "Winter" }))).toBeInTheDocument();
    expect(within(actielijst()).queryByRole("link")).toBeNull();
  });

  it("toont geen enkele teller en geen acties zolang het cijfer ingehouden wordt, maar wel de reden per doel", async () => {
    antwoord = weergave({ isBetrouwbaar: false, aantalOnopgelosteVervallenPlaatsingen: 1, aantalGedekt: null });
    const { container } = await toon();

    expect(screen.queryByRole("region", { name: t("dekking.acties") })).toBeNull();
    expect(screen.queryByText(/van \d+ gedekt/)).toBeNull();

    fireEvent.click(disciplineknop("Wiskunde"));
    expect(screen.getAllByText(t("dekking.oorzaakNietIngepland", { themas: "Winter" }))).toHaveLength(2);

    // Nothing a figure could hide in either: no fraction in the text and none in an attribute.
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    for (const element of container.querySelectorAll("[aria-label], [title]")) {
      expect(`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""}`).not.toMatch(/\d/);
    }
  });
});
