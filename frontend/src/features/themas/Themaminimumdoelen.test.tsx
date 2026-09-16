import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { Ik } from "../../lib/aanmelding";
import type { LeerplandoelDetail, MinimumdoelDetail, MinimumdoelenPagina, ThemaWeergave } from "../../lib/types";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { ThemadetailScherm } from "./ThemadetailScherm";

/**
 * FB-043 through the real thema page: a themadoel is a minimumdoel, shut until opened, opening to one row per leeftijd
 * with its count, and a leeftijd opening to its leerplandoelen alone.
 */

const antwoord = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const MD_TEKST = "De kleuters drukken zich uit met beeldende middelen.";

function minimumdoel(ref: string, omschrijving: string, jaarFasen: MinimumdoelDetail["jaarFasen"]): MinimumdoelDetail {
  return {
    ref,
    leeftijd: "K-",
    nr: "1",
    omschrijving,
    leergebied: null,
    rubriek: null,
    subrubriek: null,
    soort: null,
    nietMeerInOpstap: false,
    aantalLeerplandoelen: jaarFasen.reduce((som, fase) => som + fase.leerplandoelen.length, 0),
    jaarFasen,
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
  };
}

const leerplandoel = (code: string, tekst: string) => ({
  code,
  tekst,
  disciplineNaam: "Muzische vorming",
  domein: "Beeld",
  subdomein: "Beeldend vormgeven",
  nietMeerInOpstap: false,
});

const MINIMUMDOELEN: Record<string, MinimumdoelDetail> = {
  "K-MV-1": minimumdoel("K-MV-1", MD_TEKST, [
    // Every jaar/fase comes back from the server; the empty ones are not a leeftijd of this minimumdoel.
    { jaarFase: "JK", leerplandoelen: [leerplandoel("6.5.GJK.1", "Tekst JK")] },
    {
      jaarFase: "K2",
      leerplandoelen: [leerplandoel("6.5.GK2.1", "Tekst K2 een"), leerplandoel("6.5.GK2.2", "Tekst K2 twee")],
    },
    { jaarFase: "K3", leerplandoelen: [leerplandoel("6.5.GK3.1", "Tekst K3")] },
    { jaarFase: "L1", leerplandoelen: [] },
  ]),
  "K-MV-2": minimumdoel("K-MV-2", "Een tweede minimumdoel.", [{ jaarFase: "K3", leerplandoelen: [] }]),
};

const THEMA: ThemaWeergave = {
  id: "t-1",
  naam: "Carnaval",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [],
  minimumdoelen: [{ id: "tm-1", minimumdoelRef: "K-MV-1" }],
  subthemas: [],
};

const ZOEKRESULTAAT: MinimumdoelenPagina = {
  regels: ["K-MV-1", "K-MV-2"].map((ref) => ({
    ref,
    leeftijd: "K-",
    nr: "1",
    omschrijving: MINIMUMDOELEN[ref].omschrijving,
    leergebied: null,
    rubriek: null,
    subrubriek: null,
    aantalLeerplandoelen: 0,
    jaarFasen: [],
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
  })),
  totaal: 2,
  overslaan: 0,
  aantal: 8,
} as MinimumdoelenPagina;

let thema: ThemaWeergave = THEMA;

const fetchMock = vi.fn(async (pad: string, init?: RequestInit) => {
  if (init?.method === "POST" && pad.endsWith("/api/themas/t-1/minimumdoelen")) {
    return antwoord({ id: "tm-2", minimumdoelRef: JSON.parse(String(init.body)).minimumdoelRef });
  }
  if (init?.method === "DELETE") return new Response(null, { status: 204 });
  const detail = /\/api\/minimumdoelen\/([^/?]+)$/.exec(pad);
  if (detail) return antwoord(MINIMUMDOELEN[decodeURIComponent(detail[1])]);
  if (pad.startsWith("/api/minimumdoelen?")) return antwoord(ZOEKRESULTAAT);
  const doel = /\/api\/leerplandoelen\/([^/?]+)$/.exec(pad);
  if (doel) {
    return antwoord({
      code: decodeURIComponent(doel[1]),
      doelsoort: "Gemeenschappelijk",
      jaarFase: "K3",
      tekst: "Tekst K3",
      minimumdoelRef: "K-MV-1",
      koppelingen: [],
      gerelateerdeDoelen: [],
    } as unknown as LeerplandoelDetail);
  }
  if (pad.endsWith("/doelsuggesties")) return antwoord([]);
  if (pad.endsWith("/api/jaarfasen")) return antwoord(["JK", "K2", "K3", "L1"]);
  if (pad.endsWith("/doelenoverzicht")) return antwoord({ themaId: "t-1", leeftijden: [] });
  if (pad.endsWith("/api/themas/t-1")) return antwoord(thema);
  return antwoord({}, 404);
});

beforeEach(() => {
  thema = THEMA;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon(ik: Ik = DIRECTIE) {
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/themas/t-1"]}>
        <Routes>
          <Route path="/themas/:themaId" element={<ThemadetailScherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const minimumdoelrij = () => screen.findByRole("button", { name: new RegExp(`K-MV-1.*${MD_TEKST}`) });

/** The minimumdoel's own list item: the page has leeftijd buttons of its own (the doelsuggesties' choice). */
const binnen = (rij: HTMLElement) => within(rij.closest("li")!);

describe("ThemadetailScherm: themadoelen zijn minimumdoelen (FB-043)", () => {
  it("toont een gekoppeld minimumdoel ingeklapt, met zijn nummer en tekst", async () => {
    toon();

    const rij = await minimumdoelrij();
    expect(rij).toHaveAttribute("aria-expanded", "false");
    expect(within(rij).getByText(MD_TEKST)).toBeInTheDocument();
    expect(binnen(rij).queryByRole("button", { name: /^K2/ })).not.toBeInTheDocument();
  });

  it("toont uitgeklapt per leeftijd het aantal leerplandoelen, en alleen de leeftijden die er hebben", async () => {
    toon();
    const rij = await minimumdoelrij();
    fireEvent.click(rij);
    const lijst = binnen(rij);

    const k2 = await lijst.findByRole("button", { name: /^K2/, expanded: false });
    expect(k2).toHaveTextContent(t("thema.overzichtLeerplandoelen", { aantal: 2 }));
    expect(lijst.getByRole("button", { name: /^JK/ })).toHaveTextContent(t("thema.overzichtEenLeerplandoel"));
    expect(lijst.getByRole("button", { name: /^K3/ })).toBeInTheDocument();
    expect(lijst.queryByRole("button", { name: /^L1/ })).not.toBeInTheDocument();
    // The leerplandoelen themselves stay shut until their leeftijd is opened.
    expect(screen.queryByText("Tekst K2 een")).not.toBeInTheDocument();
  });

  it("toont een opengeklapte leeftijd haar leerplandoelen en geen minimumdoel ertussen, en opent een doel in het detail", async () => {
    toon();
    const rij = await minimumdoelrij();
    fireEvent.click(rij);
    const k2 = await binnen(rij).findByRole("button", { name: /^K2/ });
    fireEvent.click(k2);
    expect(k2).toHaveAttribute("aria-expanded", "true");

    const lijst = k2.parentElement!.querySelector("ul")!;
    expect(within(lijst).getByText("Tekst K2 een")).toBeInTheDocument();
    expect(within(lijst).getByText("6.5.GK2.2")).toBeInTheDocument();
    expect(within(lijst).queryByText("K-MV-1")).not.toBeInTheDocument();
    expect(within(lijst).getAllByRole("button")).toHaveLength(2);

    fireEvent.click(within(lijst).getByRole("button", { name: /Tekst K2 een/ }));
    expect(await screen.findByRole("dialog", { name: t("doel.titel") })).toBeInTheDocument();
  });

  it("zegt het wanneer nog geen leerplandoel naar het minimumdoel leidt", async () => {
    thema = { ...THEMA, minimumdoelen: [{ id: "tm-2", minimumdoelRef: "K-MV-2" }] };
    toon();
    fireEvent.click(await screen.findByRole("button", { name: /K-MV-2/, expanded: false }));

    expect(await screen.findByText(t("thema.minimumdoelZonderLeerplandoel"))).toBeInTheDocument();
  });

  it("koppelt een gezocht minimumdoel met alleen zijn nummer, en biedt een gekoppeld niet opnieuw aan", async () => {
    toon();
    await minimumdoelrij();
    fireEvent.click(screen.getByRole("button", { name: t("thema.minimumdoelKoppelen") }));
    fireEvent.change(screen.getByRole("textbox", { name: t("thema.minimumdoelZoek") }), { target: { value: "MV" } });

    const aanbod = await screen.findByRole("button", { name: /K-MV-2/ });
    // K-MV-1 is already linked: only its row in the list above names it.
    expect(screen.getAllByRole("button", { name: /^K-MV-1/ })).toHaveLength(1);
    fireEvent.click(aanbod);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/themas/t-1/minimumdoelen",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ minimumdoelRef: "K-MV-2" }) }),
      ),
    );
    // The picker closes after a pick, and focus goes back to the button it came from.
    expect(screen.queryByRole("textbox", { name: t("thema.minimumdoelZoek") })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("thema.minimumdoelKoppelen") })).toHaveFocus();
    expect(fetchMock.mock.calls.some(([pad]) => pad.endsWith("/themadoelen"))).toBe(false);
  });

  it("sluit het zoekveld met Escape en geeft de focus terug aan de knop", async () => {
    toon();
    await minimumdoelrij();
    fireEvent.click(screen.getByRole("button", { name: t("thema.minimumdoelKoppelen") }));
    const veld = screen.getByRole("textbox", { name: t("thema.minimumdoelZoek") });
    expect(veld).toHaveFocus();

    fireEvent.keyDown(veld, { key: "Escape" });

    expect(screen.queryByRole("textbox", { name: t("thema.minimumdoelZoek") })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: t("thema.minimumdoelKoppelen") })).toHaveFocus());
  });

  it("ontkoppelt het minimumdoel en neemt zo zijn leerplandoelen mee", async () => {
    toon();
    await minimumdoelrij();

    fireEvent.click(screen.getByRole("button", { name: t("thema.minimumdoelOntkoppel", { ref: "K-MV-1" }) }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/themas/t-1/minimumdoelen/tm-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("laat een leerkracht de minimumdoelen lezen en uitklappen, zonder koppelen of ontkoppelen", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-k3"] }));

    const rij = await minimumdoelrij();
    fireEvent.click(rij);
    expect(await binnen(rij).findByRole("button", { name: /^K3/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("thema.minimumdoelKoppelen") })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("thema.minimumdoelOntkoppel", { ref: "K-MV-1" }) }),
    ).not.toBeInTheDocument();
  });

  it("toont het aantal minimumdoelen in de marge, zonder maximum", async () => {
    thema = {
      ...THEMA,
      minimumdoelen: ["A", "B", "C", "D", "E"].map((letter) => ({ id: `tm-${letter}`, minimumdoelRef: `K-MV-1${letter}` })),
    };
    toon();

    expect(await screen.findByText("K-MV-1E")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^K-MV-1[A-E]/, expanded: false })).toHaveLength(5);
    expect(screen.getByRole("button", { name: t("thema.minimumdoelKoppelen") })).toBeEnabled();
  });
});
