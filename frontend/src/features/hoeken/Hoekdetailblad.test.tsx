import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hoekdetailblad } from "./Hoekdetailblad";
import type { HoekmomentWeergave, HoekplaatsingWeergave } from "./gegevens";
import { t } from "../../i18n";
import { periode, volleDag } from "../../lib/datum";

/**
 * The hours of a run, in the sheet that describes it (owner, 2026-09-11).
 *
 * Two things are pinned. The line says what every day does, not what the first day does: that is the defect the
 * owner's own screenshot showed, where shortening only the Monday made the sheet claim all four days ended at 10:00.
 * And new hours go to the server once for the whole run, with a warning first when a day she moved by hand is about
 * to be overwritten, which was the owner's condition for overwriting it at all.
 */
const moment = (id: string, datum: string, begin: string, einde: string): HoekmomentWeergave => ({
  id,
  datum,
  begin,
  einde,
});

const bouwhoek = (momenten: HoekmomentWeergave[]): HoekplaatsingWeergave => ({
  id: "hp-1",
  hoekId: "h-1",
  hoekNaam: "bouwhoek",
  van: "2026-09-14",
  tot: "2026-09-17",
  momenten,
});

/** Two stored subthemaperiodes touching the run: the boekenhoek... this bouwhoek has a verrijking in the first. */
const HERFST = {
  subthemaperiodeId: "p-herfst",
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-07",
  tot: "2026-09-15",
  verrijkingen: [{ id: "v-1", hoekId: "h-1", tekst: "herfstboeken" }],
};
const WINTER = {
  subthemaperiodeId: "p-winter",
  subthemaId: "s-winter",
  subthemaNaam: "De winter",
  van: "2026-09-16",
  tot: "2026-09-25",
  // Another corner's verrijking: this one's is still empty here.
  verrijkingen: [{ id: "v-2", hoekId: "h-2", tekst: "sneeuwbollen" }],
};

const gelijk = [
  moment("m-1", "2026-09-14", "08:00:00", "11:50:00"),
  moment("m-2", "2026-09-15", "08:00:00", "11:50:00"),
  moment("m-3", "2026-09-16", "08:00:00", "11:50:00"),
  moment("m-4", "2026-09-17", "08:00:00", "11:50:00"),
];

// The owner's screenshot: only the Monday's bottom edge pulled up to 10:00.
const maandagKorter = [moment("m-1", "2026-09-14", "08:00:00", "10:00:00"), ...gelijk.slice(1)];

// Tuesday dragged onto Monday morning: four rows on three days, Monday twice.
const maandagDubbel = [moment("m-2", "2026-09-14", "07:00:00", "07:45:00"), ...gelijk.filter((m) => m.id !== "m-2")];

const opUur = (periode: string, dagen: string) => t("hoekdetail.opUur", { periode, dagen });

let fetchMock: ReturnType<typeof vi.fn>;
/** What the server answers for the subthemaperiodes touching the run (FB-020); none unless a test says otherwise. */
let perioden: unknown[] = [];

beforeEach(() => {
  perioden = [];
  fetchMock = vi.fn(
    async (pad: string) =>
      new Response(JSON.stringify(String(pad).includes("/hoekverrijkingen") ? perioden : bouwhoek(gelijk)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

/** The writes the sheet sent: the reads of its verrijkingen are not what these tests are about. */
const schrijfacties = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method !== undefined);

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Renders the sheet, and hands back a way to re-render it with another run, the way a refetch would. */
function toon(momenten: HoekmomentWeergave[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const blad = (lijst: HoekmomentWeergave[]) => (
    <QueryClientProvider client={client}>
      <Hoekdetailblad
        open
        klasId="k-1"
        plaatsing={bouwhoek(lijst)}
        bezig={false}
        onVerwijder={() => {}}
        onSluit={() => {}}
      />
    </QueryClientProvider>
  );
  const resultaat = render(blad(momenten));
  return { ververs: (lijst: HoekmomentWeergave[]) => resultaat.rerender(blad(lijst)) };
}

const openUren = () => fireEvent.click(screen.getByRole("button", { name: t("hoekdetail.urenAanpassen") }));

/*
  E6-02: a placed hoek is the klas's planning (ADR-0030 §3, R7). A gebruiker who may read the agenda and not plan the
  klas opens the same sheet and gets what the run is, with nothing that would change it.
*/
describe("Hoekdetailblad voor wie de klas alleen mag bekijken", () => {
  it("toont periode, uren en verrijking, zonder één knop die iets verandert", async () => {
    perioden = [HERFST, WINTER];
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <Hoekdetailblad
          open
          alleenLezen
          klasId="k-1"
          plaatsing={bouwhoek(maandagDubbel)}
          bezig={false}
          onVerwijder={() => {}}
          onSluit={() => {}}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("herfstboeken")).toBeInTheDocument();
    expect(screen.getByText(opUur("8:00 - 11:50", t("hoekdetail.aantalSchooldagen", { aantal: 3 })))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoekdetail.urenAanpassen") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("hoekdetail.verwijder") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("hoekdetail.verrijkingBewerkVan", { naam: "De herfst" }) })).toBeNull();
    expect(screen.queryByRole("button", { name: t("hoekdetail.verrijkingInvullenVan", { naam: "De winter" }) })).toBeNull();
    // The doubled-day sentence tells her to drag a day away first: an instruction for a change she cannot make.
    expect(screen.queryByText(/staat deze hoek meer dan één keer/)).toBeNull();
    // The way out is the sheet's own close control, once: the footer, whose only button would repeat it, is left out.
    expect(screen.getAllByRole("button", { name: t("hoekdetail.sluiten") })).toHaveLength(1);
  });
});

/*
  FB-020: the corner's verrijking belongs to the hoek and a subthemaperiode, not to this placement. The sheet lists every
  stored window touching the run's days, each with what this hoek holds then, and edits one hoek at a time (owner,
  2026-09-15: also editable here).
*/
describe("Hoekdetailblad: de verrijking per subthemaperiode", () => {
  it("toont elke subthemaperiode van deze dagen met wat deze hoek dan bevat", async () => {
    perioden = [HERFST, WINTER];
    toon(gelijk);

    expect(await screen.findByText("herfstboeken")).toBeInTheDocument();
    expect(screen.getByText(t("hoekdetail.tijdens", { naam: "De herfst", periode: periode("2026-09-07", "2026-09-15") })))
      .toBeInTheDocument();
    // De winter has another corner's verrijking and none for this one: that is "nothing yet", not the other's text.
    expect(screen.getByText(t("hoekdetail.geenVerrijking"))).toBeInTheDocument();
    expect(screen.queryByText("sneeuwbollen")).toBeNull();
  });

  it("bewaart een herschreven verrijking voor deze hoek alleen, bij die subthemaperiode", async () => {
    perioden = [HERFST, WINTER];
    toon(gelijk);

    fireEvent.click(await screen.findByRole("button", { name: t("hoekdetail.verrijkingBewerkVan", { naam: "De herfst" }) }));
    fireEvent.change(screen.getByLabelText(t("hoekdetail.verrijkingLabel")), { target: { value: "herfstboeken en bladeren" } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekdetail.bewaren") }));

    await waitFor(() => expect(schrijfacties()).toHaveLength(1));
    const [pad, init] = schrijfacties()[0];
    expect(pad).toBe("/api/klassen/k-1/hoekverrijkingen");
    expect(init.method).toBe("PUT");
    // Only this hoek: the other corners of the window are left out, so they stay as they are.
    expect(JSON.parse(init.body)).toEqual({
      subthemaperiodeId: "p-herfst",
      verrijkingen: [{ hoekId: "h-1", tekst: "herfstboeken en bladeren" }],
    });
  });

  it("vult een lege verrijking in, en verwijderen stuurt een lege tekst", async () => {
    perioden = [HERFST, WINTER];
    toon(gelijk);

    fireEvent.click(await screen.findByRole("button", { name: t("hoekdetail.verrijkingWegVan", { naam: "De herfst" }) }));
    await waitFor(() => expect(schrijfacties()).toHaveLength(1));
    expect(JSON.parse(schrijfacties()[0][1].body)).toEqual({
      subthemaperiodeId: "p-herfst",
      verrijkingen: [{ hoekId: "h-1", tekst: "" }],
    });

    // De winter has nothing for this hoek: no delete, and the button says it fills something in.
    expect(screen.queryByRole("button", { name: t("hoekdetail.verrijkingWegVan", { naam: "De winter" }) })).toBeNull();
    expect(screen.getByRole("button", { name: t("hoekdetail.verrijkingInvullenVan", { naam: "De winter" }) }))
      .toBeInTheDocument();
  });

  it("zegt dat er in deze dagen nog geen subthemaperiode is, en pas als de server dat antwoordde", async () => {
    toon(gelijk);

    expect(await screen.findByText(t("hoekdetail.geenSubthemaperiode"))).toBeInTheDocument();
  });
});

describe("Hoekdetailblad: de uren van de hoek", () => {
  it("zegt per groep uren op hoeveel dagen, in plaats van de eerste dag voor allemaal te laten spreken", () => {
    toon(maandagKorter);

    expect(screen.getByText(opUur("8:00 - 11:50", t("hoekdetail.aantalSchooldagen", { aantal: 3 })))).toBeInTheDocument();
    expect(screen.getByText(opUur("8:00 - 10:00", t("hoekdetail.eenSchooldag")))).toBeInTheDocument();
    expect(screen.queryByText(opUur("8:00 - 10:00", t("hoekdetail.aantalSchooldagen", { aantal: 4 })))).toBeNull();
  });

  it("stuurt nieuwe uren in één keer voor de hele periode en geeft de focus terug", async () => {
    toon(gelijk);
    openUren();

    const van = screen.getByLabelText(t("hoekdetail.van"));
    expect(van).toHaveValue("08:00");
    expect(van).toHaveFocus();
    // Every day already has the same hours, so there is nothing to warn about.
    expect(screen.queryByText(t("hoekdetail.afwijkendEen"))).toBeNull();

    fireEvent.change(van, { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText(t("hoekdetail.tot")), { target: { value: "10:30" } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekdetail.bewaren") }));

    await waitFor(() => expect(schrijfacties()).toHaveLength(1));
    const [pad, init] = schrijfacties()[0];
    expect(pad).toBe("/api/hoekplaatsingen/hp-1/uren");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ begin: "09:00:00", einde: "10:30:00" });

    // The form closes, and a keyboard user lands where she started rather than at the top of the page.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: t("hoekdetail.urenAanpassen") })).toHaveFocus(),
    );
  });

  it("zegt vóór het bewaren dat een dag met andere uren ook mee verandert", () => {
    toon(maandagKorter);
    openUren();

    // Filled with the hours most days have, which is what she is most likely adjusting from.
    expect(screen.getByLabelText(t("hoekdetail.tot"))).toHaveValue("11:50");
    expect(screen.getByText(t("hoekdetail.afwijkendEen"))).toBeInTheDocument();
    expect(
      screen.getByText(t("hoekdetail.geldtVoor", { dagen: t("hoekdetail.aantalSchooldagen", { aantal: 4 }) })),
    ).toBeInTheDocument();
  });

  /*
    A DAY HOLDING THE HOEK MORE THAN ONCE (owner ruling 2026-09-11: refuse and name the day, rather than fold).

    These assert the LITERAL sentence, not `t("hoekdetail.dubbeleDag")`: the server refuses the same case in its own
    words (`Hoekplaatsing.ZetUren`), pinned by the same literal in HoekplaatsingTests, and asserting through the key
    would let the nl.json twin drift from the server's without a single test noticing.
  */
  const dubbel = (dagen: string) =>
    `Op ${dagen} staat deze hoek meer dan één keer. Sleep er eerst één naar een andere dag, tot geen dag de hoek meer dan één keer heeft. Dan kan je de uren aanpassen.`;

  it("noemt een dag met de hoek twee keer in de woorden van de server, en biedt dan geen uren aan", () => {
    toon(maandagDubbel);

    expect(volleDag("2026-09-14")).toBe("maandag 14 september");
    expect(screen.getByText(dubbel("maandag 14 september"))).toBeInTheDocument();
    // No button into a form that cannot be saved: the reason stands where she reads the hours instead.
    expect(screen.queryByRole("button", { name: t("hoekdetail.urenAanpassen") })).toBeNull();
    expect(schrijfacties()).toHaveLength(0);
  });

  it("zegt ook bij drie keer op één dag meer dan één keer, en niet twee", () => {
    toon([
      ...gelijk,
      moment("m-5", "2026-09-14", "07:00:00", "07:45:00"),
      moment("m-6", "2026-09-14", "12:00:00", "12:30:00"),
    ]);

    expect(screen.getByText(dubbel("maandag 14 september"))).toBeInTheDocument();
  });

  it("noemt twee dagen in kalendervolgorde, opgesomd zoals de server ze opsomt", () => {
    // Out of order on purpose: Wednesday's extra row comes first in the list the server sent.
    toon([moment("m-6", "2026-09-16", "07:00:00", "07:45:00"), ...gelijk, moment("m-5", "2026-09-14", "07:00:00", "07:45:00")]);

    expect(screen.getByText(dubbel("maandag 14 september en woensdag 16 september"))).toBeInTheDocument();
  });

  it("houdt een al open formulier eerlijk wanneer de reeks eronder verandert, en zet de focus op de reden", async () => {
    const { ververs } = toon(gelijk);
    openUren();

    // Another tab drags Tuesday onto Monday while this form is open; the agenda's query hands the sheet the new run.
    ververs(maandagDubbel);

    const zin = screen.getByText(dubbel("maandag 14 september"));
    expect(screen.getByRole("button", { name: t("hoekdetail.bewaren") })).toBeDisabled();
    // The keyboard user who never reaches the disabled button still hears why, from either field.
    expect(screen.getByLabelText(t("hoekdetail.van"))).toHaveAttribute("aria-describedby", zin.id);
    expect(screen.getByLabelText(t("hoekdetail.tot"))).toHaveAttribute("aria-describedby", zin.id);
    // The overwrite warning gives way, since saving cannot happen; and the count is of days, not rows.
    expect(screen.queryByText(t("hoekdetail.afwijkendEen"))).toBeNull();
    expect(
      screen.getByText(t("hoekdetail.geldtVoor", { dagen: t("hoekdetail.aantalSchooldagen", { aantal: 3 }) })),
    ).toBeInTheDocument();

    // Cancelling: the button focus would return to is no longer there, so it lands on the reason in its place.
    fireEvent.click(screen.getByRole("button", { name: t("hoekdetail.annuleren") }));
    await waitFor(() => expect(screen.getByText(dubbel("maandag 14 september"))).toHaveFocus());
    expect(schrijfacties()).toHaveLength(0);
  });

  it("zet de focus op de reden wanneer de knop onder de cursor verdwijnt", async () => {
    const { ververs } = toon(gelijk);
    const knop = screen.getByRole("button", { name: t("hoekdetail.urenAanpassen") });
    act(() => knop.focus());
    expect(knop).toHaveFocus();

    ververs(maandagDubbel);

    await waitFor(() => expect(screen.getByText(dubbel("maandag 14 september"))).toHaveFocus());
  });

  it("zet de focus op de reden wanneer Bewaren onder de cursor uitgeschakeld wordt", async () => {
    const { ververs } = toon(gelijk);
    openUren();
    const bewaren = screen.getByRole("button", { name: t("hoekdetail.bewaren") });
    act(() => bewaren.focus());
    expect(bewaren).toHaveFocus();

    ververs(maandagDubbel);

    expect(bewaren).toBeDisabled();
    await waitFor(() => expect(screen.getByText(dubbel("maandag 14 september"))).toHaveFocus());
  });

  it("laat de focus staan waar ze was wanneer die niet op een van die twee knoppen stond", async () => {
    const { ververs } = toon(gelijk);
    // The footer's Sluiten, by its text: the sheet's close cross carries the same name as a label.
    const sluiten = screen.getByText(t("hoekdetail.sluiten"), { selector: "button" });
    act(() => sluiten.focus());

    ververs(maandagDubbel);

    // The reason is there, so the effect has run; and it left her where she was.
    await waitFor(() => expect(screen.getByText(dubbel("maandag 14 september"))).toBeInTheDocument());
    expect(sluiten).toHaveFocus();
  });

  it("trekt een focus die ze elders losliet niet naar de reden", async () => {
    // Focus left Sluiten for the page, not because anything vanished. Only the record of the last focused control
    // tells this apart from a button that vanished under her: without it, a focus on the page looks lost, and this
    // would pull her to the reason. (The Sluiten and dialog tests cannot catch that: a focus sitting on a live
    // element is never mistaken for a lost one.)
    const { ververs } = toon(gelijk);
    const sluiten = screen.getByText(t("hoekdetail.sluiten"), { selector: "button" });
    act(() => sluiten.focus());
    act(() => sluiten.blur());
    expect(document.body).toHaveFocus();

    ververs(maandagDubbel);

    // Not pulled to the reason. Where focus does end up is Radix's business rather than this sheet's: with focus on
    // the page and a node removed from the dialog, its FocusScope parks focus on the dialog itself.
    const zin = await screen.findByText(dubbel("maandag 14 september"));
    expect(zin).not.toHaveFocus();
  });

  it("laat een focus op het blad zelf staan", async () => {
    // She clicked plain text inside the sheet, so the dialog itself holds focus; a refetch bringing in a doubled day
    // leaves it there. A focus on the dialog is never treated as lost (see the ordering note in the component).
    const { ververs } = toon(gelijk);
    const blad = screen.getByRole("dialog");
    act(() => blad.focus());
    expect(blad).toHaveFocus();

    ververs(maandagDubbel);

    await waitFor(() => expect(screen.getByText(dubbel("maandag 14 september"))).toBeInTheDocument());
    expect(blad).toHaveFocus();
  });

  it("bewaart geen einde dat voor het begin ligt", () => {
    toon(gelijk);
    openUren();

    fireEvent.change(screen.getByLabelText(t("hoekdetail.tot")), { target: { value: "07:00" } });

    expect(screen.getByRole("alert")).toHaveTextContent(t("hoekdetail.eindeVoorBegin"));
    expect(screen.getByRole("button", { name: t("hoekdetail.bewaren") })).toBeDisabled();
    expect(schrijfacties()).toHaveLength(0);
  });

  it("biedt geen uren aan voor een hoek zonder rijen, want er is niets om ze op te zetten", () => {
    toon([]);

    expect(screen.getByText(t("hoekdetail.geenUur"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoekdetail.urenAanpassen") })).toBeNull();
  });
});
