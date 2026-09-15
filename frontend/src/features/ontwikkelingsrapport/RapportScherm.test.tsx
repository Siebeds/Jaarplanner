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
    tekening: null,
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

/**
 * A small server over the three reports in memory, so a save and the report read after it agree. `tekeningAntwoord`
 * replaces its answer to a drawing upload, for a refusal.
 */
function toon(
  ik: Ik,
  {
    moment = 1,
    weiger = false,
    begin,
    tekeningAntwoord,
  }: { moment?: number; weiger?: boolean; begin?: Rapport; tekeningAntwoord?: () => Response } = {},
) {
  const rapporten = new Map<number, Rapport>([1, 2, 3].map((m) => [m, m === 1 && begin ? begin : leegRapport(m)]));
  const verzoeken: Verzoek[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (invoer: string, init?: RequestInit) => {
      const pad = String(invoer);
      const methode = init?.method ?? "GET";
      const formulier = init?.body instanceof FormData ? init.body : undefined;
      const lichaam = !formulier && init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      verzoeken.push({ methode, pad, lichaam: formulier ?? lichaam });

      if (pad === "/api/gradaties") return json(GRADATIES);
      const rapport = /\/api\/leerlingen\/([^/]+)\/rapporten\/(\d)(.*)$/.exec(pad);
      if (!rapport) return json({}, 404);
      if (weiger) return json({ detail: "Je hebt geen toegang tot deze actie." }, 403);

      const huidig = rapporten.get(Number(rapport[2]))!;
      const rest = rapport[3];
      if (methode === "GET" && rest === "") return json(huidig);

      if (rest === "/tekening" && methode === "PUT") {
        if (tekeningAntwoord) return tekeningAntwoord();
        const tekening = { versie: `v${verzoeken.length}`, breedte: 40, hoogte: 20 };
        rapporten.set(huidig.moment, { ...huidig, tekening });
        return json(tekening);
      }
      if (rest === "/tekening" && methode === "DELETE") {
        rapporten.set(huidig.moment, { ...huidig, tekening: null });
        return new Response(null, { status: 204 });
      }

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

// --- The kindtekening (FB-005). ---

const MET_TEKENING: Rapport = { ...leegRapport(1), tekening: { versie: "v1", breedte: 40, hoogte: 20 } };
const tekeningAdres = (versie: string) => `/api/leerlingen/${KIND}/rapporten/1/tekening?versie=${versie}`;
const tekeningvak = () => screen.getByRole("region", { name: t("ontwikkelingsrapport.tekening") });

function foto(naam: string, type: string, grootte = 1024): File {
  const bestand = new File([new Uint8Array(8)], naam, { type });
  Object.defineProperty(bestand, "size", { value: grootte });
  return bestand;
}

describe("RapportScherm, de tekening van het kind", () => {
  it("toont de tekening op haar eigen maat, met een adres dat de versie draagt, en de knoppen om ze te wijzigen", async () => {
    toon(LEERKRACHT, { begin: MET_TEKENING });

    const beeld = await screen.findByRole("img", { name: t("ontwikkelingsrapport.tekeningVan", { naam: "Fien" }) });
    expect(beeld).toHaveAttribute("src", tekeningAdres("v1"));
    expect(beeld).toHaveAttribute("width", "40");
    expect(beeld).toHaveAttribute("height", "20");

    const vak = within(tekeningvak());
    expect(vak.getByLabelText(t("ontwikkelingsrapport.tekeningVervangen"))).toHaveAttribute("accept", "image/jpeg,image/png");
    expect(vak.getByRole("button", { name: t("ontwikkelingsrapport.tekeningVerwijderen") })).toBeInTheDocument();
    expect(vak.getByRole("link", { name: t("ontwikkelingsrapport.tekeningOpenen") })).toHaveAttribute("href", tekeningAdres("v1"));
    expect(vak.getByText(t("ontwikkelingsrapport.tekeningUitleg", { mb: 20 }))).toBeInTheDocument();
  });

  it("vraagt om alleen de tekening en stuurt een gekozen foto op zonder haar bestandsnaam", async () => {
    const verzoeken = toon(LEERKRACHT);
    await screen.findByText(t("ontwikkelingsrapport.nogGeenTekening"));
    expect(screen.getByText(t("ontwikkelingsrapport.tekeningUitleg", { mb: 20 }))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t("ontwikkelingsrapport.tekeningToevoegen")), {
      target: { files: [foto("IMG_Fien_thuis.jpg", "image/jpeg")] },
    });

    const beeld = await screen.findByRole("img", { name: t("ontwikkelingsrapport.tekeningVan", { naam: "Fien" }) });
    const upload = verzoeken.find((verzoek) => verzoek.methode === "PUT")!;
    expect(upload.pad).toBe(`/api/leerlingen/${KIND}/rapporten/1/tekening`);
    const gestuurd = (upload.lichaam as FormData).get("bestand") as File;
    expect(gestuurd.name).toBe("tekening");
    expect(beeld.getAttribute("src")).toMatch(/\/tekening\?versie=v\d+$/);
    expect(await within(tekeningvak()).findByText(t("ontwikkelingsrapport.bewaard"))).toBeInTheDocument();
    expect(within(tekeningvak()).getByLabelText(t("ontwikkelingsrapport.tekeningVervangen"))).toBeInTheDocument();
  });

  it("weigert een PDF en een te groot bestand zonder iets te sturen, en noemt de grens", async () => {
    const verzoeken = toon(LEERKRACHT);
    const kies = async () => screen.findByLabelText(t("ontwikkelingsrapport.tekeningToevoegen"));

    fireEvent.change(await kies(), { target: { files: [foto("brief.pdf", "application/pdf")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(t("ontwikkelingsrapport.tekeningGeenJpegOfPng"));

    fireEvent.change(await kies(), { target: { files: [foto("groot.jpg", "image/jpeg", 20 * 1024 * 1024 + 1)] } });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(t("ontwikkelingsrapport.tekeningTeGroot", { mb: 20 })),
    );

    expect(puts(verzoeken)).toEqual([]);
  });

  it("toont de weigering van de server in haar eigen woorden, en een afgebroken upload als te groot", async () => {
    const detail = "Deze foto heeft meer dan 40 miljoen pixels. Kies een foto met een lagere resolutie.";
    toon(LEERKRACHT, { tekeningAntwoord: () => json({ detail }, 400) });

    fireEvent.change(await screen.findByLabelText(t("ontwikkelingsrapport.tekeningToevoegen")), {
      target: { files: [foto("groot.png", "image/png")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("leest een upload die de server afbrak (413) als te groot, met de grens", async () => {
    toon(LEERKRACHT, { tekeningAntwoord: () => new Response("", { status: 413 }) });

    fireEvent.change(await screen.findByLabelText(t("ontwikkelingsrapport.tekeningToevoegen")), {
      target: { files: [foto("groot.jpg", "image/jpeg")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(t("ontwikkelingsrapport.tekeningTeGroot", { mb: 20 }));
  });

  it("verwijdert de tekening pas na bevestiging", async () => {
    const verzoeken = toon(LEERKRACHT, { begin: MET_TEKENING });

    fireEvent.click(await screen.findByRole("button", { name: t("ontwikkelingsrapport.tekeningVerwijderen") }));
    const blad = await screen.findByRole("dialog", { name: t("ontwikkelingsrapport.tekeningVerwijderTitel") });
    expect(within(blad).getByText(t("ontwikkelingsrapport.tekeningVerwijderGevolg"))).toBeInTheDocument();
    expect(verzoeken.some((verzoek) => verzoek.methode === "DELETE")).toBe(false);

    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.verwijder") }));

    expect(await screen.findByText(t("ontwikkelingsrapport.nogGeenTekening"))).toBeInTheDocument();
    expect(verzoeken.filter((verzoek) => verzoek.methode === "DELETE").map((verzoek) => verzoek.pad)).toEqual([
      `/api/leerlingen/${KIND}/rapporten/1/tekening`,
    ]);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("na het schooljaar is de tekening te zien en te openen, zonder knoppen om ze te wijzigen", async () => {
    toon(LEERKRACHT_VOORBIJ, { begin: MET_TEKENING });

    expect(await screen.findByRole("img", { name: t("ontwikkelingsrapport.tekeningVan", { naam: "Fien" }) })).toBeInTheDocument();
    const vak = within(tekeningvak());
    expect(vak.getByRole("link", { name: t("ontwikkelingsrapport.tekeningOpenen") })).toBeInTheDocument();
    expect(vak.queryByLabelText(t("ontwikkelingsrapport.tekeningVervangen"))).not.toBeInTheDocument();
    expect(vak.queryByRole("button", { name: t("ontwikkelingsrapport.tekeningVerwijderen") })).not.toBeInTheDocument();
    expect(vak.queryByText(t("ontwikkelingsrapport.tekeningUitleg", { mb: 20 }))).not.toBeInTheDocument();
  });

  it("directie wijzigt een tekening ook na het schooljaar", async () => {
    toon(DIRECTIE, { begin: MET_TEKENING });

    const vak = within(await screen.findByRole("region", { name: t("ontwikkelingsrapport.tekening") }));
    expect(vak.getByLabelText(t("ontwikkelingsrapport.tekeningVervangen"))).toBeInTheDocument();
    expect(vak.getByRole("button", { name: t("ontwikkelingsrapport.tekeningVerwijderen") })).toBeInTheDocument();
  });
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
