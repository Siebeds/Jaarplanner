import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Instellingenindeling, Onderdeelwissel } from "./Instellingenindeling";
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
    <MemoryRouter initialEntries={[ingang]}>
      <Routes>
        <Route path="instellingen" element={<Outlet />}>
          <Route path="klassen" element={<EenDeel />} />
          <Route path="hoeken" element={<AnderDeel />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

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
