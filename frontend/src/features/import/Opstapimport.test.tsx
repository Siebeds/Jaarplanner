import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { Opstapimport } from "./Opstapimport";
import type {
  LeerplandoelDisciplineResultaat,
  LeerplandoelImportAntwoord,
  MinimumdoelImportAntwoord,
  MinimumdoelImportDiff,
  OpstapHerimportDiff,
  OpstapImportStand,
} from "./types";

/**
 * The Op.stap import from KOV's API on the Inladen screen (E1-22).
 *
 * What is pinned here is what a browser pass reads least reliably: which request each button sends and in which order,
 * that the report on screen after an apply is the apply's own, what is never shown (the English reasons, thousands of
 * codes), and when the Excel upload is offered. Each test drives the real component against a routed fetch.
 */

interface Aanroep {
  sleutel: string;
  body: string | null;
}

type Route = () => { status?: number; body: unknown };

let aanroepen: Aanroep[] = [];

function routeer(routes: Record<string, Route>) {
  aanroepen = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string, init?: RequestInit) => {
      const sleutel = `${init?.method ?? "GET"} ${pad}`;
      aanroepen.push({ sleutel, body: typeof init?.body === "string" ? init.body : null });
      const route = routes[sleutel];
      if (!route) return Promise.reject(new Error(`unexpected request ${sleutel}`));
      const { status = 200, body } = route();
      return Promise.resolve(
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
      );
    }),
  );
}

const gestuurd = (sleutel: string) => aanroepen.filter((a) => a.sleutel === sleutel);

const STAND = "GET /api/opstap-import/stand";
const MD_VOORBEELD = "POST /api/opstap-import/minimumdoelen/voorbeeld";
const MD_TOEPASSEN = "POST /api/opstap-import/minimumdoelen";
const LP_VOORBEELD = "POST /api/opstap-import/leerplandoelen/voorbeeld";
const LP_TOEPASSEN = "POST /api/opstap-import/leerplandoelen";

const LEEG: OpstapImportStand = { aantalMinimumdoelen: 0, laatsteVersie: null };
const DOORGEVOERD: OpstapImportStand = {
  aantalMinimumdoelen: 998,
  laatsteVersie: { versie: "1.1", hash: "h", toegepastOp: "2026-09-01T10:00:00+00:00" },
};

function codes(aantal: number, voorvoegsel: string): string[] {
  return Array.from({ length: aantal }, (_, i) => `${voorvoegsel}${i + 1}`);
}

/**
 * The fixtures compute `schrijftIets` the way the server does, unless a test sets it: the screen must follow the server's
 * flag, and a fixture that disagreed with the server would test a screen nobody can see.
 */
function md(diff: Partial<MinimumdoelImportDiff> = {}, rest: Partial<MinimumdoelImportAntwoord> = {}): MinimumdoelImportAntwoord {
  const basis = {
    toegevoegd: [],
    gewijzigd: [],
    ongewijzigd: [],
    verdwenen: [],
    nietIngelezen: [],
    eerderVerdwenen: [],
    teruggekeerd: [],
    overgeslagen: false,
    opmerkingen: [],
    isLeeg: false,
    vereistReview: false,
    ...diff,
  };
  const schrijft =
    !basis.overgeslagen &&
    basis.toegevoegd.length + basis.gewijzigd.length + basis.verdwenen.length + basis.teruggekeerd.length > 0;
  return {
    isVolledigVerwerkt: true,
    problemen: [],
    toegepast: false,
    ...rest,
    diff: { ...basis, schrijftIets: diff.schrijftIets ?? schrijft },
  };
}

function discipline(nummer: string, naam: string, diff: Partial<OpstapHerimportDiff>): LeerplandoelDisciplineResultaat {
  const basis = {
    disciplineNummer: nummer,
    toegevoegd: [],
    gewijzigd: [],
    ongewijzigd: [],
    verdwenen: [],
    verdwenenMaarGekoppeld: [],
    nietIngelezen: [],
    buitenBereik: [],
    gemeenschappelijkBuitenBereik: [],
    hernummerd: [],
    eerderVerdwenen: [],
    teruggekeerd: [],
    overgeslagen: false,
    opmerkingen: [],
    isLeeg: false,
    vereistReview: false,
    ...diff,
  };
  const schrijft =
    !basis.overgeslagen &&
    basis.toegevoegd.length +
      basis.gewijzigd.length +
      basis.verdwenen.length +
      basis.verdwenenMaarGekoppeld.length +
      basis.hernummerd.length +
      basis.teruggekeerd.length >
      0;
  return {
    disciplineNummer: nummer,
    disciplineNaam: naam,
    overgeslagenDoelsets: [],
    problemen: [],
    diff: { ...basis, schrijftIets: diff.schrijftIets ?? schrijft },
  };
}

function lp(disciplines: LeerplandoelDisciplineResultaat[], rest: Partial<LeerplandoelImportAntwoord> = {}): LeerplandoelImportAntwoord {
  return {
    isVolledigVerwerkt: true,
    versie: "1.2",
    hash: "8f470a12-231f-5817-7a8b-6582195e2583",
    snapshotTijdstip: "2026-08-27T10:03:07+00:00",
    vorigeVersie: null,
    wijzigingslog: null,
    overgeslagenDoelsets: [],
    problemen: [],
    disciplines,
    toegepast: false,
    schrijftIets: disciplines.some((d) => d.diff.schrijftIets),
    aantalRedenenGewijzigd: 0,
    ...rest,
  };
}

const WISKUNDE_NIEUW = [discipline("2", "Wiskunde", { toegevoegd: ["2.1.GL3.10"] })];
const NIETS_NIEUW_MD = md({ ongewijzigd: codes(998, "K-1."), isLeeg: true });

function toon() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Opstapimport />
    </QueryClientProvider>,
  );
}

function klik(naam: string) {
  fireEvent.click(screen.getByRole("button", { name: naam }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Opstapimport", () => {
  it("leidt een eerste keer eerst door de minimumdoelen, toont na elk doorvoeren het eigen verslag en voert de leerplandoelen pas na een tweede klik door", async () => {
    let stand = LEEG;
    routeer({
      [STAND]: () => ({ body: stand }),
      [MD_VOORBEELD]: () => ({ body: md({ toegevoegd: codes(998, "K-1.") }) }),
      [MD_TOEPASSEN]: () => {
        stand = { aantalMinimumdoelen: 997, laatsteVersie: null };
        return {
          body: md(
            { toegevoegd: codes(997, "K-1.") },
            { toegepast: true, isVolledigVerwerkt: false, problemen: [{ sleutel: "K-9.9.9", reden: "contains markup the conversion cannot keep" }] },
          ),
        };
      },
      [LP_VOORBEELD]: () => ({ body: lp(WISKUNDE_NIEUW) }),
      [LP_TOEPASSEN]: () => ({ body: lp(WISKUNDE_NIEUW, { toegepast: true }) }),
    });
    toon();

    expect(await screen.findByText(t("importeren.kov.nogNietIngeladen"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.nogGeenVersie"))).toBeInTheDocument();

    // Ophalen: only the minimumdoelen, because the leerplandoelen preview refuses until they are stored.
    klik(t("importeren.kov.ophalen"));
    expect(await screen.findByText("998")).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.eerstMinimumdoelen"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.nietDoorgevoerd"))).toBeInTheDocument();
    expect(gestuurd(LP_VOORBEELD)).toHaveLength(0);
    expect(gestuurd(MD_TOEPASSEN)).toHaveLength(0);

    // Doorvoeren: the minimumdoelen apply, whose own report replaces the preview's.
    klik(t("importeren.kov.doorvoeren"));
    expect(await screen.findByText("997")).toBeInTheDocument();
    expect(screen.queryByText("998")).not.toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.problemenMdEen"))).toBeInTheDocument();
    expect(screen.queryByText(/contains markup/)).not.toBeInTheDocument();

    // Then the leerplandoelen preview arrives by itself, and nothing of it is written yet.
    expect(
      await screen.findByText(t("importeren.kov.versieGepubliceerd", { versie: "1.2", datum: "27 augustus 2026" })),
    ).toBeInTheDocument();
    expect(screen.queryByText(t("importeren.kov.eerstMinimumdoelen"))).not.toBeInTheDocument();
    expect(gestuurd(LP_VOORBEELD).map((a) => a.body)).toEqual(["{}"]);
    expect(gestuurd(LP_TOEPASSEN)).toHaveLength(0);

    // A second press applies exactly the version the preview named.
    fireEvent.click(await screen.findByRole("button", { name: t("importeren.kov.doorvoeren") }));
    await waitFor(() => expect(screen.getAllByText(t("importeren.kov.doorgevoerd"))).toHaveLength(2));
    expect(gestuurd(LP_TOEPASSEN).map((a) => a.body)).toEqual([JSON.stringify({ versie: "1.2" })]);
    expect(gestuurd(MD_TOEPASSEN)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: t("importeren.kov.doorvoeren") })).not.toBeInTheDocument();
  });

  it("haalt met ingeladen minimumdoelen beide voorbeelden op en biedt geen doorvoeren aan als er niets verandert", async () => {
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({ body: lp([discipline("2", "Wiskunde", { ongewijzigd: ["2.1.GL3.10"], isLeeg: true })]) }),
    });
    toon();

    expect(await screen.findByText(t("importeren.kov.ingeladen", { aantal: "998" }))).toBeInTheDocument();
    expect(
      screen.getByText(t("importeren.kov.versieDoorgevoerd", { versie: "1.1", datum: "1 september 2026" })),
    ).toBeInTheDocument();

    klik(t("importeren.kov.ophalen"));
    expect(await screen.findByText(t("importeren.kov.mdNiets"))).toBeInTheDocument();
    expect(await screen.findByText(t("importeren.kov.lpNiets"))).toBeInTheDocument();
    expect(gestuurd(MD_VOORBEELD)).toHaveLength(1);
    expect(gestuurd(LP_VOORBEELD)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: t("importeren.kov.doorvoeren") })).not.toBeInTheDocument();
    // "Nog niet doorgevoerd" would point at an action that is not offered (seen in the browser pass).
    expect(screen.queryByText(t("importeren.kov.nietDoorgevoerd"))).not.toBeInTheDocument();
  });

  it("biedt bij een herhaalde ophaling na een verdwenen doel geen doorvoeren aan (antagonist round 1 MAJOR)", async () => {
    // What the server now answers on a repeat fetch of an unchanged snapshot after a goal left and was flagged: the
    // flagged rows sit in `eerderVerdwenen`, which writes nothing, and the version is the one already applied.
    const hash = "8f470a12-231f-5817-7a8b-6582195e2583";
    routeer({
      [STAND]: () => ({
        body: { aantalMinimumdoelen: 998, laatsteVersie: { versie: "1.2", hash, toegepastOp: "2026-09-13T10:00:00+00:00" } },
      }),
      [MD_VOORBEELD]: () => ({ body: md({ ongewijzigd: codes(997, "K-1."), eerderVerdwenen: ["K-9.9.9"], isLeeg: true }) }),
      [LP_VOORBEELD]: () => ({
        body: lp(
          [discipline("2", "Wiskunde", { ongewijzigd: ["2.1.GL3.10"], eerderVerdwenen: ["2.1.GK3.6"], isLeeg: true })],
          { vorigeVersie: { versie: "1.2", hash, toegepastOp: "2026-09-13T10:00:00+00:00" } },
        ),
      }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect(await screen.findByText(t("importeren.kov.mdNiets"))).toBeInTheDocument();
    expect(await screen.findByText(t("importeren.kov.lpNiets"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("importeren.kov.doorvoeren") })).not.toBeInTheDocument();
    expect(screen.queryByText(t("importeren.kov.nietDoorgevoerd"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("importeren.kov.versieVastleggen", { versie: "1.2" }))).not.toBeInTheDocument();
    // Nothing to write, so the accent goes back to the one action left (test-runner round 2).
    expect(screen.getByRole("button", { name: t("importeren.kov.ophalen") }).className).toMatch(/\bbg-accent\b/);
  });

  it("biedt een eerste doorvoering zonder gewijzigd doel aan met de zin over de versie (antagonist round 2 MINOR 2)", async () => {
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({
        body: lp([discipline("12", "Burgerschap", { overgeslagen: true, isLeeg: true, opmerkingen: ["Discipline 12 staat niet in de toepassing."] })], {
          vorigeVersie: null,
          schrijftIets: true,
        }),
      }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect(await screen.findByText(t("importeren.kov.versieVastleggen", { versie: "1.2" }))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("importeren.kov.doorvoeren") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("importeren.kov.ophalen") }).className).not.toMatch(/\bbg-accent\b/);
  });

  it("zegt waarom doorvoeren wordt aangeboden als alleen de versie of de uitleg bij minimumdoelen verandert", async () => {
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({
        body: lp([discipline("2", "Wiskunde", { ongewijzigd: ["2.1.GL3.10"], isLeeg: true })], {
          vorigeVersie: { versie: "1.1", hash: "h", toegepastOp: "2026-09-01T10:00:00+00:00" },
          schrijftIets: true,
          aantalRedenenGewijzigd: 6,
        }),
      }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect(await screen.findByText(t("importeren.kov.lpNiets"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.versieVastleggen", { versie: "1.2" }))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.redenenMeer", { aantal: "6" }))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("importeren.kov.doorvoeren") })).toBeInTheDocument();
  });

  it("noemt gewijzigde velden in het Nederlands, niet met hun code (antagonist round 1 MINOR)", async () => {
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({
        body: md({ gewijzigd: [{ ref: "K-1.3.9", velden: [{ veld: "Omschrijving", oudeWaarde: "a", nieuweWaarde: "b" }] }] }),
      }),
      [LP_VOORBEELD]: () => ({
        body: lp([
          discipline("2", "Wiskunde", {
            gewijzigd: [
              {
                code: "2.1.GL3.10",
                velden: [
                  { veld: "MinimumdoelRef", oudeWaarde: null, nieuweWaarde: "4-2.1.7" },
                  { veld: "JaarFase", oudeWaarde: "3K", nieuweWaarde: "K3" },
                  { veld: "Onbekend", oudeWaarde: "x", nieuweWaarde: "y" },
                ],
              },
            ],
          }),
        ]),
      }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect(await screen.findByText(t("importeren.veld.Omschrijving"))).toBeInTheDocument();
    expect(
      screen.getByText(`${t("importeren.veld.MinimumdoelRef")}, ${t("importeren.veld.JaarFase")}, Onbekend`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/MinimumdoelRef|JaarFase/)).not.toBeInTheDocument();
  });

  it("biedt het Excel-bestand aan zolang er geen versie doorgevoerd is, en daarna niet meer, met de reden", async () => {
    routeer({ [STAND]: () => ({ body: LEEG }) });
    const { unmount } = toon();

    klik(await screen.findByRole("button", { name: t("importeren.opstap.excelTonen") }).then((knop) => knop.textContent!));
    expect(screen.getByText(t("importeren.opstap.titel"))).toBeInTheDocument();
    expect(screen.getByLabelText(t("importeren.kiesBestand"))).toBeInTheDocument();
    // Under the API flow the accent stays on *Op.stap ophalen*: the Excel button is `rustig` (antagonist round 1 MINOR).
    expect(screen.getByRole("button", { name: t("importeren.bekijkVoorbeeld") }).className).not.toMatch(/\bbg-accent\b/);
    expect(screen.getByRole("button", { name: t("importeren.kov.ophalen") }).className).toMatch(/\bbg-accent\b/);
    expect(screen.queryByText(t("importeren.opstap.excelNietMeer"))).not.toBeInTheDocument();
    unmount();

    routeer({ [STAND]: () => ({ body: DOORGEVOERD }) });
    toon();
    expect(await screen.findByText(t("importeren.opstap.excelNietMeer"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("importeren.opstap.excelTonen") })).not.toBeInTheDocument();
    expect(screen.queryByText(t("importeren.opstap.titel"))).not.toBeInTheDocument();
  });

  it("toont bij een 502 de Nederlandse zin van de server onder de leerplandoelen en laat de minimumdoelen staan", async () => {
    const detail = "De Op.stap-gegevens van Katholiek Onderwijs Vlaanderen konden niet opgehaald worden. Er is niets gewijzigd.";
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({ status: 502, body: { title: "Op.stap niet opgehaald", detail } }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(screen.getByText(t("importeren.mislukt"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.mdNiets"))).toBeInTheDocument();
  });

  it("laat na een geweigerde toepassing van de leerplandoelen het eigen verslag van de minimumdoelen en de reden van de server zien", async () => {
    const detail = "Deze codes staan al bij een andere discipline: 2.1.GL3.10 (discipline 3). Er is niets gewijzigd.";
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: md({ toegevoegd: ["K-1.9.9"], ongewijzigd: codes(998, "K-1.") }) }),
      [MD_TOEPASSEN]: () => ({ body: md({ toegevoegd: ["K-1.9.9"], ongewijzigd: codes(998, "K-1.") }, { toegepast: true }) }),
      [LP_VOORBEELD]: () => ({ body: lp(WISKUNDE_NIEUW) }),
      [LP_TOEPASSEN]: () => ({ status: 409, body: { title: "Import niet doorgevoerd", detail } }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    fireEvent.click(await screen.findByRole("button", { name: t("importeren.kov.doorvoeren") }));

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.doorgevoerd"))).toBeInTheDocument();
    // The leerplandoelen preview stays, marked as not written, and the button is there to try again.
    expect(screen.getByText(t("importeren.kov.nietDoorgevoerd"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("importeren.kov.doorvoeren") })).toBeInTheDocument();
  });

  it("vat een eerste import samen in aantallen en toont geen duizenden codes", async () => {
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({
        body: lp([
          discipline("2", "Wiskunde", { toegevoegd: codes(5835, "2.1.GL1.") }),
          discipline("12", "Onbekend", { overgeslagen: true, opmerkingen: ["Discipline 12 (Onbekend) staat in de Op.stap-bron maar niet in de toepassing. Er is niets van ingelezen of gewijzigd."] }),
        ]),
      }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect((await screen.findAllByText("5.835")).length).toBeGreaterThan(0);
    expect(screen.queryByText("2.1.GL1.1")).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Wiskunde/ })).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.overgeslagen"))).toBeInTheDocument();
    expect(screen.getByText(/Discipline 12 \(Onbekend\) staat in de Op.stap-bron/)).toBeInTheDocument();
  });

  it("noemt overgeslagen doelsoorten en het aantal niet ingelezen doelen, nooit de Engelse reden", async () => {
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({
        body: lp(
          [discipline("2", "Wiskunde", { toegevoegd: ["2.1.GL3.10"], hernummerd: [{ oudeCode: "2.1.GK3.6", nieuweCode: "2.1.GK3.7", aantalKoppelingen: 0 }] })],
          {
            overgeslagenDoelsets: [
              { doelset: "P", aantal: 762 },
              { doelset: "Z", aantal: 28 },
            ],
            problemen: [
              { code: "2.1.GL3.10", reden: "contains markup the conversion cannot keep: <mtable>" },
              { code: "2.1.GL3.11", reden: "names two minimumdoelen" },
            ],
          },
        ),
      }),
    });
    toon();

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    expect(await screen.findByText(t("importeren.kov.doelsetP"))).toBeInTheDocument();
    expect(screen.getByText("762")).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.doelsetZ"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.problemenLpMeer", { aantal: 2 }))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.kov.heetNu", { oud: "2.1.GK3.6", nieuw: "2.1.GK3.7" }))).toBeInTheDocument();
    expect(screen.queryByText(/markup|names two/)).not.toBeInTheDocument();
  });

  it("toont het wijzigingslog van KOV pas na een klik, en zonder log geen knop", async () => {
    const log = "TOEGEVOEGD\n- 1.2.GL2.39 - De leerlingen kunnen iets nieuws.";
    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({ body: lp(WISKUNDE_NIEUW, { wijzigingslog: log }) }),
    });
    const { unmount } = toon();
    const label = t("importeren.kov.wijzigingslog", { versie: "1.2" });

    klik(await screen.findByText(t("importeren.kov.ophalen")).then((knop) => knop.textContent!));
    const knop = await screen.findByRole("button", { name: label });
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/1\.2\.GL2\.39/)).not.toBeInTheDocument();

    fireEvent.click(knop);
    expect(knop).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: label })).toHaveTextContent("1.2.GL2.39");
    unmount();

    routeer({
      [STAND]: () => ({ body: DOORGEVOERD }),
      [MD_VOORBEELD]: () => ({ body: NIETS_NIEUW_MD }),
      [LP_VOORBEELD]: () => ({ body: lp(WISKUNDE_NIEUW) }),
    });
    toon();
    klik(await screen.findByText(t("importeren.kov.ophalen")).then((k) => k.textContent!));
    await screen.findByText(t("importeren.kov.versieGepubliceerd", { versie: "1.2", datum: "27 augustus 2026" }));
    expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
  });
});
