import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave, SchooljaarSamenvatting } from "../../lib/types";
import { t } from "../../i18n";
import type { GebruikerBeheer, GebruikersOverzicht } from "./gebruikerbeheer";
import { GebruikersScherm } from "./GebruikersScherm";

/**
 * Instellingen, Gebruikers (E6-04). What is pinned here is what a browser pass reads least
 * reliably: which request a tick sends, that the server's refusal of the last directie reaches the
 * sheet in its own words, that an unbound invitation says so, and which sentence a jaarfase without
 * a hoofdleerkracht earns (the E5-03 rule). How it looks is the browser pass.
 */

const JAAR: SchooljaarSamenvatting = { id: "jaar-1", naam: "2026-2027", start: "2026-09-01", eind: "2027-06-30" };
const K3: KlasWeergave = {
  id: "klas-k3",
  schooljaarId: JAAR.id,
  naam: "K3 groen",
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: ["K3"],
  jaarfase: "K3",
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: true,
};
const L1: KlasWeergave = {
  ...K3,
  id: "klas-l1",
  naam: "L1 blauw",
  leerjaar: 1,
  jaarFasen: ["L1"],
  jaarfase: "L1",
  kanLeerlingenHebben: false,
};

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    schooljaar: JAAR,
    schooljaren: [JAAR],
    klassen: [K3, L1],
    laadt: false,
    kiesSchooljaar: () => {},
  }),
}));

const IK: Ik = {
  id: "directie-1",
  naam: "Dirk Janssens",
  email: "dirk@school.be",
  isDirectie: true,
  heeftThemabeheer: false,
  hoofdleerkrachtLeeftijden: [],
  leerkrachtLeeftijden: [],
  eigenKlasIds: [],
  rapportklasIds: [],
  lopendeRapportklasIds: [],
};

function gebruiker(overrides: Partial<GebruikerBeheer> = {}): GebruikerBeheer {
  return {
    id: "g-1",
    naam: "An Peeters",
    email: "an.peeters@school.be",
    isDirectie: false,
    heeftThemabeheer: false,
    isAangemeld: true,
    klastoewijzingen: [],
    hoofdleerkrachtaanstellingen: [],
    ...overrides,
  };
}

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

/** What the fake server answers to a write; `undefined` is a 404. May wait, to hold a save in flight. */
type Schrijfantwoord = { status: number; body?: unknown } | undefined;
type Antwoord = (pad: string, methode: string) => Schrijfantwoord | Promise<Schrijfantwoord>;

/**
 * Serves the screen's reads, and hands every write to `schrijf`. Stateful like the real server: a
 * write that answers a gebruiker is what the next read of the list returns, because every write
 * is followed by a refetch, and a static list would undo in the test what the server saved.
 */
function toon(
  overzicht: GebruikersOverzicht,
  schrijf: Antwoord = () => undefined,
  /** The status the list answers once a write succeeded: 403 after directie gave up their own right. */
  opties: { lijstNaSchrijven?: number; lijstNaFout?: GebruikersOverzicht } = {},
) {
  let huidig = overzicht;
  let lijstStatus = 200;
  const fetchMock = vi.fn(async (pad: string, init?: RequestInit) => {
    const methode = init?.method ?? "GET";
    if (methode === "GET" && pad.endsWith("/api/ik")) return json(IK);
    if (methode === "GET" && pad.endsWith("/api/jaarfasen")) return json(["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"]);
    if (methode === "GET" && pad.endsWith("/api/gebruikers")) return lijstStatus === 200 ? json(huidig) : json({}, lijstStatus);
    const antwoord = await schrijf(pad, methode);
    if (!antwoord) return json({}, 404);
    if (antwoord.status < 300 && opties.lijstNaSchrijven) lijstStatus = opties.lijstNaSchrijven;
    // What the server holds after a write that found the person gone: the list without them.
    if (antwoord.status >= 400 && opties.lijstNaFout) huidig = opties.lijstNaFout;
    const bewaard = antwoord.body as GebruikerBeheer | undefined;
    if (antwoord.status < 300 && bewaard?.id) {
      const bestaat = huidig.gebruikers.some((g) => g.id === bewaard.id);
      huidig = {
        ...huidig,
        gebruikers: bestaat ? huidig.gebruikers.map((g) => (g.id === bewaard.id ? bewaard : g)) : [...huidig.gebruikers, bewaard],
      };
    }
    return json(antwoord.body ?? {}, antwoord.status);
  });
  vi.stubGlobal("fetch", fetchMock);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/instellingen/gebruikers"]}>
        <GebruikersScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetchMock;
}

async function openRechten(naam: string) {
  fireEvent.click(await screen.findByRole("button", { name: t("gebruikers.rechtenVan", { naam }) }));
  return screen.findByRole("dialog", { name: t("gebruikers.rechtenVan", { naam }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GebruikersScherm", () => {
  it("zegt bij een uitnodiging die nog niemand gebruikte dat de persoon nog niet aangemeld is, en alleen daar", async () => {
    toon({
      gebruikers: [gebruiker({ isAangemeld: false }), gebruiker({ id: "g-2", naam: "Bert Claes", isAangemeld: true })],
      voorbijeSchooljaarIds: [],
    });

    expect(await screen.findByText("Bert Claes")).toBeInTheDocument();
    const nietAangemeld = screen.getAllByText(t("gebruikers.nietAangemeld"));
    expect(nietAangemeld).toHaveLength(1);
    expect(nietAangemeld[0].closest("li")).toHaveTextContent("An Peeters");
  });

  it("toont de rechten als woorden, met de klassen en jaarfasen van het gekozen schooljaar", async () => {
    toon({
      gebruikers: [
        gebruiker({
          isDirectie: true,
          heeftThemabeheer: true,
          klastoewijzingen: [
            { klasId: K3.id, klasNaam: K3.naam, jaarfase: "K3", schooljaarId: JAAR.id, teltVoorGedeeldeInhoud: true },
            { klasId: "oud", klasNaam: "K3 vorig jaar", jaarfase: "K3", schooljaarId: "jaar-0", teltVoorGedeeldeInhoud: false },
          ],
          hoofdleerkrachtaanstellingen: [{ schooljaarId: JAAR.id, jaarfase: "K3", teltVoorGedeeldeInhoud: true }],
        }),
      ],
      voorbijeSchooljaarIds: [],
    });

    // Through the row's own button: the name also appears in the hoofdleerkracht line above the list.
    const rij = (await screen.findByRole("button", { name: t("gebruikers.rechtenVan", { naam: "An Peeters" }) })).closest("li")!;
    expect(rij).toHaveTextContent(
      [
        t("gebruikers.directie"),
        t("gebruikers.themabeheer"),
        t("gebruikers.eenKlas", { namen: "K3 groen" }),
        t("gebruikers.hoofdleerkrachtVan", { fasen: "K3" }),
      ].join(" · "),
    );
    expect(rij).not.toHaveTextContent("K3 vorig jaar");
  });

  it("bewaart een aangevinkte klas meteen, met een PUT op die ene koppeling", async () => {
    const an = gebruiker();
    const fetchMock = toon({ gebruikers: [an], voorbijeSchooljaarIds: [] }, (pad, methode) =>
      methode === "PUT" && pad.endsWith(`/api/gebruikers/${an.id}/klassen/${K3.id}`)
        ? {
            status: 200,
            body: {
              ...an,
              klastoewijzingen: [
                { klasId: K3.id, klasNaam: K3.naam, jaarfase: "K3", schooljaarId: JAAR.id, teltVoorGedeeldeInhoud: true },
              ],
            },
          }
        : undefined,
    );

    const blad = await openRechten(an.naam);
    const vakje = within(blad).getByRole("checkbox", { name: K3.naam });
    expect(vakje).not.toBeChecked();
    fireEvent.click(vakje);

    await waitFor(() => expect(within(blad).getByRole("checkbox", { name: K3.naam })).toBeChecked());
    const schrijven = fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
    expect(schrijven).toHaveLength(1);
    expect(schrijven[0][0]).toBe(`/api/gebruikers/${an.id}/klassen/${K3.id}`);
    expect(schrijven[0][1]?.method).toBe("PUT");
    expect(within(blad).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stelt iemand aan als hoofdleerkracht van een jaarfase in het gekozen schooljaar", async () => {
    const an = gebruiker();
    const fetchMock = toon({ gebruikers: [an], voorbijeSchooljaarIds: [] }, (pad, methode) =>
      methode === "PUT" && pad.endsWith(`/api/gebruikers/${an.id}/hoofdleerkracht/${JAAR.id}/L1`)
        ? {
            status: 200,
            body: { ...an, hoofdleerkrachtaanstellingen: [{ schooljaarId: JAAR.id, jaarfase: "L1", teltVoorGedeeldeInhoud: true }] },
          }
        : undefined,
    );

    const blad = await openRechten(an.naam);
    fireEvent.click(await within(blad).findByRole("checkbox", { name: "L1" }));

    await waitFor(() => expect(within(blad).getByRole("checkbox", { name: "L1" })).toBeChecked());
    expect(fetchMock.mock.calls.some(([pad, init]) => pad === `/api/gebruikers/${an.id}/hoofdleerkracht/${JAAR.id}/L1` && init?.method === "PUT")).toBe(true);
  });

  it("toont de weigering van de server als de laatste directie haar recht zou verliezen, en laat het vakje staan", async () => {
    const reden = "An Peeters is de enige met het directierecht. Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld.";
    const an = gebruiker({ isDirectie: true });
    toon({ gebruikers: [an], voorbijeSchooljaarIds: [] }, (pad, methode) =>
      methode === "DELETE" && pad.endsWith(`/api/gebruikers/${an.id}/directierecht`)
        ? { status: 409, body: { status: 409, title: "Niet doorgevoerd", detail: reden } }
        : undefined,
    );

    const blad = await openRechten(an.naam);
    const vakje = within(blad).getByRole("checkbox", { name: t("gebruikers.directie") });
    expect(vakje).toBeChecked();
    fireEvent.click(vakje);

    expect(await within(blad).findByRole("alert")).toHaveTextContent(reden);
    expect(within(blad).getByRole("checkbox", { name: t("gebruikers.directie") })).toBeChecked();
  });

  it("toont de weigering ook als de laatste directie verwijderd zou worden", async () => {
    const reden = "An Peeters is de enige met het directierecht en kan niet verwijderd worden. Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld.";
    const an = gebruiker({ isDirectie: true });
    toon({ gebruikers: [an], voorbijeSchooljaarIds: [] }, (pad, methode) =>
      methode === "DELETE" && pad.endsWith(`/api/gebruikers/${an.id}`) ? { status: 409, body: { status: 409, detail: reden } } : undefined,
    );

    const blad = await openRechten(an.naam);
    fireEvent.click(within(blad).getByRole("button", { name: t("gebruikers.verwijderen") }));
    const bevestiging = await screen.findByRole("dialog", { name: t("gebruikers.verwijderTitel", { naam: an.naam }) });
    expect(bevestiging).toHaveTextContent(t("gebruikers.verwijderGevolg", { naam: an.naam }));
    fireEvent.click(within(bevestiging).getByRole("button", { name: t("themabeheer.verwijder") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(reden);
    expect(screen.getByText("An Peeters")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  });

  it("houdt de focus op het aangevinkte vakje terwijl de wijziging bewaard wordt, en negeert een tweede vinkje", async () => {
    // Fix round 1, MINOR 5: a box that turns `disabled` loses focus in a browser, so a keyboard user who ticked it with
    // Space was dropped on the page body. The boxes wait as `aria-disabled` instead.
    const an = gebruiker();
    let laatGaan!: () => void;
    const vrij = new Promise<void>((klaar) => {
      laatGaan = klaar;
    });
    const fetchMock = toon({ gebruikers: [an], voorbijeSchooljaarIds: [] }, async (pad, methode) => {
      if (methode !== "PUT" || !pad.endsWith(`/api/gebruikers/${an.id}/klassen/${K3.id}`)) return undefined;
      await vrij;
      return {
        status: 200,
        body: {
          ...an,
          klastoewijzingen: [{ klasId: K3.id, klasNaam: K3.naam, jaarfase: "K3", schooljaarId: JAAR.id, teltVoorGedeeldeInhoud: true }],
        },
      };
    });

    const blad = await openRechten(an.naam);
    const vakje = within(blad).getByRole("checkbox", { name: K3.naam });
    vakje.focus();
    fireEvent.click(vakje);

    await waitFor(() => expect(vakje).toHaveAttribute("aria-disabled", "true"));
    expect(vakje).not.toBeDisabled();
    expect(vakje).toHaveFocus();
    expect(vakje).toBeChecked();
    fireEvent.click(within(blad).getByRole("checkbox", { name: L1.naam }));

    laatGaan();
    await waitFor(() => expect(vakje).not.toHaveAttribute("aria-disabled"));
    expect(vakje).toHaveFocus();
    expect(vakje).toBeChecked();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET")).toHaveLength(1);
  });

  it("vraagt bevestiging voor wie het eigen directierecht afgeeft, en toont daarna geen laadfout", async () => {
    // Fix round 1, QUESTION 7: the one tick you cannot undo yourself asks first, and the moment after it (the list now
    // answers 403, the gate has not moved you yet) must not flash "could not be loaded".
    const ikZelf = gebruiker({ id: IK.id, naam: IK.naam, isDirectie: true });
    const ander = gebruiker({ id: "g-2", naam: "Bert Claes", isDirectie: true });
    const fetchMock = toon(
      { gebruikers: [ander, ikZelf], voorbijeSchooljaarIds: [] },
      (pad, methode) =>
        methode === "DELETE" && pad.endsWith(`/api/gebruikers/${IK.id}/directierecht`)
          ? { status: 200, body: { ...ikZelf, isDirectie: false } }
          : undefined,
      { lijstNaSchrijven: 403 },
    );
    const schrijven = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");

    const blad = await openRechten(IK.naam);
    fireEvent.click(within(blad).getByRole("checkbox", { name: t("gebruikers.directie") }));
    const vraag = await screen.findByRole("dialog", { name: t("gebruikers.afgevenTitel") });
    expect(vraag).toHaveTextContent(t("gebruikers.afgevenGevolg"));
    expect(schrijven()).toHaveLength(0);

    fireEvent.click(within(vraag).getByRole("button", { name: t("themabeheer.annuleer") }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: t("gebruikers.afgevenTitel") })).not.toBeInTheDocument());
    expect(schrijven()).toHaveLength(0);
    expect(within(blad).getByRole("checkbox", { name: t("gebruikers.directie") })).toBeChecked();

    fireEvent.click(within(blad).getByRole("checkbox", { name: t("gebruikers.directie") }));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: t("gebruikers.afgevenTitel") })).getByRole("button", {
        name: t("gebruikers.afgevenBevestig"),
      }),
    );

    await waitFor(() => expect(schrijven()).toHaveLength(1));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([pad]) => String(pad).endsWith("/api/ik")).length).toBeGreaterThan(1));
    await new Promise((klaar) => setTimeout(klaar, 50));
    expect(screen.queryByText(t("gebruikers.laadMislukt"))).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([pad]) => String(pad).endsWith("/api/gebruikers"))).toHaveLength(1);
  });

  it("geeft het directierecht van iemand anders meteen af, zonder te vragen", async () => {
    const ander = gebruiker({ id: "g-2", naam: "Bert Claes", isDirectie: true });
    const fetchMock = toon({ gebruikers: [ander], voorbijeSchooljaarIds: [] }, (pad, methode) =>
      methode === "DELETE" && pad.endsWith(`/api/gebruikers/${ander.id}/directierecht`)
        ? { status: 200, body: { ...ander, isDirectie: false } }
        : undefined,
    );

    const blad = await openRechten(ander.naam);
    fireEvent.click(within(blad).getByRole("checkbox", { name: t("gebruikers.directie") }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true));
    expect(screen.queryByRole("dialog", { name: t("gebruikers.afgevenTitel") })).not.toBeInTheDocument();
  });

  it("zegt wie zichzelf verwijdert dat die meteen afgemeld wordt", async () => {
    const ikZelf = gebruiker({ id: IK.id, naam: IK.naam, isDirectie: true });
    toon({ gebruikers: [ikZelf], voorbijeSchooljaarIds: [] });

    const blad = await openRechten(IK.naam);
    fireEvent.click(within(blad).getByRole("button", { name: t("gebruikers.verwijderen") }));

    const bevestiging = await screen.findByRole("dialog", { name: t("gebruikers.verwijderTitel", { naam: IK.naam }) });
    expect(bevestiging).toHaveTextContent(t("gebruikers.verwijderZelfGevolg"));
    expect(bevestiging).not.toHaveTextContent(t("gebruikers.verwijderGevolg", { naam: IK.naam }));
  });

  it("sluit het blad en zegt het boven de lijst als een vinkje een gebruiker raakt die intussen verwijderd is", async () => {
    // Round 3: after a 404 the list used to go on showing the removed person, with a live sheet whose next tick answered
    // 404 again. Now a 404 refetches the list, the sheet closes because its person is gone, and the screen says so above
    // the list.
    const an = gebruiker();
    const bert = gebruiker({ id: "g-2", naam: "Bert Claes" });
    const fetchMock = toon(
      { gebruikers: [an, bert], voorbijeSchooljaarIds: [] },
      (pad, methode) =>
        methode === "PUT" && pad.endsWith(`/api/gebruikers/${an.id}/klassen/${K3.id}`)
          ? { status: 404, body: { status: 404, detail: "Deze gebruiker is intussen verwijderd." } }
          : undefined,
      { lijstNaFout: { gebruikers: [bert], voorbijeSchooljaarIds: [] } },
    );

    const blad = await openRechten(an.naam);
    fireEvent.click(within(blad).getByRole("checkbox", { name: K3.naam }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: t("gebruikers.rechtenVan", { naam: an.naam }) })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(t("gebruikers.verdwenen", { naam: an.naam }));
    expect(screen.queryByRole("button", { name: t("gebruikers.rechtenVan", { naam: an.naam }) })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("gebruikers.rechtenVan", { naam: bert.naam }) })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([pad, init]) => String(pad).endsWith("/api/gebruikers") && !init?.method)).toHaveLength(2);
  });

  it("zet de focus op de melding boven de lijst als een 404 het blad sluit", async () => {
    // Owner-approved mini-fix after audit round 4: the control that had focus closed with the sheet, and on a phone the
    // alert can sit far above the row the person was on. Focusing it brings it into view; it is not a tab stop.
    const an = gebruiker();
    const bert = gebruiker({ id: "g-2", naam: "Bert Claes" });
    toon(
      { gebruikers: [an, bert], voorbijeSchooljaarIds: [] },
      (pad, methode) =>
        methode === "PUT" && pad.endsWith(`/api/gebruikers/${an.id}/klassen/${K3.id}`)
          ? { status: 404, body: { status: 404, detail: "Deze gebruiker is intussen verwijderd." } }
          : undefined,
      { lijstNaFout: { gebruikers: [bert], voorbijeSchooljaarIds: [] } },
    );

    const blad = await openRechten(an.naam);
    fireEvent.click(within(blad).getByRole("checkbox", { name: K3.naam }));

    // First the sheet shows the 404 itself, until the refetched list closes it; the list-level alert comes after.
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: t("gebruikers.rechtenVan", { naam: an.naam }) })).not.toBeInTheDocument(),
    );
    const melding = await screen.findByText(t("gebruikers.verdwenen", { naam: an.naam }));
    expect(melding).toHaveAttribute("role", "alert");
    await waitFor(() => expect(melding).toHaveFocus());
    expect(melding).toHaveAttribute("tabindex", "-1");
  });

  it("zegt per jaarfase wie hoofdleerkracht is, en onderscheidt niemand dit jaar van niemand", async () => {
    toon({
      gebruikers: [
        // L1 has a hoofdleerkracht today through NEXT year's appointment (R20), so it is not "geen".
        gebruiker({ hoofdleerkrachtaanstellingen: [{ schooljaarId: "jaar-2", jaarfase: "L1", teltVoorGedeeldeInhoud: true }] }),
      ],
      voorbijeSchooljaarIds: [],
    });

    const blok = (await screen.findByRole("heading", { name: t("gebruikers.hoofdleerkrachten") })).closest("section")!;
    expect(blok).toHaveTextContent(`K3${t("gebruikers.geenHoofdleerkracht")}`);
    expect(blok).toHaveTextContent(`L1${t("gebruikers.niemandDitJaar")}`);
    expect(blok).toHaveTextContent(t("gebruikers.zonderHoofdleerkracht"));
  });

  it("zegt de zin over de directie niet als elke jaarfase een hoofdleerkracht heeft", async () => {
    toon({
      gebruikers: [
        gebruiker({
          hoofdleerkrachtaanstellingen: [
            { schooljaarId: JAAR.id, jaarfase: "K3", teltVoorGedeeldeInhoud: true },
            { schooljaarId: JAAR.id, jaarfase: "L1", teltVoorGedeeldeInhoud: true },
          ],
        }),
      ],
      voorbijeSchooljaarIds: [],
    });

    const blok = (await screen.findByRole("heading", { name: t("gebruikers.hoofdleerkrachten") })).closest("section")!;
    expect(blok).toHaveTextContent("K3An Peeters");
    expect(blok).not.toHaveTextContent(t("gebruikers.zonderHoofdleerkracht"));
  });

  it("zegt het een keer als het gekozen schooljaar voorbij is", async () => {
    toon({ gebruikers: [gebruiker(), gebruiker({ id: "g-2", naam: "Bert Claes" })], voorbijeSchooljaarIds: [JAAR.id] });

    expect(await screen.findAllByText(t("gebruikers.jaarVoorbij"))).toHaveLength(1);
  });

  it("opent na een uitnodiging meteen de rechten van de nieuwe gebruiker", async () => {
    const nieuw = gebruiker({ id: "g-nieuw", naam: "Carla Maes", email: "carla.maes@school.be", isAangemeld: false });
    const fetchMock = toon({ gebruikers: [], voorbijeSchooljaarIds: [] }, (pad, methode) =>
      methode === "POST" && pad.endsWith("/api/gebruikers") ? { status: 201, body: nieuw } : undefined,
    );

    fireEvent.click(await screen.findByRole("button", { name: t("gebruikers.uitnodigen") }));
    const blad = await screen.findByRole("dialog", { name: t("gebruikers.uitnodigen") });
    fireEvent.change(within(blad).getByLabelText(t("gebruikers.aanmeldnaam")), { target: { value: " carla.maes@school.be " } });
    fireEvent.change(within(blad).getByLabelText(t("gebruikers.naam")), { target: { value: "Carla Maes" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("gebruikers.uitnodig") }));

    expect(await screen.findByRole("dialog", { name: t("gebruikers.rechtenVan", { naam: "Carla Maes" }) })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ email: "carla.maes@school.be", naam: "Carla Maes" });
  });
});
