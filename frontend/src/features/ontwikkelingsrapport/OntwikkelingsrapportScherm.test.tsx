import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave, SchooljaarSamenvatting } from "../../lib/types";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { t } from "../../i18n";
import type { Leerling } from "./leerlingen";
import { OntwikkelingsrapportScherm } from "./OntwikkelingsrapportScherm";

/**
 * The children of a K3 klas (FB-001), as each person meets them: a K3 leerkracht during and after the schooljaar,
 * directie, and someone who may read no report. Every name here is invented (Art. VI.7: no real child's name in the
 * repo).
 */

const JAAR: SchooljaarSamenvatting = { id: "jaar-1", naam: "2026-2027", start: "2026-09-01", eind: "2027-06-30" };
const klasVan = (id: string, naam: string, jaarfase: string): KlasWeergave => ({
  id,
  schooljaarId: JAAR.id,
  naam,
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: [jaarfase],
  jaarfase,
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: jaarfase === "K3",
});
const BLAUW = klasVan("k3-blauw", "K3 blauw", "K3");
const GROEN = klasVan("k3-groen", "K3 groen", "K3");
const ROOD = klasVan("k2-rood", "K2 rood", "K2");

/*
  The selection, as a value a test may replace (the empty and the failed cases below) and `afterEach` puts back.
  Spelled out rather than referring to the constants above: `vi.hoisted` runs before them.

  The klassen pin "follow the server" in both directions (antagonist rounds 1 and 2): a menggroep stated as K2 that
  the server says can hold children is offered, as it would be once directie decides the graadklas question
  (Art. XIV), and a klas stated as K3 that the server says cannot is not. A second mapping in the screen would fail
  one of the two.
*/
const selectie = vi.hoisted(() => {
  const jaar = { id: "jaar-1", naam: "2026-2027", start: "2026-09-01", eind: "2027-06-30" };
  const standaard = () => ({
    schooljaarId: jaar.id as string | null,
    klasId: null,
    schooljaar: jaar as typeof jaar | null,
    schooljaren: [jaar],
    klassen: [
      { id: "k2-rood", naam: "K2 rood", jaarfase: "K2", kanLeerlingenHebben: false },
      { id: "k3-blauw", naam: "K3 blauw", jaarfase: "K3", kanLeerlingenHebben: true },
      { id: "k3-groen", naam: "K3 groen", jaarfase: "K3", kanLeerlingenHebben: true },
      { id: "menggroep", naam: "Menggroep", jaarfase: "K2", kanLeerlingenHebben: true },
      { id: "k3-zonder", naam: "K3 zonder kinderen", jaarfase: "K3", kanLeerlingenHebben: false },
    ].map((klas) => ({
      ...klas,
      schooljaarId: jaar.id,
      leerjaar: 0,
      aantalSubthemas: 0,
      jaarFasen: [klas.jaarfase],
      mogelijkeJaarfasen: [],
    })),
    laadt: false,
    fout: false,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  });
  return { standaard, huidig: { waarde: standaard() } };
});

vi.mock("../../lib/selectie", () => ({ useActieveSelectie: () => selectie.huidig.waarde }));

const LEERKRACHT_BLAUW = ikMet({
  eigenKlasIds: [BLAUW.id],
  leerkrachtLeeftijden: ["K3"],
  rapportklasIds: [BLAUW.id],
  lopendeRapportklasIds: [BLAUW.id],
});
const LEERKRACHT_BLAUW_VOORBIJ = ikMet({ eigenKlasIds: [BLAUW.id], rapportklasIds: [BLAUW.id] });

const FIEN: Leerling = { id: "kind-1", klasId: BLAUW.id, voornaam: "Fien", achternaam: "Proefmans" };

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

interface Verzoek {
  methode: string;
  pad: string;
  lichaam?: unknown;
}

/** A small server over an in-memory list, so a write and the list read after it agree. */
function toon(ik: Ik, beginlijst: Leerling[] = [FIEN]) {
  let kinderen = [...beginlijst];
  const verzoeken: Verzoek[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (invoer: string, init?: RequestInit) => {
      const pad = String(invoer);
      const methode = init?.method ?? "GET";
      const lichaam = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : undefined;
      verzoeken.push({ methode, pad, lichaam });

      const lijst = /\/api\/klassen\/([^/]+)\/leerlingen$/.exec(pad);
      if (lijst && methode === "GET") return json(kinderen.filter((kind) => kind.klasId === lijst[1]));
      if (lijst && methode === "POST") {
        const kind = { id: `kind-${kinderen.length + 1}`, klasId: lijst[1], ...lichaam } as Leerling;
        kinderen = [...kinderen, kind];
        return json(kind, 201);
      }
      const een = /\/api\/leerlingen\/([^/]+)$/.exec(pad);
      if (een && methode === "PUT") {
        kinderen = kinderen.map((kind) => (kind.id === een[1] ? { ...kind, ...lichaam } : kind));
        return json(kinderen.find((kind) => kind.id === een[1]));
      }
      if (een && methode === "DELETE") {
        kinderen = kinderen.filter((kind) => kind.id !== een[1]);
        return new Response(null, { status: 204 });
      }
      return json({}, 404);
    }),
  );

  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/ontwikkelingsrapport"]}>
        <OntwikkelingsrapportScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return verzoeken;
}

/**
 * A child's row by its whole name. The voornaam is a `span` of its own (it carries the weight), so the name is split
 * over two nodes and a plain string would match neither: this matches the paragraph that holds both.
 */
const kind = (naam: string) => (_: string, element: Element | null) =>
  element?.tagName === "P" && element.textContent === naam;

const voornaam = () => screen.getByRole("textbox", { name: t("ontwikkelingsrapport.voornaam") });
const achternaam = () => screen.getByRole("textbox", { name: t("ontwikkelingsrapport.achternaam") });

afterEach(() => {
  vi.unstubAllGlobals();
  selectie.huidig.waarde = selectie.standaard();
});

describe("OntwikkelingsrapportScherm, de kinderen van de klas", () => {
  it("toont een K3-leerkracht de kinderen van de eigen klas, en vraagt niets dan voornaam en achternaam", async () => {
    toon(LEERKRACHT_BLAUW);

    expect(await screen.findByText(kind("Fien Proefmans"))).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(voornaam()).toBeInTheDocument();
    expect(achternaam()).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.eenKind"))).toBeInTheDocument();
  });

  it("biedt alleen de K3-klassen aan die deze persoon mag lezen", async () => {
    toon(LEERKRACHT_BLAUW);
    await screen.findByText(kind("Fien Proefmans"));

    const keuze = screen.getByRole("combobox", { name: t("context.klas") });
    expect(within(keuze).getAllByRole("option").map((optie) => optie.textContent)).toEqual([BLAUW.naam]);
  });

  it("voegt een kind toe, maakt de velden leeg en zet de focus terug op de voornaam", async () => {
    const verzoeken = toon(LEERKRACHT_BLAUW);
    await screen.findByText(kind("Fien Proefmans"));

    fireEvent.change(voornaam(), { target: { value: " Staf " } });
    fireEvent.change(achternaam(), { target: { value: "Voorbeeld" } });
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.toevoegen") }));

    expect(await screen.findByText(kind("Staf Voorbeeld"))).toBeInTheDocument();
    expect(verzoeken).toContainEqual({
      methode: "POST",
      pad: `/api/klassen/${BLAUW.id}/leerlingen`,
      lichaam: { voornaam: "Staf", achternaam: "Voorbeeld" },
    });
    await waitFor(() => expect(voornaam()).toHaveFocus());
    expect(voornaam()).toHaveValue("");
    expect(achternaam()).toHaveValue("");
  });

  it("weigert een lege achternaam zonder iets te versturen", async () => {
    const verzoeken = toon(LEERKRACHT_BLAUW);
    await screen.findByText(kind("Fien Proefmans"));

    fireEvent.change(voornaam(), { target: { value: "Staf" } });
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.toevoegen") }));

    expect(screen.getByRole("alert")).toHaveTextContent(t("ontwikkelingsrapport.achternaamVerplicht"));
    expect(achternaam()).toHaveFocus();
    expect(verzoeken.some((verzoek) => verzoek.methode === "POST")).toBe(false);
  });

  it("wijzigt de naam van een kind op zijn eigen rij", async () => {
    const verzoeken = toon(LEERKRACHT_BLAUW);
    fireEvent.click(await screen.findByRole("button", { name: t("ontwikkelingsrapport.wijzigKind", { naam: "Fien Proefmans" }) }));

    // The row's own fields, filled with the name, next to the add form's two.
    const velden = screen.getAllByRole("textbox", { name: t("ontwikkelingsrapport.voornaam") });
    const bewerking = velden.find((veld) => (veld as HTMLInputElement).value === "Fien")!;
    expect(bewerking).toHaveFocus();
    fireEvent.change(bewerking, { target: { value: "Fiene" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByText(kind("Fiene Proefmans"))).toBeInTheDocument();
    expect(verzoeken).toContainEqual({
      methode: "PUT",
      pad: `/api/leerlingen/${FIEN.id}`,
      lichaam: { voornaam: "Fiene", achternaam: "Proefmans" },
    });
  });

  it("verwijdert een kind na een bevestiging die zegt dat de rapporten meegaan", async () => {
    const verzoeken = toon(LEERKRACHT_BLAUW);
    fireEvent.click(await screen.findByRole("button", { name: t("ontwikkelingsrapport.verwijderKind", { naam: "Fien Proefmans" }) }));

    const venster = await screen.findByRole("dialog");
    expect(venster).toHaveTextContent(t("ontwikkelingsrapport.verwijderGevolg"));
    fireEvent.click(within(venster).getByRole("button", { name: t("themabeheer.verwijder") }));

    expect(await screen.findByText(t("ontwikkelingsrapport.geenKinderen"))).toBeInTheDocument();
    expect(verzoeken).toContainEqual({ methode: "DELETE", pad: `/api/leerlingen/${FIEN.id}`, lichaam: undefined });
  });
});

describe("OntwikkelingsrapportScherm, wie wat mag", () => {
  it("laat de leerkracht na het schooljaar alleen lezen, en zegt waarom (R26)", async () => {
    toon(LEERKRACHT_BLAUW_VOORBIJ);

    expect(await screen.findByText(kind("Fien Proefmans"))).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.alleenLezen"))).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: t("ontwikkelingsrapport.wijzigKind", { naam: "Fien Proefmans" }) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("ontwikkelingsrapport.verwijderKind", { naam: "Fien Proefmans" }) })).not.toBeInTheDocument();
  });

  it("laat directie elke klas beheren die kinderen kan hebben, en zegt niet dat het schooljaar voorbij is", async () => {
    toon(DIRECTIE);

    expect(await screen.findByText(kind("Fien Proefmans"))).toBeInTheDocument();
    expect(voornaam()).toBeInTheDocument();
    expect(screen.queryByText(t("ontwikkelingsrapport.alleenLezen"))).not.toBeInTheDocument();
    const keuze = screen.getByRole("combobox", { name: t("context.klas") });
    // The server's answer decides, not the jaarfase, in both directions: K2 rood and the K3 klas the server says cannot
    // hold children are left out, and the menggroep stated as K2 that the server says can is offered.
    expect(within(keuze).getAllByRole("option").map((optie) => optie.textContent)).toEqual([
      BLAUW.naam,
      GROEN.naam,
      "Menggroep",
    ]);
  });

  it("zegt 'nog geen schooljaar' als er echt geen is", async () => {
    selectie.huidig.waarde = {
      ...selectie.standaard(),
      schooljaarId: null,
      schooljaar: null,
      schooljaren: [],
      klassen: [],
    };
    toon(DIRECTIE, []);

    expect(await screen.findByText(t("ontwikkelingsrapport.geenSchooljaar"))).toBeInTheDocument();
  });

  it("zegt bij een mislukte lading niet dat er geen schooljaar of klas is (the E5-03 rule)", async () => {
    selectie.huidig.waarde = {
      ...selectie.standaard(),
      schooljaarId: null,
      schooljaar: null,
      schooljaren: [],
      klassen: [],
      fout: true,
    };
    toon(DIRECTIE, []);

    expect(await screen.findByText(t("ontwikkelingsrapport.selectieLaadFout"))).toBeInTheDocument();
    expect(screen.queryByText(t("ontwikkelingsrapport.geenSchooljaar"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("ontwikkelingsrapport.geenK3Klas"))).not.toBeInTheDocument();
  });

  it("zegt wie geen rapport mag lezen dat die geen toegang heeft, en vraagt geen kinderen op (R17)", async () => {
    const verzoeken = toon(ikMet({ eigenKlasIds: [ROOD.id], leerkrachtLeeftijden: ["K2"], hoofdleerkrachtLeeftijden: ["K3"] }));

    expect(await screen.findByText(t("ontwikkelingsrapport.geenToegang"))).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: t("context.klas") })).not.toBeInTheDocument();
    expect(verzoeken.some((verzoek) => verzoek.pad.includes("/leerlingen"))).toBe(false);
  });

  it("zegt een K3-leerkracht zonder K3-klas in dit schooljaar precies dat", async () => {
    const verzoeken = toon(ikMet({ eigenKlasIds: ["vorig-jaar"], rapportklasIds: ["vorig-jaar"] }));

    expect(await screen.findByText(t("ontwikkelingsrapport.geenEigenK3Klas"))).toBeInTheDocument();
    expect(verzoeken.some((verzoek) => verzoek.pad.includes("/leerlingen"))).toBe(false);
  });
});
