import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndContext } from "@dnd-kit/core";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hoekenpaneel } from "./Hoekenpaneel";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { zetSchermbreedte } from "../../test/setup";
import { t } from "../../i18n";

/**
 * The side panel shows one list at a time, the one its switch opened (owner, 2026-09-14: "twee secties ... niet
 * gegroepeerd als fiches"), and a fiche chosen from it reaches the agenda as its own kind: a hoek and an algemene fiche
 * open different sheets and save through different endpoints. Both widths, because the panel has two shapes (see
 * `test/setup.ts`).
 */
const antwoord = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string) =>
      Promise.resolve(
        pad.includes("/algemene-fiches")
          ? antwoord([
              { id: "f-1", klasId: "k-1", naam: "turnen", omschrijving: null, aantalPlaatsingen: 0, doelen: [] },
            ])
          : antwoord([{ id: "h-1", klasId: "k-1", naam: "bouwhoek", omschrijving: null, aantalPlaatsingen: 0 }]),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useHoekenpaneel.setState({ open: false, soort: "hoeken" });
  zetSchermbreedte(false);
});

function toon(onKies = vi.fn(), onKiesAlgemeneFiche = vi.fn(), klasId: string | null = "k-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DndContext>
          <Hoekenpaneel klasId={klasId} onKies={onKies} onKiesAlgemeneFiche={onKiesAlgemeneFiche} />
        </DndContext>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onKies, onKiesAlgemeneFiche, client };
}

describe("Hoekenpaneel: één lijst per schakelaar", () => {
  it("toont naast de agenda alleen de algemene fiches wanneer die schakelaar het opende", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKies, onKiesAlgemeneFiche } = toon();

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.algemeenTitel") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /turnen/ }));
    expect(onKiesAlgemeneFiche).toHaveBeenCalledWith("f-1");
    expect(onKies).not.toHaveBeenCalled();
    // The corners are the other switch's list, not a second section of this one.
    expect(screen.queryByText("bouwhoek")).not.toBeInTheDocument();
  });

  it("toont de hoekenfiches wanneer die schakelaar het opende, en geeft een hoek als hoek door", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    const { onKies, onKiesAlgemeneFiche } = toon();

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.titel") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /bouwhoek/ }));
    expect(onKies).toHaveBeenCalledWith("h-1");
    expect(onKiesAlgemeneFiche).not.toHaveBeenCalled();
    expect(screen.queryByText("turnen")).not.toBeInTheDocument();
  });

  it("zegt bij een mislukte lijst niet dat de klas geen fiches heeft", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))));
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    toon();

    expect(await screen.findByText(t("hoekenpaneel.mislukt"))).toBeInTheDocument();
    expect(screen.queryByText(t("hoekenpaneel.geenAlgemeneFiches"))).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t("hoekenpaneel.naarAlgemeneFiches") })).not.toBeInTheDocument();
    // A list it could not read is no ground for offering to add to it.
    expect(screen.queryByRole("button", { name: t("algemeneFiches.toevoegen") })).not.toBeInTheDocument();
  });

  it("houdt een lijst die al geladen was in beeld wanneer een verversing mislukt", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { client } = toon();
    expect(await screen.findByRole("button", { name: /turnen/ })).toBeInTheDocument();

    // After every placement the fiche list is invalidated and refetched with the panel still open
    // (`usePlaatsingVerversing`). A refetch that fails must not take away the list she was just dragging from.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))));
    await client.invalidateQueries({ queryKey: ["algemene-fiches"] });
    await waitFor(() => expect(client.getQueryState(["algemene-fiches", "k-1"])?.status).toBe("error"));

    expect(screen.getByRole("button", { name: /turnen/ })).toBeInTheDocument();
    expect(screen.queryByText(t("hoekenpaneel.mislukt"))).not.toBeInTheDocument();
  });

  it("sluit op een telefoon eerst het blad, zodat ze niet twee bladen diep zit", async () => {
    zetSchermbreedte(false);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKiesAlgemeneFiche } = toon();

    fireEvent.click(await screen.findByRole("button", { name: /turnen/ }));
    expect(onKiesAlgemeneFiche).toHaveBeenCalledWith("f-1");
    expect(useHoekenpaneel.getState().open).toBe(false);
  });
});

/**
 * A server that keeps what is posted to it, so the list the panel refetches after a save really contains the new
 * fiche. Stubbing the refetch to return it anyway would pass without the invalidation that puts it there.
 */
function serverMet({ hoeken = [] as object[], fiches = [] as object[] } = {}) {
  const posts: { pad: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string, init?: RequestInit) => {
      const lijst = pad.includes("/algemene-fiches") ? fiches : hoeken;
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as object;
        posts.push({ pad, body });
        const nieuw = { id: `n-${posts.length}`, klasId: "k-1", aantalPlaatsingen: 0, doelen: [], ...body };
        lijst.push(nieuw);
        return Promise.resolve(antwoord(nieuw));
      }
      return Promise.resolve(antwoord(lijst));
    }),
  );
  return posts;
}

describe("Hoekenpaneel: de tegel onderaan maakt een nieuwe fiche (TB-015)", () => {
  it("maakt een hoek vanuit het paneel, en die hoek staat daarna in de lijst", async () => {
    const posts = serverMet({
      hoeken: [{ id: "h-1", klasId: "k-1", naam: "bouwhoek", omschrijving: null, aantalPlaatsingen: 0 }],
    });
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    await screen.findByRole("button", { name: /bouwhoek/ });
    fireEvent.click(screen.getByRole("button", { name: t("hoeken.toevoegen") }));

    const blad = await screen.findByRole("dialog", { name: t("hoeken.nieuwTitel") });
    fireEvent.change(screen.getByLabelText(t("hoeken.naam")), { target: { value: "zandtafel" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByRole("button", { name: /zandtafel/ })).toBeInTheDocument();
    expect(posts).toEqual([{ pad: "/api/klassen/k-1/hoeken", body: { naam: "zandtafel", omschrijving: null } }]);
    await waitFor(() => expect(blad).not.toBeInTheDocument());
    // Focus returns to the tile she pressed, not to <body>: `Blad` gives Radix no trigger to return it to.
    await waitFor(() => expect(screen.getByRole("button", { name: t("hoeken.toevoegen") })).toHaveFocus());
  });

  it("maakt een algemene fiche vanuit het paneel, via de fiches en niet via de hoeken", async () => {
    const posts = serverMet();
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    toon();

    // An empty class shows the tile too, under the sentence that says there are none yet.
    expect(await screen.findByText(t("hoekenpaneel.geenAlgemeneFiches"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("algemeneFiches.toevoegen") }));

    await screen.findByRole("dialog", { name: t("algemeneFiches.nieuwTitel") });
    fireEvent.change(screen.getByLabelText(t("algemeneFiches.naam")), { target: { value: "onthaal" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByRole("button", { name: /onthaal/ })).toBeInTheDocument();
    expect(posts).toEqual([
      { pad: "/api/klassen/k-1/algemene-fiches", body: { naam: "onthaal", omschrijving: null } },
    ]);
  });

  it("houdt de focus op de tegel wanneer de eerste fiche de lege zin vervangt", async () => {
    // The refetch after the save is held until focus has returned, which is the order a browser usually gives: there
    // the network tends to answer after the frame `sluitNieuw` waits for. In jsdom it would otherwise land first, and the
    // test could not tell a kept tile from a remounted one.
    const fiches: object[] = [];
    const vastgehouden = { los: (_antwoord: Response) => {} };
    let gepost = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((_pad: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          gepost = true;
          const nieuw = { id: "n-1", klasId: "k-1", naam: "onthaal", omschrijving: null, aantalPlaatsingen: 0, doelen: [] };
          fiches.push(nieuw);
          return Promise.resolve(antwoord(nieuw));
        }
        if (gepost) return new Promise<Response>((resolve) => (vastgehouden.los = resolve));
        return Promise.resolve(antwoord(fiches));
      }),
    );
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    toon();

    fireEvent.click(await screen.findByRole("button", { name: t("algemeneFiches.toevoegen") }));
    await screen.findByRole("dialog", { name: t("algemeneFiches.nieuwTitel") });
    fireEvent.change(screen.getByLabelText(t("algemeneFiches.naam")), { target: { value: "onthaal" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    await waitFor(() => expect(screen.getByRole("button", { name: t("algemeneFiches.toevoegen") })).toHaveFocus());
    const tegel = screen.getByRole("button", { name: t("algemeneFiches.toevoegen") });
    expect(screen.getByText(t("hoekenpaneel.geenAlgemeneFiches"))).toBeInTheDocument();

    vastgehouden.los(antwoord(fiches));
    expect(await screen.findByRole("button", { name: /onthaal/ })).toBeInTheDocument();
    // The same node, still focused: a remounted tile would be a different element and would have lost the focus.
    expect(screen.getByRole("button", { name: t("algemeneFiches.toevoegen") })).toBe(tegel);
    expect(tegel).toHaveFocus();
  });

  it("toont de tegel ook bij een klas zonder hoeken", async () => {
    serverMet();
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    expect(await screen.findByText(t("hoekenpaneel.geenHoeken"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("hoeken.toevoegen") })).toBeInTheDocument();
  });

  it("sluit op een telefoon eerst het paneelblad en opent het weer wanneer het formulier sluit", async () => {
    serverMet({ hoeken: [{ id: "h-1", klasId: "k-1", naam: "bouwhoek", omschrijving: null, aantalPlaatsingen: 0 }] });
    zetSchermbreedte(false);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    fireEvent.click(await screen.findByRole("button", { name: t("hoeken.toevoegen") }));
    expect(useHoekenpaneel.getState().open).toBe(false);

    await screen.findByRole("dialog", { name: t("hoeken.nieuwTitel") });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.annuleer") }));

    // Back in the list she came to add to, saved or not.
    await waitFor(() => expect(useHoekenpaneel.getState().open).toBe(true));
    expect(screen.queryByRole("dialog", { name: t("hoeken.nieuwTitel") })).not.toBeInTheDocument();
  });

  it("opent op een telefoon na bewaren het paneelblad weer, met de nieuwe hoek erin", async () => {
    serverMet();
    zetSchermbreedte(false);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    fireEvent.click(await screen.findByRole("button", { name: t("hoeken.toevoegen") }));
    await screen.findByRole("dialog", { name: t("hoeken.nieuwTitel") });
    fireEvent.change(screen.getByLabelText(t("hoeken.naam")), { target: { value: "zandtafel" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    const paneel = await screen.findByRole("dialog", { name: t("hoekenpaneel.titel") });
    expect(await within(paneel).findByRole("button", { name: /zandtafel/ })).toBeInTheDocument();
    expect(useHoekenpaneel.getState().open).toBe(true);
  });

  it("houdt het formulier open met de fout wanneer bewaren mislukt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_pad: string, init?: RequestInit) =>
        Promise.resolve(init?.method === "POST" ? new Response("{}", { status: 500 }) : antwoord([])),
      ),
    );
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    fireEvent.click(await screen.findByRole("button", { name: t("hoeken.toevoegen") }));
    const blad = await screen.findByRole("dialog", { name: t("hoeken.nieuwTitel") });
    fireEvent.change(screen.getByLabelText(t("hoeken.naam")), { target: { value: "zandtafel" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    // Only a save that succeeded closes the form: what she typed stays, with the reason it did not save.
    expect(await within(blad).findByText(t("themabeheer.bewaarMislukt"))).toBeInTheDocument();
    expect(blad).toBeInTheDocument();
    expect(screen.getByLabelText(t("hoeken.naam"))).toHaveValue("zandtafel");
  });

  it("toont geen tegel zolang de lijst laadt", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    expect(screen.queryByRole("button", { name: t("hoeken.toevoegen") })).not.toBeInTheDocument();
  });

  it("toont geen tegel zonder gekozen klas", () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    toon(undefined, undefined, null);

    expect(screen.getByText(t("hoekenpaneel.geenKlas"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("algemeneFiches.toevoegen") })).not.toBeInTheDocument();
  });
});
