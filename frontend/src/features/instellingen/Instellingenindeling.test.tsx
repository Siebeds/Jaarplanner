import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Instellingenindeling, Onderdeelwissel } from "./Instellingenindeling";
import { Onderdeelpoort } from "./Onderdeelpoort";
import type { Ik } from "../../lib/aanmelding";
import { t } from "../../i18n";

/**
 * Which part of Instellingen says it is the current one, and where focus goes after a switch.
 *
 * jsdom applies no stylesheet, so the column (`hidden lg:flex`) and the phone switch (`lg:hidden`)
 * are both in the tree here, where a browser only ever shows one. That is why the marking assertions
 * run over all links with a name: both shapes must agree, and a test that picked one would pass with
 * the other one wrong.
 */
/*
  The frame shows who is signed in on a phone (E6-01), so it needs a query client. The network never
  answers here: that row draws nothing, and the frame is exactly what these tests were written for.
*/
const rendermetPad = (pad: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[pad]}>
        <Routes>
          <Route path="instellingen" element={<Instellingenindeling />}>
            <Route path="*" element={<Onderdeelwissel />} />
          </Route>
          <Route path="agenda" element={<p>agenda-scherm</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/*
  Two different component types, as KlassenScherm and HoekenScherm are, so a switch unmounts one
  switch and mounts the other exactly as it does in the app. The same element at the same position
  would be kept by React, and the focus loss this guards against would never happen here.
*/
function EenDeel() {
  return (
    <div>
      <Onderdeelwissel />
    </div>
  );
}
function AnderDeel() {
  return (
    <section>
      <Onderdeelwissel />
    </section>
  );
}

const renderMetTweeSchermen = (ingang: string | { pathname: string; state: unknown }) =>
  render(
    // The switch reads who is signed in (E6-04: Gebruikers is directie only), so it needs a client.
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[ingang]}>
        <Routes>
          <Route path="instellingen" element={<Outlet />}>
            <Route path="klassen" element={<EenDeel />} />
            <Route path="hoeken" element={<AnderDeel />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const IK: Ik = {
  id: "ik-1",
  naam: "An Peeters",
  email: "an@school.be",
  isDirectie: false,
  heeftThemabeheer: true,
  hoofdleerkrachtLeeftijden: ["K3"],
  leerkrachtLeeftijden: ["K3"],
  eigenKlasIds: ["klas-1"],
  rapportklasIds: [],
  lopendeRapportklasIds: [],
};

/** `/api/ik` answers as this person; every other request never settles. */
function stubIk(isDirectie: boolean, delen: Partial<Ik> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.endsWith("/api/ik")
        ? Promise.resolve(
            new Response(JSON.stringify({ ...IK, isDirectie, ...delen }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          )
        : new Promise<Response>(() => {}),
    ),
  );
}

describe("Instellingenindeling", () => {
  it("markeert het onderdeel waar de leerkracht is, in de kolom en in de wisselaar", () => {
    rendermetPad("/instellingen/hoeken");

    const hoeken = screen.getAllByRole("link", { name: t("instellingen.hoeken") });
    const klassen = screen.getAllByRole("link", { name: t("instellingen.klassen") });

    expect(hoeken).toHaveLength(2);
    for (const link of hoeken) expect(link).toHaveAttribute("aria-current", "page");
    for (const link of klassen) expect(link).not.toHaveAttribute("aria-current");
  });

  it("brengt de leerkracht met het kruisje van de kolom terug naar de agenda", () => {
    rendermetPad("/instellingen/hoeken");

    fireEvent.click(screen.getByRole("link", { name: t("instellingen.sluiten") }));

    expect(screen.getByText("agenda-scherm")).toBeInTheDocument();
  });

  it("geeft de kolom de naam van Instellingen", () => {
    rendermetPad("/instellingen/klassen");
    expect(screen.getAllByRole("navigation", { name: t("instellingen.titel") })).toHaveLength(2);
  });

  it("zet de focus na een wissel op het gekozen onderdeel, niet terug bovenaan de pagina", () => {
    renderMetTweeSchermen("/instellingen/klassen");

    fireEvent.click(screen.getByRole("link", { name: t("instellingen.hoeken") }));

    const hoeken = screen.getByRole("link", { name: t("instellingen.hoeken") });
    expect(hoeken).toHaveAttribute("aria-current", "page");
    expect(hoeken).toHaveFocus();
  });

  it("neemt de focus niet als de leerkracht er langs een andere weg komt", () => {
    renderMetTweeSchermen("/instellingen/hoeken");
    expect(screen.getByRole("link", { name: t("instellingen.hoeken") })).not.toHaveFocus();
  });

  /*
    A reload, or back/forward to an entry the switch made: the state is still in the history entry,
    and a memory router's first entry arrives as a POP exactly as a reloaded page does.
  */
  it("neemt de focus niet bij herladen of terugkeren, ook al draagt de geschiedenis de wissel nog", () => {
    renderMetTweeSchermen({ pathname: "/instellingen/hoeken", state: { vanWissel: true } });
    expect(screen.getByRole("link", { name: t("instellingen.hoeken") })).not.toHaveFocus();
  });
});

describe("het onderdeel Gebruikers (E6-04)", () => {
  it("staat nergens voor wie geen directie is, ook niet met themabeheer, klas en hoofdleerkracht", async () => {
    stubIk(false);
    rendermetPad("/instellingen/klassen");

    // The signed-in row below the parts shows the name once `/api/ik` has answered.
    expect(await screen.findByText(IK.naam)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t("instellingen.gebruikers") })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: t("instellingen.klassen") })).toHaveLength(2);
  });

  it("staat voor directie in de kolom en in de wisselaar", async () => {
    stubIk(true);
    rendermetPad("/instellingen/klassen");

    expect(await screen.findAllByRole("link", { name: t("instellingen.gebruikers") })).toHaveLength(2);
  });

  it("staat er niet zolang niet bekend is wie aangemeld is", () => {
    rendermetPad("/instellingen/klassen");
    expect(screen.queryByRole("link", { name: t("instellingen.gebruikers") })).not.toBeInTheDocument();
  });

  const renderPoort = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/instellingen/gebruikers"]}>
          <Routes>
            <Route path="instellingen">
              <Route path="klassen" element={<p>klassen-scherm</p>} />
              <Route
                path="gebruikers"
                element={
                  <Onderdeelpoort deel="gebruikers">
                    <p>gebruikers-scherm</p>
                  </Onderdeelpoort>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("stuurt wie geen directie is bij een rechtstreeks bezoek naar het eerste onderdeel dat die mag zien", async () => {
    stubIk(false);
    renderPoort();

    expect(await screen.findByText("klassen-scherm")).toBeInTheDocument();
    expect(screen.queryByText("gebruikers-scherm")).not.toBeInTheDocument();
  });

  it("laat directie op het adres staan", async () => {
    stubIk(true);
    renderPoort();

    expect(await screen.findByText("gebruikers-scherm")).toBeInTheDocument();
  });
});

/*
  The ontwikkelingsrapport on a phone (FB-001; owner, 2026-09-15: "Via Instellingen"). jsdom applies no stylesheet, so
  `lg:hidden` is invisible here: what these pin is who is offered the link, not in which viewport.
*/
describe("het ontwikkelingsrapport bovenaan Instellingen (FB-001)", () => {
  const rapport = () => screen.queryByRole("link", { name: t("navigatie.ontwikkelingsrapport") });

  it("staat er voor een leerkracht van een K3-klas, en leidt naar het rapport", async () => {
    stubIk(false, { rapportklasIds: ["klas-1"], lopendeRapportklasIds: ["klas-1"] });
    rendermetPad("/instellingen/klassen");

    expect(await screen.findByRole("link", { name: t("navigatie.ontwikkelingsrapport") })).toHaveAttribute(
      "href",
      "/ontwikkelingsrapport",
    );
  });

  it("staat er voor directie", async () => {
    stubIk(true);
    rendermetPad("/instellingen/klassen");

    expect(await screen.findByRole("link", { name: t("navigatie.ontwikkelingsrapport") })).toBeInTheDocument();
  });

  it("staat er voor een hoofdleerkracht van K3, voor de set en de schaal (eigenaar, 2026-09-15)", async () => {
    stubIk(false);
    rendermetPad("/instellingen/klassen");

    // `IK` holds a hoofdleerkracht appointment for K3 and no K3 klas.
    expect(await screen.findByRole("link", { name: t("navigatie.ontwikkelingsrapport") })).toBeInTheDocument();
  });

  it("staat er niet voor wie geen rapport mag lezen en geen hoofdleerkracht van K3 is, ook niet met themabeheer", async () => {
    stubIk(false, { hoofdleerkrachtLeeftijden: ["K2"] });
    rendermetPad("/instellingen/klassen");

    // The name in the signed-in row says `/api/ik` has answered, so the absence below is a decision.
    expect(await screen.findByText(IK.naam)).toBeInTheDocument();
    expect(rapport()).not.toBeInTheDocument();
  });
});

describe("de wisselaar als het lettertype laat binnenkomt (round 3)", () => {
  // The switch places the active part again once `document.fonts.ready` resolves. jsdom has neither
  // `document.fonts` nor `scrollIntoView`, so both are stood in here, and the stand-in records which
  // element it was called on.
  let lettersBinnen!: () => void;
  const oudScroll = HTMLElement.prototype.scrollIntoView;
  const scroll = vi.fn();

  beforeEach(() => {
    const klaar = new Promise<void>((los) => {
      lettersBinnen = los;
    });
    Object.defineProperty(document, "fonts", { value: { ready: klaar }, configurable: true });
    HTMLElement.prototype.scrollIntoView = scroll;
    scroll.mockClear();
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "fonts");
    HTMLElement.prototype.scrollIntoView = oudScroll;
  });

  it("brengt het onderdeel met de toetsenbordfocus in beeld, niet het actieve", async () => {
    stubIk(true);
    renderMetTweeSchermen("/instellingen/klassen");
    // Wait for the fifth part (directie only, so it appears once `ik` has answered): the row that can overflow.
    await screen.findByRole("link", { name: t("instellingen.gebruikers") });
    const ander = screen.getByRole("link", { name: t("weergave.titel") });
    const actief = screen.getByRole("link", { name: t("instellingen.klassen") });

    ander.focus();
    scroll.mockClear();
    lettersBinnen();

    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts).toContain(ander);
    expect(scroll.mock.contexts).not.toContain(actief);
    expect(ander).toHaveFocus();
  });

  it("zet zonder focus in de rij het actieve onderdeel in beeld", async () => {
    stubIk(true);
    renderMetTweeSchermen("/instellingen/klassen");
    const actief = await screen.findByRole("link", { name: t("instellingen.klassen") });
    await screen.findByRole("link", { name: t("instellingen.gebruikers") });

    scroll.mockClear();
    lettersBinnen();

    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts).toContain(actief);
  });
});
