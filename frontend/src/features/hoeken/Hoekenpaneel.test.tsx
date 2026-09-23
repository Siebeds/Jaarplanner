import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndContext } from "@dnd-kit/core";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hoekenpaneel } from "./Hoekenpaneel";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { zetSchermbreedte } from "../../test/setup";
import { ikMet, metIk } from "../../test/rechten";
import type { Ik } from "../../lib/aanmelding";
import { STANDAARDDUUR } from "../plan/tijd";
import type { Activiteitenweek } from "../plan/Activiteitensectie";
import type { Subthemareeks } from "../plan/subthemareeksen";
import type { Verrijkingenweek, Volgendsubthema } from "./verrijkingenweek";
import { t } from "../../i18n";
import { FICHEVLAK } from "../algemene-fiches/merk";

/**
 * The side panel shows one list at a time, the one its switch opened (owner, 2026-09-14: "twee secties ... niet
 * gegroepeerd als fiches"). An algemene fiche chosen from it reaches the agenda to be planned; a hoek is never planned
 * and opens the sheet that writes what it holds this week (FB-038, ADR-0044). Both widths, because the panel has two
 * shapes (see `test/setup.ts`).
 */
const antwoord = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

const BOUWHOEK = { id: "h-1", klasId: "k-1", naam: "bouwhoek", omschrijving: null, aantalVerrijkingen: 0 };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "PUT"
          ? antwoord({})
          : pad.includes("/algemene-fiches")
            ? antwoord([
                { id: "f-1", klasId: "k-1", naam: "turnen", omschrijving: null, aantalPlaatsingen: 0, doelen: [] },
              ])
            : antwoord([BOUWHOEK]),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useHoekenpaneel.setState({ open: false, soort: "hoeken" });
  zetSchermbreedte(false);
});

// The fiche tests do not look at the activiteiten list, so its week says only that nothing runs.
const EEN_WEEK: Activiteitenweek = { maandag: "2026-09-14", nummer: 38, lopend: [] };

const herfst: Subthemareeks = {
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  themaId: "t-1",
  themaNaam: "Seizoenen",
  van: "2026-09-14",
  tot: "2026-09-25",
  aantalDagen: 4,
  periodeId: "p-herfst",
};

/** A week in which "De herfst" runs, with the bouwhoek's text for it when one is given. */
const weekMet = (tekst?: string): Verrijkingenweek => ({
  status: "klaar",
  reeksen: [herfst],
  periodes: [
    {
      subthemaperiodeId: "p-herfst",
      subthemaId: "s-herfst",
      subthemaNaam: "De herfst",
      van: "2026-09-14",
      tot: "2026-09-25",
      verrijkingen: tekst ? [{ id: "v-1", hoekId: "h-1", tekst }] : [],
    },
  ],
});

const GEEN_SUBTHEMA: Verrijkingenweek = { status: "klaar", reeksen: [], periodes: [] };
const NIETS_HIERNA: Volgendsubthema = { status: "klaar", reeks: null, periodes: [] };

function toon({
  onKiesAlgemeneFiche = vi.fn(),
  klasId = "k-1" as string | null,
  verrijkingenWeek = GEEN_SUBTHEMA,
  volgendSubthema = NIETS_HIERNA,
  magPlannen = true,
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DndContext>
          <Hoekenpaneel
            klasId={klasId}
            onKiesAlgemeneFiche={onKiesAlgemeneFiche}
            magPlannen={magPlannen}
            activiteitenWeek={EEN_WEEK}
            verrijkingenWeek={verrijkingenWeek}
            volgendSubthema={volgendSubthema}
            onKiesActiviteit={vi.fn()}
          />
        </DndContext>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onKiesAlgemeneFiche, client };
}

/** A hoek's row: one button with its name, and under it what it holds or the offer to write it. */
const kaart = async (naam = "bouwhoek") => (await screen.findByText(naam)).closest("button")!;

const ZES_HOEKEN = ["bouwhoek", "knutselhoek", "leeshoek", "ontdekhoek", "poppenhoek", "schrijfhoek"].map((naam, i) => ({
  id: i === 0 ? "h-1" : `h-${naam}`,
  klasId: "k-1",
  naam,
  omschrijving: i === 0 ? "Blokken, bouwplaten en voertuigen" : null,
  aantalVerrijkingen: 0,
}));

const regen: Subthemareeks = {
  ...herfst,
  subthemaId: "s-regen",
  subthemaNaam: "Regen",
  van: "2026-09-17",
  tot: "2026-10-02",
  periodeId: "p-regen",
};

const dieren = {
  subthemaId: "s-dieren",
  subthemaNaam: "Dieren in de herfst",
  van: "2026-10-26",
  tot: "2026-11-06",
  periodeId: "p-dieren",
};

const volgendMet = (tekst?: string): Volgendsubthema => ({
  status: "klaar",
  reeks: dieren,
  periodes: [
    {
      subthemaperiodeId: "p-dieren",
      subthemaId: "s-dieren",
      subthemaNaam: "Dieren in de herfst",
      van: dieren.van,
      tot: dieren.tot,
      verrijkingen: tekst ? [{ id: "v-9", hoekId: "h-leeshoek", tekst }] : [],
    },
  ],
});

function metHoeken(hoeken: object[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((_pad: string, init?: RequestInit) => Promise.resolve(antwoord(init?.method === "PUT" ? {} : hoeken))),
  );
}

const verstuurd = () => {
  const oproepen = vi.mocked(fetch).mock.calls as [string, RequestInit | undefined][];
  const [pad, init] = oproepen.find(([, verzoek]) => verzoek?.method === "PUT")!;
  return { pad, body: JSON.parse(String(init!.body)) };
};

describe("Hoekenpaneel: de hoeken per subthema, met de stand en wat erna komt (FB-098)", () => {
  beforeEach(() => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    metHoeken(ZES_HOEKEN);
    // A day outside every run below, so a period is written without "Nu" unless a test says otherwise.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 5, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zet het subthema één keer boven de hoeken, met zijn periode, en niet bij elke hoek", async () => {
    toon({ verrijkingenWeek: weekMet() });

    const blok = await screen.findByRole("region", { name: "De herfst" });
    await within(blok).findByText("schrijfhoek");
    expect(within(blok).getByText("14 tot 25 september")).toBeInTheDocument();
    expect(screen.getAllByText("De herfst")).toHaveLength(1);
    expect(within(blok).getAllByRole("listitem")).toHaveLength(6);
  });

  it("zegt 'Nu' bij de periode alleen wanneer vandaag een van haar dagen is", async () => {
    vi.setSystemTime(new Date(2026, 8, 16));
    toon({ verrijkingenWeek: weekMet() });

    expect(await screen.findByText(t("hoekenpaneel.nu", { periode: "14 tot 25 september" }))).toBeInTheDocument();
  });

  it("toont de stand '1 van 6', de verrijking met een vinkje, en bij de andere hoeken het aanbod om er een in te vullen", async () => {
    toon({ verrijkingenWeek: weekMet("veel blaadjes") });

    const blok = await screen.findByRole("region", { name: "De herfst" });
    await within(blok).findByText("schrijfhoek");
    expect(within(blok).getByText("1 van 6")).toBeInTheDocument();
    expect(within(blok).getByText(t("hoekenpaneel.standVoluit", { aantal: 1, totaal: 6 }))).toBeInTheDocument();
    const bouwhoek = await kaart();
    expect(within(bouwhoek).getByText("veel blaadjes")).toBeInTheDocument();
    expect(within(bouwhoek).getByText(t("hoekenpaneel.verrijkt"))).toBeInTheDocument();
    expect(within(blok).getAllByText(t("hoekenpaneel.verrijkingInvullen"))).toHaveLength(5);
  });

  it("toont de beschrijving van een hoek niet in het paneel, maar wel in de fiche die de naam opent", async () => {
    toon({ verrijkingenWeek: weekMet() });

    fireEvent.click(await kaart());
    const blad = await screen.findByRole("dialog", { name: "bouwhoek" });
    expect(within(blad).getByText("Blokken, bouwplaten en voertuigen")).toBeInTheDocument();
    expect(screen.getAllByText("Blokken, bouwplaten en voertuigen")).toHaveLength(1);
  });

  it("geeft elk subthema van de week een eigen blok, met zijn eigen periode en stand, in volgorde van begin", async () => {
    const herfstweek = weekMet("kastanjes");
    if (herfstweek.status !== "klaar") throw new Error("week");
    const week: Verrijkingenweek = {
      status: "klaar",
      reeksen: [herfst, regen],
      periodes: [
        ...herfstweek.periodes,
        {
          subthemaperiodeId: "p-regen",
          subthemaId: "s-regen",
          subthemaNaam: "Regen",
          van: regen.van,
          tot: regen.tot,
          verrijkingen: [],
        },
      ],
    };
    toon({ verrijkingenWeek: week });

    await screen.findAllByText("schrijfhoek");
    const blokken = screen.getAllByRole("region");
    expect(blokken.map((blok) => within(blok).getByRole("heading").textContent)).toEqual(["De herfst", "Regen"]);
    expect(within(blokken[0]).getByText("1 van 6")).toBeInTheDocument();
    expect(within(blokken[1]).getByText("0 van 6")).toBeInTheDocument();
    expect(within(blokken[1]).getByText("17 september tot 2 oktober")).toBeInTheDocument();
  });

  it("toont onderaan het volgende subthema met zijn begindatum en stand, en 'Al voorbereiden' vult het in", async () => {
    toon({ verrijkingenWeek: weekMet(), volgendSubthema: volgendMet("boeken over egels") });

    const hierna = await screen.findByRole("region", { name: "Dieren in de herfst" });
    expect(within(hierna).getByText(t("hoekenpaneel.hierna", { datum: "26 oktober" }))).toBeInTheDocument();
    expect(within(hierna).getByText("1 van 6")).toBeInTheDocument();

    fireEvent.click(within(hierna).getByRole("button", { name: t("hoekenpaneel.alVoorbereiden") }));
    const blad = await screen.findByRole("dialog", { name: "Dieren in de herfst" });
    expect(within(blad).getByLabelText("leeshoek")).toHaveValue("boeken over egels");
    fireEvent.change(within(blad).getByLabelText("bouwhoek"), { target: { value: "een egelhol van takken" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    await waitFor(() => expect(blad).not.toBeInTheDocument());
    // Only the corner she changed: the leeshoek's text is not sent back over a colleague's newer one.
    expect(verstuurd().body).toEqual({
      subthemaperiodeId: "p-dieren",
      verrijkingen: [{ hoekId: "h-1", tekst: "een egelhol van takken" }],
    });
    await waitFor(() => expect(screen.getByRole("button", { name: t("hoekenpaneel.alVoorbereiden") })).toHaveFocus());
  });

  it("legt bij 'Al voorbereiden' de dagen vast van een volgend subthema zonder opgeslagen venster", async () => {
    const zonderVenster: Volgendsubthema = { status: "klaar", reeks: { ...dieren, periodeId: undefined }, periodes: [] };
    toon({ verrijkingenWeek: weekMet(), volgendSubthema: zonderVenster });

    fireEvent.click(await screen.findByRole("button", { name: t("hoekenpaneel.alVoorbereiden") }));
    const blad = await screen.findByRole("dialog", { name: "Dieren in de herfst" });
    fireEvent.change(within(blad).getByLabelText("bouwhoek"), { target: { value: "egels" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    await waitFor(() => expect(blad).not.toBeInTheDocument());
    expect(verstuurd().body).toEqual({
      subthemaperiodeId: null,
      subthemaId: "s-dieren",
      van: dieren.van,
      tot: dieren.tot,
      verrijkingen: [{ hoekId: "h-1", tekst: "egels" }],
    });
  });

  it("laat het deel 'Hierna' weg wanneer er na deze week niets gepland is", async () => {
    toon({ verrijkingenWeek: weekMet() });
    await screen.findAllByText("schrijfhoek");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: t("hoekenpaneel.alVoorbereiden") })).not.toBeInTheDocument();
  });

  it("laat het deel 'Hierna' weg zolang niet gelezen is wat erna komt", async () => {
    toon({ verrijkingenWeek: weekMet(), volgendSubthema: { status: "laadt" } });
    await screen.findAllByText("schrijfhoek");
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });

  it("toont de hoeken zonder woord eronder zolang de week niet gelezen is", async () => {
    toon({ verrijkingenWeek: { status: "laadt" } });
    expect(await kaart()).toHaveTextContent(/^bouwhoek$/);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("zegt in een week zonder subthema dat er geen loopt, en toont wel wat erna komt", async () => {
    toon({ verrijkingenWeek: GEEN_SUBTHEMA, volgendSubthema: volgendMet() });
    expect(await screen.findByText(t("hoekenpaneel.geenSubthemaInWeek"))).toBeInTheDocument();
    expect(await kaart()).toHaveTextContent(/^bouwhoek$/);
    expect(screen.getByRole("region", { name: "Dieren in de herfst" })).toBeInTheDocument();
  });

  it("houdt de tegel om een hoek toe te voegen onderaan, na 'Hierna'", async () => {
    toon({ verrijkingenWeek: weekMet(), volgendSubthema: volgendMet() });
    const hierna = await screen.findByRole("region", { name: "Dieren in de herfst" });
    const tegel = screen.getByRole("button", { name: t("hoeken.toevoegen") });
    expect(hierna.compareDocumentPosition(tegel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("Hoekenpaneel: de fiche van een hoek (FB-038)", () => {
  beforeEach(() => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
  });

  it("opent bij een klik het blad van die hoek, bewaart alleen die hoek, en zet de focus terug op de rij", async () => {
    toon({ verrijkingenWeek: weekMet() });

    fireEvent.click(await kaart());
    const blad = await screen.findByRole("dialog", { name: "bouwhoek" });
    fireEvent.change(within(blad).getByLabelText("De herfst"), { target: { value: "kastanjes" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    await waitFor(() => expect(blad).not.toBeInTheDocument());
    const { pad, body } = verstuurd();
    expect(pad).toBe("/api/klassen/k-1/hoekverrijkingen");
    expect(body).toEqual({ subthemaperiodeId: "p-herfst", verrijkingen: [{ hoekId: "h-1", tekst: "kastanjes" }] });
    // Back on the row she pressed, not on <body>: `Blad` gives Radix no trigger to return focus to.
    await waitFor(() => expect(screen.getByText("bouwhoek").closest("button")).toHaveFocus());
  });

  it("maakt van een hoek geen fiche om te slepen: een hoek gaat niet in de agenda", async () => {
    toon({ verrijkingenWeek: weekMet() });

    // dnd-kit's attributes are what say "draggable" to a screen reader; the algemene fiche below has them.
    expect(await kaart()).not.toHaveAttribute("aria-roledescription");
  });

  it("sluit op een telefoon eerst het paneelblad, en opent het weer wanneer het blad van de hoek sluit", async () => {
    zetSchermbreedte(false);
    toon({ verrijkingenWeek: weekMet() });

    fireEvent.click(await kaart());
    expect(useHoekenpaneel.getState().open).toBe(false);

    const blad = await screen.findByRole("dialog", { name: "bouwhoek" });
    fireEvent.click(within(blad).getByRole("button", { name: t("hoekverrijkingblad.annuleren") }));

    // Back at the corners, to go on to the next one.
    await waitFor(() => expect(useHoekenpaneel.getState().open).toBe(true));
    expect(screen.queryByRole("dialog", { name: "bouwhoek" })).not.toBeInTheDocument();
  });
});

describe("Hoekenpaneel: de hoeken voor wie de klas alleen mag bekijken (FB-038)", () => {
  beforeEach(() => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
  });

  it("toont de hoeken met hun verrijking, zonder tegel, en opent het blad zonder velden", async () => {
    toon({ magPlannen: false, verrijkingenWeek: weekMet("kastanjes") });

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.titel") })).toBeInTheDocument();
    expect(within(await kaart()).getByText("kastanjes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoeken.toevoegen") })).not.toBeInTheDocument();

    fireEvent.click(await kaart());
    const blad = await screen.findByRole("dialog", { name: "bouwhoek" });
    expect(within(blad).getByText("kastanjes")).toBeInTheDocument();
    expect(within(blad).queryByRole("textbox")).toBeNull();
  });

  it("zegt onder een lege verrijking dat er niets is, en biedt niet aan om ze in te vullen", async () => {
    toon({ magPlannen: false, verrijkingenWeek: weekMet() });

    const hoek = await kaart();
    expect(within(hoek).getByText(t("hoekenpaneel.geenVerrijking"))).toBeInTheDocument();
    expect(within(hoek).queryByText(t("hoekenpaneel.verrijkingInvullen"))).toBeNull();
  });

  it("toont een lezer wat erna komt, zonder 'Al voorbereiden'", async () => {
    toon({ magPlannen: false, verrijkingenWeek: weekMet(), volgendSubthema: volgendMet() });

    expect(await screen.findByRole("region", { name: "Dieren in de herfst" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoekenpaneel.alVoorbereiden") })).not.toBeInTheDocument();
  });

  it("stuurt een lezer bij een klas zonder hoeken niet naar Instellingen om er te maken", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(antwoord([]))));
    toon({ magPlannen: false });

    expect(await screen.findByText(t("hoekenpaneel.geenHoeken"))).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t("hoekenpaneel.naarInstellingen") })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoeken.toevoegen") })).not.toBeInTheDocument();
  });
});

describe("Hoekenpaneel: één lijst per schakelaar", () => {
  it("toont naast de agenda alleen de algemene fiches wanneer die schakelaar het opende", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKiesAlgemeneFiche } = toon();

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.algemeenTitel") })).toBeInTheDocument();
    const turnen = await screen.findByRole("button", { name: /^turnen/ });
    // An algemene fiche is still dragged onto the agenda.
    expect(turnen).toHaveAttribute("aria-roledescription");
    fireEvent.click(turnen);
    expect(onKiesAlgemeneFiche).toHaveBeenCalledWith("f-1");
    // The corners are the other switch's list, not a second section of this one.
    expect(screen.queryByText("bouwhoek")).not.toBeInTheDocument();
  });

  it("toont de hoekenfiches wanneer die schakelaar het opende, en een klik plant niets maar opent de verrijking", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    const { onKiesAlgemeneFiche } = toon();

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.titel") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /bouwhoek/ }));
    expect(await screen.findByRole("dialog", { name: "bouwhoek" })).toBeInTheDocument();
    expect(onKiesAlgemeneFiche).not.toHaveBeenCalled();
    expect(screen.queryByText("turnen")).not.toBeInTheDocument();
  });

  // FB-018: the goals of an algemene fiche one press away in the panel, without planning it. A hoek has none yet (FB-019).
  it("toont de doelen van een algemene fiche via haar info-icoon, zonder haar in te plannen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          antwoord([
            {
              id: "f-1",
              klasId: "k-1",
              naam: "turnen",
              omschrijving: null,
              aantalPlaatsingen: 0,
              doelen: [
                {
                  koppelingId: "dk-1",
                  leerplandoelCode: "6.1.G1.1",
                  doelsoort: "Gemeenschappelijk",
                  jaarFase: "K3",
                  tekst: "Beweegt vlot.",
                },
              ],
            },
          ]),
        ),
      ),
    );
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKiesAlgemeneFiche } = toon();

    fireEvent.click(await screen.findByRole("button", { name: t("doelinfo.open", { naam: "turnen" }) }));

    const venster = screen.getByRole("dialog", { name: "turnen" });
    expect(within(venster).getByText("6.1.G1.1")).toBeInTheDocument();
    expect(within(venster).getByText("Beweegt vlot.")).toBeInTheDocument();
    expect(onKiesAlgemeneFiche).not.toHaveBeenCalled();
  });

  it("geeft een algemene fiche in de zijbalk het vlak en het icoon van haar blok, een hoek niet (FB-077)", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    toon();

    const fiche = await kaart("turnen");
    expect(fiche.className).toContain(FICHEVLAK);
    expect(fiche.querySelector("svg")).toBeInTheDocument();

    // A hoek never becomes a block, so it keeps the quiet card of the chrome column.
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    const hoek = await kaart();
    expect(hoek.className).not.toContain(FICHEVLAK);
    expect(hoek.querySelector("svg")).toBeNull();
  });

  it("zet geen info-icoon op een hoekenfiche", async () => {
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "hoeken" });
    toon();

    await screen.findByRole("button", { name: /^bouwhoek/ });
    expect(screen.queryByRole("button", { name: t("doelinfo.open", { naam: "bouwhoek" }) })).not.toBeInTheDocument();
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
    expect(await screen.findByRole("button", { name: /^turnen/ })).toBeInTheDocument();

    // After every placement the fiche list is invalidated and refetched with the panel still open. A refetch that
    // fails must not take away the list she was just dragging from.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))));
    await client.invalidateQueries({ queryKey: ["algemene-fiches"] });
    await waitFor(() => expect(client.getQueryState(["algemene-fiches", "k-1"])?.status).toBe("error"));

    expect(screen.getByRole("button", { name: /^turnen/ })).toBeInTheDocument();
    expect(screen.queryByText(t("hoekenpaneel.mislukt"))).not.toBeInTheDocument();
  });

  it("sluit op een telefoon eerst het blad, zodat ze niet twee bladen diep zit", async () => {
    zetSchermbreedte(false);
    useHoekenpaneel.setState({ open: true, soort: "algemeen" });
    const { onKiesAlgemeneFiche } = toon();

    fireEvent.click(await screen.findByRole("button", { name: /^turnen/ }));
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
        const nieuw = { id: `n-${posts.length}`, klasId: "k-1", aantalPlaatsingen: 0, aantalVerrijkingen: 0, doelen: [], ...body };
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
    const posts = serverMet({ hoeken: [{ ...BOUWHOEK }] });
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

    expect(await screen.findByRole("button", { name: /^onthaal/ })).toBeInTheDocument();
    expect(posts).toEqual([
      { pad: "/api/klassen/k-1/algemene-fiches", body: { naam: "onthaal", omschrijving: null } },
    ]);
  });

  it("houdt de focus op de tegel wanneer de eerste fiche de lege zin vervangt", async () => {
    // The refetch after the save is held until focus has returned, which is the order a browser usually gives: there
    // the network tends to answer after the frame `sluitBlad` waits for. In jsdom it would otherwise land first, and the
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
    expect(await screen.findByRole("button", { name: /^onthaal/ })).toBeInTheDocument();
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
    serverMet({ hoeken: [{ ...BOUWHOEK }] });
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
    toon({ klasId: null });

    expect(screen.getByText(t("hoekenpaneel.geenKlas"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("algemeneFiches.toevoegen") })).not.toBeInTheDocument();
  });
});

/**
 * The third list (owner, 2026-09-15, FB-017): the activiteiten of one subthema, opening on the one running in the week
 * the agenda shows, with a list to choose another subthema of this klas's leeftijd.
 */
describe("Hoekenpaneel: de activiteiten (FB-017)", () => {
  const BESTEMMINGEN = [
    { id: "s-1", naam: "De eekhoorn", leeftijd: "K3", themaId: "t-1", themaNaam: "Herfst" },
    { id: "s-2", naam: "Paddenstoelen", leeftijd: "K3", themaId: "t-1", themaNaam: "Herfst" },
    { id: "s-3", naam: "De stoomboot", leeftijd: "K3", themaId: "t-2", themaNaam: "Sinterklaas" },
  ];

  const activiteit = (id: string, naam: string, lengteInLesuren: number, doelkoppelingen: unknown[] = []) => ({
    id, naam, activiteitType: "Kring", hoek: null, verwachteUitkomsten: null, onderzoeksvraagId: null, kleur: null,
    lengteInLesuren, doelkoppelingen,
  });
  const koppeling = (code: string, status: string) => ({ id: `k-${code}`, leerplandoelCode: code, status, aiMotivatie: null });
  const subthema = (id: string, themaId: string, naam: string, activiteiten: unknown[]) => ({
    id, themaId, naam, duurWeken: 2, leeftijd: "K3", onderzoeksvragen: [], subdoelen: [], activiteiten,
  });
  const thema = (id: string, naam: string, subthemas: unknown[]) => ({
    id, naam, duurWeken: 6, invalshoeken: null, kernwoordenschat: [], rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: true, themadoelen: [], minimumdoelen: [], subthemas,
  });

  const THEMAS: Record<string, unknown> = {
    "t-1": thema("t-1", "Herfst", [
      subthema("s-1", "t-1", "De eekhoorn", [activiteit("a-1", "Eikels rapen", 1)]),
      subthema("s-2", "t-1", "Paddenstoelen", [
        activiteit("a-2", "Paddenstoelen tekenen", 2, [koppeling("MUZ.1.1", "Manueel"), koppeling("MUZ.2.2", "Voorgesteld")]),
      ]),
    ]),
    "t-2": thema("t-2", "Sinterklaas", [subthema("s-3", "t-2", "De stoomboot", [])]),
  };

  /**
   * @param plaatsingen What the FB-076 read answers. A 404 by default, which is also what the other tests here run
   * on: a card then says nothing about where it stands, rather than claiming it stands nowhere.
   */
  function stubAntwoorden(bestemmingen: unknown[] = BESTEMMINGEN, plaatsingen?: { activiteitId: string; datums: string[] }[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn((pad: string) => {
        if (pad.includes("/api/subthemas/voor-klas/k-1")) return Promise.resolve(antwoord(bestemmingen));
        if (pad.includes("/jaarplan/activiteitplaatsingen")) {
          return plaatsingen
            ? Promise.resolve(antwoord({ activiteiten: plaatsingen }))
            : Promise.resolve(new Response("{}", { status: 404 }));
        }
        const themaId = /\/api\/themas\/([^/]+)\/voor-klas\/k-1/.exec(pad)?.[1];
        if (themaId && THEMAS[themaId]) return Promise.resolve(antwoord(THEMAS[themaId]));
        return Promise.resolve(new Response("{}", { status: 404 }));
      }),
    );
  }

  beforeEach(() => {
    stubAntwoorden();
    zetSchermbreedte(true);
    useHoekenpaneel.setState({ open: true, soort: "activiteiten", subthemaKeuze: null });
  });

  afterEach(() => {
    useHoekenpaneel.setState({ subthemaKeuze: null });
  });

  const WEEK = "2026-09-14";

  function toonActiviteiten({
    lopend = [] as Activiteitenweek["lopend"],
    ik = null as Ik | null,
    magPlannen = true,
  } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (ik) metIk(client, ik);
    const onKiesActiviteit = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DndContext>
            <Hoekenpaneel
              klasId="k-1"
              onKiesAlgemeneFiche={vi.fn()}
              magPlannen={magPlannen}
              activiteitenWeek={{ maandag: WEEK, nummer: 38, lopend }}
              verrijkingenWeek={GEEN_SUBTHEMA}
              volgendSubthema={NIETS_HIERNA}
              onKiesActiviteit={onKiesActiviteit}
            />
          </DndContext>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return { onKiesActiviteit, client };
  }

  const keuzelijst = () => screen.getByLabelText(t("activiteitenpaneel.subthema"));

  it("opent op het subthema dat deze week loopt, en geeft een aangeklikte activiteit met haar lengte door", async () => {
    const { onKiesActiviteit } = toonActiviteiten({ lopend: ["s-2"] });

    expect(screen.getByRole("complementary", { name: t("hoekenpaneel.activiteitenTitel") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /^Paddenstoelen tekenen/ }));

    expect(keuzelijst()).toHaveValue("s-2");
    expect(screen.getByText(t("activiteitenpaneel.looptInWeek", { nummer: 38 }))).toBeInTheDocument();
    expect(onKiesActiviteit).toHaveBeenCalledWith({ id: "a-2", naam: "Paddenstoelen tekenen", duur: 2 * STANDAARDDUUR });
    // The other subthema's activiteiten are not in this list.
    expect(screen.queryByText("Eikels rapen")).not.toBeInTheDocument();
  });

  it("markeert een activiteit die al in de agenda van de klas staat, met de dag erbij (FB-076)", async () => {
    stubAntwoorden(BESTEMMINGEN, [{ activiteitId: "a-2", datums: ["2026-10-13"] }]);
    toonActiviteiten({ lopend: ["s-2"] });

    const gemarkeerd = (await screen.findByRole("button", { name: /^Paddenstoelen tekenen/ })) as HTMLElement;
    expect(within(gemarkeerd).getByText(t("activiteitenpaneel.ingeplandOp", { dag: "di 13 okt" }))).toBeInTheDocument();
    expect(gemarkeerd.className).toContain("border-l-inkt-zwak");

    // An activiteit that stands nowhere says nothing at all: no rule, no sentence.
    fireEvent.change(keuzelijst(), { target: { value: "s-1" } });
    const kaal = (await screen.findByRole("button", { name: /^Eikels rapen/ })) as HTMLElement;
    expect(kaal.className).not.toContain("border-l-inkt-zwak");
    expect(within(kaal).queryByText(/Ingepland/)).not.toBeInTheDocument();
  });

  it("laat de markering los zodra de activiteit uit de agenda gehaald is, zonder herladen (FB-076)", async () => {
    stubAntwoorden(BESTEMMINGEN, [{ activiteitId: "a-2", datums: ["2026-10-13"] }]);
    const { client } = toonActiviteiten({ lopend: ["s-2"] });
    await screen.findByText(t("activiteitenpaneel.ingeplandOp", { dag: "di 13 okt" }));

    // Exactly what taking it off a day does: the placement is gone, and `useDagacties` invalidates the whole
    // weekplanning family. This read hangs under that family on purpose, so it is refetched without knowing about it.
    stubAntwoorden(BESTEMMINGEN, []);
    await client.invalidateQueries({ queryKey: ["weekplanning"] });

    await waitFor(() =>
      expect(screen.queryByText(t("activiteitenpaneel.ingeplandOp", { dag: "di 13 okt" }))).not.toBeInTheDocument(),
    );
    expect((screen.getByRole("button", { name: /^Paddenstoelen tekenen/ }) as HTMLElement).className).not.toContain(
      "border-l-inkt-zwak",
    );
  });

  it("laat een ander subthema kiezen, gegroepeerd per thema, en toont dan diens activiteiten", async () => {
    toonActiviteiten({ lopend: ["s-2"] });
    await screen.findByRole("button", { name: /^Paddenstoelen tekenen/ });

    // Only what the server offers for this klas's leeftijd, one group per thema.
    const groepen = within(keuzelijst()).getAllByRole("group");
    expect(groepen.map((groep) => groep.getAttribute("label"))).toEqual(["Herfst", "Sinterklaas"]);
    expect(within(keuzelijst()).getAllByRole("option")).toHaveLength(3);

    fireEvent.change(keuzelijst(), { target: { value: "s-1" } });

    expect(await screen.findByRole("button", { name: /^Eikels rapen/ })).toBeInTheDocument();
    expect(useHoekenpaneel.getState().subthemaKeuze).toEqual({ subthemaId: "s-1", klasId: "k-1", week: WEEK });
    // True only of a subthema that runs this week, which the chosen one does not.
    expect(screen.queryByText(t("activiteitenpaneel.looptInWeek", { nummer: 38 }))).not.toBeInTheDocument();
  });

  it("zegt het wanneer er deze week geen subthema loopt, en biedt de keuzelijst aan", async () => {
    toonActiviteiten();

    expect(await screen.findByText(t("activiteitenpaneel.geenLopendInWeek", { nummer: 38 }))).toBeInTheDocument();
    expect(keuzelijst()).toHaveValue("");
    expect(screen.queryByRole("button", { name: /^(Eikels rapen|Paddenstoelen tekenen)/ })).not.toBeInTheDocument();
  });

  it("zegt bij een klas zonder subthema's dat die er nog niet zijn, en wijst naar de thema's", async () => {
    stubAntwoorden([]);
    toonActiviteiten();

    expect(await screen.findByText(t("activiteitenpaneel.geenSubthemas"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("activiteitenpaneel.naarThemas") })).toHaveAttribute("href", "/themas");
    // No list of nothing, and no claim about this week that the empty list cannot make.
    expect(screen.queryByLabelText(t("activiteitenpaneel.subthema"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("activiteitenpaneel.geenLopendInWeek", { nummer: 38 }))).not.toBeInTheDocument();
  });

  it("toont een subthema zonder activiteiten als zodanig, met de tegel voor wie er een mag maken", async () => {
    useHoekenpaneel.setState({ subthemaKeuze: { subthemaId: "s-3", klasId: "k-1", week: WEEK } });
    toonActiviteiten({ ik: ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["k-1"] }) });

    expect(await screen.findByText(t("activiteitenpaneel.geenActiviteiten"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("activiteit.toevoegen") }));

    expect(await screen.findByRole("dialog", { name: t("activiteit.nieuwTitel") })).toBeInTheDocument();
  });

  it("toont de tegel niet aan wie in dat subthema geen activiteit mag maken", async () => {
    useHoekenpaneel.setState({ subthemaKeuze: { subthemaId: "s-3", klasId: "k-1", week: WEEK } });
    toonActiviteiten({ ik: ikMet({ leerkrachtLeeftijden: ["K2"] }) });

    expect(await screen.findByText(t("activiteitenpaneel.geenActiviteiten"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("activiteit.toevoegen") })).not.toBeInTheDocument();
  });

  // Antagonist FB-017, finding 1: "no subthema runs" is a claim only a read that succeeded can make.
  it("zegt niets over de week en kiest niets zolang die nog gelezen wordt", async () => {
    const { client } = toonActiviteiten({ lopend: "laadt" });

    // Only once the subthema list itself has arrived: before that the panel shows loading rows whatever the week says,
    // and a test asserting then would pass without the guard it is about (antagonist FB-017, round 2).
    await waitFor(() =>
      expect(client.getQueryState(["thema-bibliotheek", "bestemmingen", "k-1"])?.status).toBe("success"),
    );
    expect(screen.queryByLabelText(t("activiteitenpaneel.subthema"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("activiteitenpaneel.geenLopendInWeek", { nummer: 38 }))).not.toBeInTheDocument();
  });

  it("zegt niet dat er niets loopt wanneer er een subthema loopt dat deze lijst niet aanbiedt", async () => {
    // A subthema given another leeftijd after it was planned still runs in the klas's calendar.
    toonActiviteiten({ lopend: ["elders"] });

    await waitFor(() => expect(keuzelijst()).toHaveValue(""));
    expect(screen.queryByText(t("activiteitenpaneel.geenLopendInWeek", { nummer: 38 }))).not.toBeInTheDocument();
  });

  it("zegt minder, en niets anders, wanneer de week niet gelezen kon worden", async () => {
    toonActiviteiten({ lopend: "mislukt" });

    await waitFor(() => expect(keuzelijst()).toHaveValue(""));
    expect(screen.queryByText(t("activiteitenpaneel.geenLopendInWeek", { nummer: 38 }))).not.toBeInTheDocument();
  });

  // Antagonist FB-017, finding 3: a choice holds only for the week and the klas it was made in.
  it("vergeet een keuze uit een andere week en opent op het subthema van deze week", async () => {
    useHoekenpaneel.setState({ subthemaKeuze: { subthemaId: "s-1", klasId: "k-1", week: "2026-09-07" } });
    toonActiviteiten({ lopend: ["s-2"] });

    expect(await screen.findByRole("button", { name: /^Paddenstoelen tekenen/ })).toBeInTheDocument();
    expect(keuzelijst()).toHaveValue("s-2");
  });

  it("vergeet een keuze uit een andere klas", async () => {
    useHoekenpaneel.setState({ subthemaKeuze: { subthemaId: "s-1", klasId: "k-2", week: WEEK } });
    toonActiviteiten({ lopend: ["s-2"] });

    await waitFor(() => expect(keuzelijst()).toHaveValue("s-2"));
  });

  // Owner, 2026-09-15: whoever may only read the klas sees the cards and nothing to plan with.
  it("toont wie de klas alleen mag inkijken de kaarten, zonder te plannen en zonder tegel", async () => {
    const { onKiesActiviteit } = toonActiviteiten({
      lopend: ["s-2"],
      magPlannen: false,
      ik: ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["k-2"] }),
    });

    expect(await screen.findByText("Paddenstoelen tekenen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Paddenstoelen tekenen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("activiteit.toevoegen") })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Paddenstoelen tekenen"));
    expect(onKiesActiviteit).not.toHaveBeenCalled();
    // Reading a card's goals is reading, so the info icon stays.
    expect(screen.getByRole("button", { name: t("doelinfo.open", { naam: "Paddenstoelen tekenen" }) })).toBeInTheDocument();
  });

  // FB-018 (owner, 2026-09-15): the activiteitkaarten get the goals' info icon from whichever ticket merges second.
  it("toont de doelen van een kaart achter een info-icoon, alleen de aanvaarde en manuele", async () => {
    const { onKiesActiviteit } = toonActiviteiten({ lopend: ["s-2"] });

    const kaartje = await screen.findByRole("button", { name: /^Paddenstoelen tekenen/ });
    // One manual link and one proposal: a suggestion is not a goal of the card, so the mark says one.
    expect(within(kaartje).getByText(t("activiteit.eenDoel"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("doelinfo.open", { naam: "Paddenstoelen tekenen" }) }));
    expect(await screen.findByText("MUZ.1.1")).toBeInTheDocument();
    expect(screen.queryByText("MUZ.2.2")).not.toBeInTheDocument();
    // The icon shows the goals; it plans nothing.
    expect(onKiesActiviteit).not.toHaveBeenCalled();
  });

  it("toont wie de klas niet mag plannen geen algemene fiches", () => {
    useHoekenpaneel.setState({ soort: "algemeen" });
    toonActiviteiten({ magPlannen: false });

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
