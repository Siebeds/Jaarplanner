import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { magVoor } from "../../lib/rechten";
import type { ActiviteitvoorstelWeergave, SubthemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Subthemahoofdstuk } from "./Subthemahoofdstuk";

/**
 * The AI's activiteit proposals in a subthema chapter (FB-025, ADR-0056): who gets the button, what a proposal shows,
 * and what accepting, changing and rejecting send.
 */

function ik(delen: Partial<Ik> = {}): Ik {
  return {
    id: "a0000000-0000-4000-8000-000000000001",
    naam: "Leerkracht An",
    email: "an@school.be",
    isAdmin: false,
    heeftThemabeheer: false,
    heeftLeerlingzorg: false,
    hoofdleerkrachtLeeftijden: [],
    leerkrachtLeeftijden: ["K3"],
    eigenKlasIds: [],
    rapportklasIds: [],
    lopendeRapportklasIds: [],
    ...delen,
  };
}

const SUBTHEMA: SubthemaWeergave = {
  id: "s-1",
  themaId: "t-1",
  naam: "Drijven en zinken",
  duurWeken: 2,
  leeftijd: "K3",
  onderzoeksvragen: [],
  subdoelen: [
    {
      id: "sd-1",
      leeftijd: "K3",
      koppeling: { id: "k-1", leerplandoelCode: "WO-K3-01", status: "Manueel", aiMotivatie: null },
    },
  ],
  activiteiten: [],
};

const VOORSTEL: ActiviteitvoorstelWeergave = {
  id: "v-1",
  subthemaId: "s-1",
  aanvragerId: "a0000000-0000-4000-8000-000000000001",
  aanvragerNaam: "Leerkracht An",
  isEigen: true,
  naam: "Drijftafel",
  activiteitType: "Experiment",
  verwachteUitkomsten: "De kleuters testen voorwerpen in een bak water.",
  lengteInLesuren: 2,
  onderzoeksvraagId: "o-1",
  onderzoeksvraag: "Waarom blijft een boot drijven?",
  doelen: [
    { leerplandoelCode: "WO-K3-01", tekst: "Onderzoekt wat drijft en zinkt.", doelsoort: "Gemeenschappelijk" },
    { leerplandoelCode: "WO-K3-02", tekst: "Beschrijft hoe water beweegt.", doelsoort: "Gemeenschappelijk" },
  ],
  aiMotivatie: "Werkt aan drijven en zinken.",
};

type Oproep = { methode: string; pad: string; lichaam: unknown };

function toon(gebruiker: Ik, voorstellen: ActiviteitvoorstelWeergave[] = [VOORSTEL], subthema: SubthemaWeergave = SUBTHEMA) {
  const oproepen: Oproep[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const pad = String(url);
      const methode = init?.method ?? "GET";
      oproepen.push({ methode, pad, lichaam: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (pad.endsWith("/activiteitvoorstellen")) return new Response(JSON.stringify(voorstellen), { status: 200 });
      if (pad.endsWith("/genereer"))
        return new Response(JSON.stringify({ isGeslaagd: true, aantalVoorgesteld: 1, aantalOvergeslagen: 0, fout: null }), { status: 200 });
      if (pad.endsWith("/beslissing"))
        return new Response(JSON.stringify({ status: "Aanvaard", activiteitId: "a-1" }), { status: 200 });
      return new Response("[]", { status: 200 });
    }),
  );

  const leeg = () => {};
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Subthemahoofdstuk
        subthema={subthema}
        gevraagd
        mag={magVoor(gebruiker)}
        onBewerk={leeg}
        onVerwijder={leeg}
        onNieuweActiviteit={leeg}
        onBewerkActiviteit={leeg}
        onVerwijderActiviteit={leeg}
        onKoppelSubdoel={leeg}
        onOntkoppelSubdoel={leeg}
        onToonDoel={leeg}
      />
    </QueryClientProvider>,
  );
  return oproepen;
}

afterEach(() => vi.unstubAllGlobals());

describe("Activiteitvoorstellen", () => {
  it("toont een voorstel met ring, label, soort en lengte, beschrijving, doelen en motivatie", async () => {
    toon(ik());

    const kaart = await screen.findByRole("article", { name: "Drijftafel" });
    expect(kaart).toHaveClass("voorstel-ai");
    expect(within(kaart).getByText(t("activiteitvoorstel.aiVoorstel"))).toBeInTheDocument();
    expect(within(kaart).getByText("Experiment · 2 lesuren")).toBeInTheDocument();
    expect(within(kaart).getByText("De kleuters testen voorwerpen in een bak water.")).toBeInTheDocument();
    expect(within(kaart).getByText("Bij: Waarom blijft een boot drijven?")).toBeInTheDocument();
    expect(within(kaart).getByText("WO-K3-02")).toBeInTheDocument();
    expect(within(kaart).getByText("Werkt aan drijven en zinken.")).toBeInTheDocument();
    expect(within(kaart).queryByText(/Gevraagd door/)).not.toBeInTheDocument();
  });

  it("noemt bij de admin wie een voorstel van een collega vroeg", async () => {
    toon(ik({ isAdmin: true, leerkrachtLeeftijden: [] }), [
      { ...VOORSTEL, isEigen: false, aanvragerId: "b0000000-0000-4000-8000-000000000002", aanvragerNaam: "Leerkracht Bo" },
    ]);

    const kaart = await screen.findByRole("article", { name: "Drijftafel" });
    expect(within(kaart).getByText("Gevraagd door Leerkracht Bo")).toBeInTheDocument();
    expect(within(kaart).getByRole("button", { name: `${t("activiteitvoorstel.aanvaard")}: Drijftafel` })).toBeInTheDocument();
  });

  it("vraagt voorstellen met de AI-knop en meldt het resultaat", async () => {
    const oproepen = toon(ik(), []);

    fireEvent.click(await screen.findByRole("button", { name: t("activiteitvoorstel.vraag") }));

    expect(await screen.findByText("1 activiteit voorgesteld.")).toBeInTheDocument();
    expect(oproepen.some((o) => o.methode === "POST" && o.pad.endsWith("/api/subthemas/s-1/activiteitvoorstellen/genereer"))).toBe(true);
  });

  it("aanvaardt een voorstel zoals het is, of weigert het", async () => {
    const oproepen = toon(ik());

    fireEvent.click(await screen.findByRole("button", { name: `${t("activiteitvoorstel.aanvaard")}: Drijftafel` }));
    await waitFor(() => expect(oproepen.some((o) => o.pad.endsWith("/api/activiteitvoorstellen/v-1/beslissing"))).toBe(true));
    expect(oproepen.find((o) => o.pad.endsWith("/beslissing"))?.lichaam).toEqual({ status: "Aanvaard" });

    fireEvent.click(screen.getByRole("button", { name: `${t("plaatsing.weiger")}: Drijftafel` }));
    await waitFor(() => expect(oproepen.filter((o) => o.pad.endsWith("/beslissing"))).toHaveLength(2));
    expect(oproepen.filter((o) => o.pad.endsWith("/beslissing"))[1].lichaam).toEqual({ status: "Geweigerd" });
  });

  it("past een voorstel eerst aan en stuurt het hele formulier", async () => {
    const oproepen = toon(ik());

    fireEvent.click(await screen.findByRole("button", { name: `${t("plaatsing.pasAan")}: Drijftafel` }));
    fireEvent.change(screen.getByLabelText(t("activiteitvoorstel.naam")), { target: { value: "Bootjes laten varen" } });
    fireEvent.change(screen.getByLabelText(t("activiteit.soort")), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(t("activiteitvoorstel.lengte")), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /WO-K3-01/ }));
    fireEvent.click(screen.getByRole("button", { name: t("activiteitvoorstel.aanvaard") }));

    await waitFor(() => expect(oproepen.some((o) => o.pad.endsWith("/beslissing"))).toBe(true));
    expect(oproepen.find((o) => o.pad.endsWith("/beslissing"))?.lichaam).toEqual({
      status: "Aanvaard",
      naam: "Bootjes laten varen",
      activiteitType: null,
      verwachteUitkomsten: "De kleuters testen voorwerpen in een bak water.",
      lengteInLesuren: 1,
      leerplandoelCodes: ["WO-K3-02"],
    });
  });

  it("weigert een lengte buiten 1 tot 4 zonder iets te sturen", async () => {
    const oproepen = toon(ik());

    fireEvent.click(await screen.findByRole("button", { name: `${t("plaatsing.pasAan")}: Drijftafel` }));
    fireEvent.change(screen.getByLabelText(t("activiteitvoorstel.lengte")), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: t("activiteitvoorstel.aanvaard") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t("activiteitvoorstel.lengteOngeldig"));
    expect(oproepen.some((o) => o.pad.endsWith("/beslissing"))).toBe(false);
  });

  it("toont geen knop en vraagt geen voorstellen voor wie geen eigen activiteit mag maken", async () => {
    const oproepen = toon(ik({ leerkrachtLeeftijden: ["K2"], hoofdleerkrachtLeeftijden: ["K3"] }));

    expect(await screen.findByText(t("thema.activiteitenTitel"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("activiteitvoorstel.vraag") })).not.toBeInTheDocument();
    expect(oproepen.some((o) => o.pad.endsWith("/activiteitvoorstellen"))).toBe(false);
  });
});

describe("Subthemahoofdstuk: een opengeklapt subthema zonder subdoelen (FB-094)", () => {
  const ZONDER: SubthemaWeergave = { ...SUBTHEMA, subdoelen: [] };

  it("toont geen AI-knop die niets kan, maar een rustige zin, en noemt de subdoelen één keer", async () => {
    toon(ik(), [], ZONDER);

    expect(await screen.findByText(t("activiteitvoorstel.naSubdoelen"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("activiteitvoorstel.vraag") })).toBeNull();
    // A leerkracht may not link a subdoel: no first step, one line that says there are none, and nothing to hide.
    expect(screen.queryByRole("heading", { name: t("thema.beginSubdoelenTitel") })).toBeNull();
    expect(screen.getByText(t("thema.geenSubdoelen"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("thema.subdoelenBekijken") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("thema.subdoelenVerbergen") })).toBeNull();
    expect(screen.queryByText(t("thema.subdoelenTitel"))).toBeNull();
  });

  it("zet voor wie subdoelen mag koppelen de eerste stap bovenaan, en opent daar het zoekveld over de volle breedte", async () => {
    toon(ik({ hoofdleerkrachtLeeftijden: ["K3"] }), [], ZONDER);

    const stap = await screen.findByRole("region", { name: t("thema.beginSubdoelenTitel") });
    // The step says it once; no second "no subdoelen" line under the activiteiten.
    expect(screen.queryByText(t("thema.geenSubdoelen"))).toBeNull();
    fireEvent.click(within(stap).getByRole("button", { name: t("thema.subdoelKoppelenAan", { naam: "Drijven en zinken" }) }));

    const vak = screen.getByRole("region", { name: t("thema.subdoelKoppelen") });
    expect(within(vak).getByRole("textbox", { name: t("doelkiezer.zoek") })).toHaveFocus();
    expect(screen.queryByRole("region", { name: t("thema.beginSubdoelenTitel") })).toBeNull();

    fireEvent.click(within(vak).getByRole("button", { name: t("themabeheer.annuleer") }));
    expect(await screen.findByRole("region", { name: t("thema.beginSubdoelenTitel") })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: t("thema.subdoelKoppelen") })).toBeNull();
  });

  it("zegt bij enkel een onbeslist subdoel dat de AI wacht op een aanvaard subdoel", async () => {
    toon(ik(), [], {
      ...SUBTHEMA,
      subdoelen: [{ ...SUBTHEMA.subdoelen[0], koppeling: { ...SUBTHEMA.subdoelen[0].koppeling, status: "Voorgesteld" } }],
    });

    expect(await screen.findByText(t("activiteitvoorstel.naBeslistSubdoel"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("activiteitvoorstel.vraag") })).toBeNull();
    expect(screen.getByRole("button", { name: t("thema.subdoelenBekijken"), expanded: false })).toBeInTheDocument();
  });

  it("opent met subdoelen het zoekveld onder de kop Subdoelen, met Annuleren in die kop", async () => {
    toon(ik({ hoofdleerkrachtLeeftijden: ["K3"] }), []);

    fireEvent.click(await screen.findByRole("button", { name: t("thema.subdoelenBekijken") }));
    fireEvent.click(screen.getByRole("button", { name: t("thema.koppelAanSubthema", { naam: "Drijven en zinken" }) }));

    const lijst = screen.getByRole("heading", { name: t("thema.subdoelenTitel") }).closest("section")!;
    expect(within(lijst).getByRole("textbox", { name: t("doelkiezer.zoek") })).toHaveFocus();
    fireEvent.click(within(lijst).getByRole("button", { name: t("themabeheer.annuleer") }));
    expect(within(lijst).queryByRole("textbox", { name: t("doelkiezer.zoek") })).toBeNull();
  });
});
