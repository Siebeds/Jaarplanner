import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { t } from "../../i18n";
import type { Rapport, Rapportregel } from "./rapporten";
import type { Gradatie } from "./rapportset";
import { RapportScherm } from "./RapportScherm";

/**
 * One child's ontwikkelingsrapport per moment (FB-003), as each person meets it: the klas's K3 leerkracht during and
 * after the schooljaar, directie, and a leerkracht of another klas who came by the address. Every name here is
 * invented (Art. VI.7: no real child's name in the repo).
 */

const KLAS = "k3-blauw";
const KIND = "kind-1";

const GRADATIES: Gradatie[] = [
  { id: "g-volledig", label: "Volledig bereikt", kleur: "Groen", volgorde: 1 },
  { id: "g-nietvolledig", label: "Nog niet volledig", kleur: "Oranje", volgorde: 2 },
];

const LUISTEREN: Rapportregel = {
  rapportdoelId: "rd-luisteren",
  titel: "Luisteren en spreken",
  subdoelen: [
    {
      id: "sd-1",
      leerplandoelCode: "RS-01",
      leerplandoelTekst: "Luistert aandachtig naar een verhaal.",
      doelsoort: "Gemeenschappelijk",
      themaNaam: "Water",
      subthemaNaam: "Regen",
    },
  ],
  gradatieId: null,
  tekst: null,
  tekstStatus: null,
};
const TELLEN: Rapportregel = { ...LUISTEREN, rapportdoelId: "rd-tellen", titel: "Tellen en meten", subdoelen: [] };

function leegRapport(moment: number): Rapport {
  return {
    leerlingId: KIND,
    klasId: KLAS,
    voornaam: "Fien",
    achternaam: "Proefmans",
    klasNaam: "K3 blauw",
    schooljaarNaam: "2026-2027",
    moment,
    rapportdoelen: [LUISTEREN, TELLEN],
    besluit: null,
    besluitStatus: null,
  };
}

const LEERKRACHT = ikMet({
  eigenKlasIds: [KLAS],
  leerkrachtLeeftijden: ["K3"],
  rapportklasIds: [KLAS],
  lopendeRapportklasIds: [KLAS],
});
const LEERKRACHT_VOORBIJ = ikMet({ eigenKlasIds: [KLAS], rapportklasIds: [KLAS] });
const ANDERE_LEERKRACHT = ikMet({ eigenKlasIds: ["k3-groen"], rapportklasIds: ["k3-groen"], lopendeRapportklasIds: ["k3-groen"] });

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

interface Verzoek {
  methode: string;
  pad: string;
  lichaam?: unknown;
}

/** A small server over the three reports in memory, so a save and the report read after it agree. */
function toon(ik: Ik, { moment = 1, weiger = false, begin }: { moment?: number; weiger?: boolean; begin?: Rapport } = {}) {
  const rapporten = new Map<number, Rapport>([1, 2, 3].map((m) => [m, m === 1 && begin ? begin : leegRapport(m)]));
  const verzoeken: Verzoek[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (invoer: string, init?: RequestInit) => {
      const pad = String(invoer);
      const methode = init?.method ?? "GET";
      const lichaam = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      verzoeken.push({ methode, pad, lichaam });

      if (pad === "/api/gradaties") return json(GRADATIES);
      const rapport = /\/api\/leerlingen\/([^/]+)\/rapporten\/(\d)(.*)$/.exec(pad);
      if (!rapport) return json({}, 404);
      if (weiger) return json({ detail: "Je hebt geen toegang tot deze actie." }, 403);

      const huidig = rapporten.get(Number(rapport[2]))!;
      const rest = rapport[3];
      if (methode === "GET" && rest === "") return json(huidig);

      const doel = /^\/rapportdoelen\/(.+)$/.exec(rest);
      if (methode === "PUT" && doel) {
        const tekst = String(lichaam?.tekst ?? "").trim() || null;
        const bewaard: Omit<Rapportregel, "titel" | "subdoelen"> = {
          rapportdoelId: doel[1],
          gradatieId: (lichaam?.gradatieId as string | null) ?? null,
          tekst,
          tekstStatus: tekst ? "Manueel" : null,
        };
        rapporten.set(huidig.moment, {
          ...huidig,
          rapportdoelen: huidig.rapportdoelen.map((regel) => (regel.rapportdoelId === doel[1] ? { ...regel, ...bewaard } : regel)),
        });
        return json(bewaard);
      }
      if (methode === "PUT" && rest === "/besluit") {
        const besluit = String(lichaam?.tekst ?? "").trim() || null;
        const bewaard: Pick<Rapport, "besluit" | "besluitStatus"> = { besluit, besluitStatus: besluit ? "Manueel" : null };
        rapporten.set(huidig.moment, { ...huidig, ...bewaard });
        return json(bewaard);
      }
      return json({}, 404);
    }),
  );

  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/ontwikkelingsrapport/kinderen/${KIND}/rapport/${moment}`]}>
        <Routes>
          <Route path="/ontwikkelingsrapport/kinderen/:leerlingId/rapport/:moment" element={<RapportScherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return verzoeken;
}

const puts = (verzoeken: Verzoek[]) => verzoeken.filter((verzoek) => verzoek.methode === "PUT");
const sterren = (titel: string) => screen.getByRole("group", { name: t("ontwikkelingsrapport.sterVoor", { titel }) });
const tekstvak = (titel: string) => screen.getByRole("textbox", { name: t("ontwikkelingsrapport.tekstBij", { titel }) });
const besluitvak = () => screen.getByRole("textbox", { name: t("ontwikkelingsrapport.besluit") });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RapportScherm, het ontwikkelingsrapport van een kind", () => {
  it("toont elk rapportdoel met titel, subdoelen, een sterkeuze en een tekstvak, en een vak voor het besluit", async () => {
    toon(LEERKRACHT);

    expect(await screen.findByRole("heading", { name: "Fien Proefmans" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: LUISTEREN.titel })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: TELLEN.titel })).toBeInTheDocument();

    // Every star of the scale, with its label, and the choice for none; nothing chosen yet.
    const keuze = within(sterren(LUISTEREN.titel)).getAllByRole("radio");
    expect(keuze.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Volledig bereikt",
      "Nog niet volledig",
      t("ontwikkelingsrapport.geenSter"),
    ]);
    expect(within(sterren(LUISTEREN.titel)).getByRole("radio", { name: t("ontwikkelingsrapport.geenSter") })).toBeChecked();

    expect(tekstvak(LUISTEREN.titel)).toHaveValue("");
    expect(tekstvak(TELLEN.titel)).toBeInTheDocument();
    expect(besluitvak()).toHaveValue("");

    // The subdoelen a rapportdoel bundles, folded under their count: the parent never sees them (R11).
    expect(screen.getByText(t("ontwikkelingsrapport.eenSubdoel"))).toBeInTheDocument();
    expect(screen.getByText(/Luistert aandachtig naar een verhaal\./)).toBeInTheDocument();

    // Rapport 1 is the current one of three.
    const momenten = screen.getByRole("navigation", { name: t("ontwikkelingsrapport.momenten") });
    expect(within(momenten).getAllByRole("link").map((link) => link.textContent)).toEqual(["Rapport 1", "Rapport 2", "Rapport 3"]);
    expect(within(momenten).getByRole("link", { name: "Rapport 1" })).toHaveAttribute("aria-current", "page");
  });

  it("bewaart een gekozen ster meteen, samen met de tekst die er staat", async () => {
    const verzoeken = toon(LEERKRACHT);
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    fireEvent.click(within(sterren(LUISTEREN.titel)).getByRole("radio", { name: "Volledig bereikt" }));

    await waitFor(() =>
      expect(puts(verzoeken)).toEqual([
        {
          methode: "PUT",
          pad: `/api/leerlingen/${KIND}/rapporten/1/rapportdoelen/${LUISTEREN.rapportdoelId}`,
          lichaam: { gradatieId: "g-volledig", tekst: "" },
        },
      ]),
    );
    expect(within(sterren(LUISTEREN.titel)).getByRole("radio", { name: "Volledig bereikt" })).toBeChecked();
    expect(await screen.findByText(t("ontwikkelingsrapport.bewaard"))).toBeInTheDocument();
  });

  it("bewaart de tekst wanneer het veld verlaten wordt, en stuurt niets voor een veld dat niet veranderde", async () => {
    const verzoeken = toon(LEERKRACHT);
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    fireEvent.blur(tekstvak(TELLEN.titel));
    fireEvent.change(tekstvak(LUISTEREN.titel), { target: { value: "Vertelt graag over thuis." } });
    fireEvent.blur(tekstvak(LUISTEREN.titel));

    await waitFor(() =>
      expect(puts(verzoeken)).toEqual([
        {
          methode: "PUT",
          pad: `/api/leerlingen/${KIND}/rapporten/1/rapportdoelen/${LUISTEREN.rapportdoelId}`,
          lichaam: { gradatieId: null, tekst: "Vertelt graag over thuis." },
        },
      ]),
    );
  });

  it("bewaart het algemeen besluit", async () => {
    const verzoeken = toon(LEERKRACHT);
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    fireEvent.change(besluitvak(), { target: { value: "Een fijne periode." } });
    fireEvent.blur(besluitvak());

    await waitFor(() =>
      expect(puts(verzoeken)).toEqual([
        { methode: "PUT", pad: `/api/leerlingen/${KIND}/rapporten/1/besluit`, lichaam: { tekst: "Een fijne periode." } },
      ]),
    );
  });

  it("opent Rapport 2 leeg, en Rapport 1 houdt wat er bewaard werd", async () => {
    toon(LEERKRACHT);
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    fireEvent.change(tekstvak(LUISTEREN.titel), { target: { value: "Luistert goed." } });
    fireEvent.blur(tekstvak(LUISTEREN.titel));
    await screen.findByText(t("ontwikkelingsrapport.bewaard"));

    fireEvent.click(screen.getByRole("link", { name: "Rapport 2" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Rapport 2" })).toHaveAttribute("aria-current", "page"));
    expect(await screen.findByRole("textbox", { name: t("ontwikkelingsrapport.tekstBij", { titel: LUISTEREN.titel }) })).toHaveValue("");

    fireEvent.click(screen.getByRole("link", { name: "Rapport 1" }));
    await waitFor(() => expect(tekstvak(LUISTEREN.titel)).toHaveValue("Luistert goed."));
  });

  it("toont na het schooljaar het rapport alleen om te lezen, en zegt waarom", async () => {
    toon(LEERKRACHT_VOORBIJ, {
      begin: {
        ...leegRapport(1),
        rapportdoelen: [{ ...LUISTEREN, gradatieId: "g-volledig", tekst: "Luistert goed.", tekstStatus: "Manueel" }, TELLEN],
      },
    });
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText(t("ontwikkelingsrapport.rapportAlleenLezen"))).toBeInTheDocument();
    expect(screen.getByText("Volledig bereikt")).toBeInTheDocument();
    expect(screen.getByText("Luistert goed.")).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.nogGeenSter"))).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.nogGeenBesluit"))).toBeInTheDocument();
  });

  it("toont Leerlingzorg het rapport om te lezen, zonder velden en zonder de zin over een voorbij schooljaar (R18)", async () => {
    const verzoeken = toon(ikMet({ heeftLeerlingzorg: true }), {
      begin: {
        ...leegRapport(1),
        rapportdoelen: [{ ...LUISTEREN, gradatieId: "g-volledig", tekst: "Luistert goed.", tekstStatus: "Manueel" }, TELLEN],
      },
    });
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("Luistert goed.")).toBeInTheDocument();
    expect(screen.queryByText(t("ontwikkelingsrapport.rapportAlleenLezen"))).not.toBeInTheDocument();
    expect(verzoeken.every((verzoek) => verzoek.methode === "GET")).toBe(true);
  });

  it("laat de directie invullen, zonder de zin over een voorbij schooljaar", async () => {
    toon(DIRECTIE);
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    expect(within(sterren(LUISTEREN.titel)).getAllByRole("radio")).toHaveLength(3);
    expect(besluitvak()).toBeInTheDocument();
    expect(screen.queryByText(t("ontwikkelingsrapport.rapportAlleenLezen"))).not.toBeInTheDocument();
  });

  it("zegt een leerkracht van een andere klas dat die geen toegang heeft, ook via het adres", async () => {
    toon(ANDERE_LEERKRACHT, { weiger: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(t("ontwikkelingsrapport.geenToegangRapport"));
    expect(screen.queryByRole("heading", { name: "Fien Proefmans" })).not.toBeInTheDocument();
  });

  it("toont de zin van de server wanneer bewaren geweigerd wordt, en probeert opnieuw", async () => {
    const verzoeken = toon(LEERKRACHT);
    await screen.findByRole("heading", { name: LUISTEREN.titel });

    // The rights changed while the page was open: the save is refused.
    const fetch = globalThis.fetch as unknown as Mock<(invoer: string, init?: RequestInit) => Promise<Response>>;
    const gewoon = fetch.getMockImplementation()!;
    fetch.mockImplementation(async (invoer: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ detail: "Je hebt geen toegang tot deze actie." }, 403) : gewoon(invoer, init),
    );

    fireEvent.click(within(sterren(LUISTEREN.titel)).getByRole("radio", { name: "Nog niet volledig" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Je hebt geen toegang tot deze actie.");

    fetch.mockImplementation(gewoon);
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.opnieuwProberen") }));
    expect(await screen.findByText(t("ontwikkelingsrapport.bewaard"))).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(puts(verzoeken).length).toBeGreaterThanOrEqual(1);
  });
});
