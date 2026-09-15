import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Algemenefichedetailblad } from "./Algemenefichedetailblad";
import type { AlgemeneFichemomentWeergave, AlgemeneFicheplaatsingWeergave } from "./gegevens";
import { toonBereik } from "../plan/tijd";
import type { Infodoel } from "../plan/Doelinfo";
import { t } from "../../i18n";
import { volleDag } from "../../lib/datum";

/**
 * A planned algemene fiche, in the sheet that describes it.
 *
 * Two things are pinned. One day can be changed without a drag (WCAG 2.2 SC 2.5.7), through the same endpoint the
 * drag uses and for that day only. And the delete's cost is said only where it is true: when this is the fiche's
 * only period and the fiche carries goals.
 */
const moment = (
  id: string,
  datum: string,
  begin: string,
  einde: string,
  tekst: string | null = null,
): AlgemeneFichemomentWeergave => ({
  id,
  datum,
  begin,
  einde,
  tekst,
});

// Four Mondays of turnen; the last one moved to the afternoon.
const maandagen = [
  moment("m-1", "2026-09-07", "10:30:00", "11:20:00"),
  moment("m-2", "2026-09-14", "10:30:00", "11:20:00"),
  moment("m-3", "2026-09-21", "10:30:00", "11:20:00"),
  moment("m-4", "2026-09-28", "13:00:00", "13:50:00"),
];

const turnen: AlgemeneFicheplaatsingWeergave = {
  id: "p-1",
  algemeneFicheId: "f-1",
  ficheNaam: "turnen",
  van: "2026-09-07",
  tot: "2026-09-28",
  momenten: maandagen,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(turnen), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon({
  momentId = null,
  enige = false,
  alleenLezen = false,
  doelen,
  plaatsing = turnen,
  onVerwijder = () => {},
}: {
  momentId?: string | null;
  enige?: boolean;
  alleenLezen?: boolean;
  doelen?: readonly Infodoel[];
  plaatsing?: AlgemeneFicheplaatsingWeergave;
  onVerwijder?: () => void;
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Algemenefichedetailblad
        open
        plaatsing={plaatsing}
        momentId={momentId}
        enigePeriodeMetDoelen={enige}
        doelen={doelen}
        alleenLezen={alleenLezen}
        bezig={false}
        onVerwijder={onVerwijder}
        onSluit={() => {}}
      />
    </QueryClientProvider>,
  );
}

const opUur = (begin: string, einde: string, dagen: string) =>
  t("fichedetail.opUur", { periode: toonBereik(begin, einde), dagen });

/*
  E6-02: a planned algemene fiche is the klas's planning (ADR-0030 §3, R7). A gebruiker who may read the agenda and not
  plan the klas opens the same sheet from a block and gets what the run is, with nothing that would change it: the
  same shape as `Hoekdetailblad`'s reader case.
*/
describe("Algemenefichedetailblad voor wie de klas alleen mag bekijken", () => {
  it("toont periode en uren, zonder verwijderen, zonder dagvelden en zonder de zin over wat verwijderen kost", () => {
    // Opened from a block (a moment) on the fiche's only period with goals: every write-side part would show here.
    toon({ momentId: "m-2", enige: true, alleenLezen: true });

    expect(
      screen.getByText(opUur("10:30:00", "11:20:00", t("fichedetail.aantalSchooldagen", { aantal: 3 }))),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("fichedetail.verwijder") })).toBeNull();
    expect(screen.queryByLabelText(t("fichedetail.dag"))).toBeNull();
    expect(screen.queryByLabelText(t("fichedetail.van"))).toBeNull();
    expect(screen.queryByLabelText(t("fichedetail.tot"))).toBeNull();
    expect(screen.queryByRole("button", { name: t("fichedetail.bewaren") })).toBeNull();
    // The cost of a delete she cannot make is not hers to weigh.
    expect(screen.queryByText(t("fichedetail.laatstePeriode"))).toBeNull();
  });
});

describe("Algemenefichedetailblad", () => {
  it("zegt per groep uren op hoeveel schooldagen, in plaats van de eerste dag voor allemaal te laten spreken", () => {
    toon();

    expect(
      screen.getByText(opUur("10:30:00", "11:20:00", t("fichedetail.aantalSchooldagen", { aantal: 3 }))),
    ).toBeInTheDocument();
    expect(screen.getByText(opUur("13:00:00", "13:50:00", t("fichedetail.eenSchooldag")))).toBeInTheDocument();
  });

  it("past zonder slepen alleen de dag aan waarop ze het blad opende", async () => {
    toon({ momentId: "m-2" });

    expect(screen.getByText(t("fichedetail.ditMoment", { dag: volleDag("2026-09-14") }))).toBeInTheDocument();
    const bewaar = screen.getByRole("button", { name: t("fichedetail.bewaren") });
    // Nothing changed yet, so there is nothing to save.
    expect(bewaar).toBeDisabled();

    fireEvent.change(screen.getByLabelText(t("fichedetail.tot")), { target: { value: "11:50" } });
    fireEvent.click(bewaar);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/algemene-ficheplaatsingen/p-1/momenten/m-2");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ datum: "2026-09-14", begin: "10:30:00", einde: "11:50:00" });
  });

  it("weigert een weekenddag al voor er iets verstuurd wordt", () => {
    toon({ momentId: "m-2" });

    // Saturday 19 September: inside the window, but no school. A vakantie is the server's to refuse.
    fireEvent.change(screen.getByLabelText(t("fichedetail.dag")), { target: { value: "2026-09-19" } });

    expect(screen.getByText(t("fichedetail.geenSchooldag"))).toBeInTheDocument();
    // The literal as well as the key: the server refuses a vakantie with this same sentence
    // (`AlgemeneFicheplaatsing.VerplaatsMoment`, pinned in `AlgemeneFicheplaatsingTests`), so the two must not drift.
    expect(screen.getByText("Op die dag is er geen school. Kies een schooldag.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("fichedetail.bewaren") })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("haalt een weigering weg zodra ze een veld aanpast, want die ging over het vorige antwoord", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Op die dag is er geen school. Kies een schooldag." }), {
        status: 400,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );
    toon({ momentId: "m-2" });

    fireEvent.change(screen.getByLabelText(t("fichedetail.dag")), { target: { value: "2026-11-04" } });
    fireEvent.click(screen.getByRole("button", { name: t("fichedetail.bewaren") }));
    expect(await screen.findByText(t("fichedetail.momentMislukt"))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t("fichedetail.dag")), { target: { value: "2026-09-15" } });
    await waitFor(() => expect(screen.queryByText(t("fichedetail.momentMislukt"))).not.toBeInTheDocument());
  });

  it("biedt geen dagvelden aan wanneer het blad een hele periode toont", () => {
    toon({ momentId: null });
    expect(screen.queryByLabelText(t("fichedetail.dag"))).not.toBeInTheDocument();
    // Nor a day text: there is no particular day.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("zegt alleen bij de enige periode van een fiche met doelen dat de fiche dan niet meer meetelt", () => {
    const { unmount } = toon({ enige: true });
    expect(screen.getByText(t("fichedetail.laatstePeriode"))).toBeInTheDocument();
    unmount();

    toon({ enige: false });
    expect(screen.queryByText(t("fichedetail.laatstePeriode"))).not.toBeInTheDocument();
  });
});

/*
  FB-022: a text per day. Wero stands every afternoon; opened from one day's block, the sheet carries that day's text,
  saved for that occurrence only. A reader sees it and cannot change it. Deleting the period asks first when texts would
  be lost with it.
*/
describe("Algemenefichedetailblad: tekst per dag", () => {
  const dagtekstLabel = (datum: string) => t("fichedetail.dagtekst", { dag: volleDag(datum) });
  const metTekst: AlgemeneFicheplaatsingWeergave = {
    ...turnen,
    momenten: [
      moment("m-1", "2026-09-07", "13:15:00", "14:00:00", "Kapla: een toren bouwen."),
      moment("m-2", "2026-09-14", "13:15:00", "14:00:00", "Buiten met de fietsjes."),
      moment("m-3", "2026-09-21", "13:15:00", "14:00:00"),
    ],
  };

  it("bewaart de tekst voor alleen de dag waarop ze het blad opende", async () => {
    toon({ momentId: "m-2" });

    const veld = screen.getByLabelText(dagtekstLabel("2026-09-14"));
    const bewaar = screen.getByRole("button", { name: t("fichedetail.dagtekstBewaren") });
    expect(bewaar).toBeDisabled();

    fireEvent.change(veld, { target: { value: "  We bouwen een toren met kapla.  " } });
    fireEvent.click(bewaar);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/algemene-ficheplaatsingen/p-1/momenten/m-2/tekst");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ tekst: "We bouwen een toren met kapla." });
  });

  it("vult het veld met de bewaarde tekst van die dag", () => {
    toon({ momentId: "m-1", plaatsing: metTekst });

    expect(screen.getByLabelText(dagtekstLabel("2026-09-07"))).toHaveValue("Kapla: een toren bouwen.");
  });

  it("toont de tekst aan wie de klas alleen mag bekijken, zonder veld", () => {
    toon({ momentId: "m-1", plaatsing: metTekst, alleenLezen: true });

    expect(screen.getByText("Kapla: een toren bouwen.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: t("fichedetail.dagtekstBewaren") })).toBeNull();
  });

  it("zegt aan wie alleen mag bekijken dat er voor die dag nog niets staat", () => {
    toon({ momentId: "m-3", plaatsing: metTekst, alleenLezen: true });

    expect(screen.getByText(t("fichedetail.dagtekstLeeg"))).toBeInTheDocument();
  });

  it("vraagt eerst of de periode weg mag wanneer er teksten mee verloren gaan, met het aantal", () => {
    const onVerwijder = vi.fn();
    toon({ momentId: "m-3", plaatsing: metTekst, onVerwijder });

    fireEvent.click(screen.getByRole("button", { name: t("fichedetail.verwijder") }));

    expect(screen.getByRole("dialog", { name: t("fichedetail.bevestigTitel") })).toBeInTheDocument();
    expect(screen.getByText(t("fichedetail.bevestigTeksten", { aantal: 2 }))).toBeInTheDocument();
    expect(onVerwijder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t("fichedetail.bevestigLabel") }));
    expect(onVerwijder).toHaveBeenCalledTimes(1);
  });

  it("haalt een periode zonder teksten meteen weg, zoals voorheen", () => {
    const onVerwijder = vi.fn();
    toon({ onVerwijder });

    fireEvent.click(screen.getByRole("button", { name: t("fichedetail.verwijder") }));

    expect(onVerwijder).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: t("fichedetail.bevestigTitel") })).toBeNull();
  });
});

/*
  FB-018: the fiche's goals in its own sheet. A block too short to hold the info icon keeps them here, so this is the one
  place they are reachable from every block.
*/
describe("Algemenefichedetailblad: doelen", () => {
  const groeten: Infodoel = { code: "1.1.GK3.1", doelsoort: "Gemeenschappelijk", tekst: "Groet de anderen." };

  it("somt de doelen van de fiche op, ook voor wie de klas alleen mag bekijken", () => {
    toon({ doelen: [groeten], alleenLezen: true });

    expect(screen.getByText(t("fichedetail.doelen"))).toBeInTheDocument();
    expect(screen.getByText("Groet de anderen.")).toBeInTheDocument();
  });

  it("zegt dat er nog geen doelen gekoppeld zijn", () => {
    toon({ doelen: [] });

    expect(screen.getByText(t("doelinfo.geen"))).toBeInTheDocument();
  });

  it("zegt niets over doelen zolang de fichelijst er niet is", () => {
    toon();

    expect(screen.queryByText(t("fichedetail.doelen"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("doelinfo.geen"))).not.toBeInTheDocument();
  });

  it("opent het detail van een doel boven het blad", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "1.1.GK3.1",
          doelsoort: "Gemeenschappelijk",
          jaarFase: "K3",
          disciplineNummer: "1",
          disciplineNaam: "Taal",
          domein: "Mondelinge taalvaardigheid",
          subdomein: "Spreken",
          cluster: null,
          tekst: "Groet de anderen.",
          voorbeelden: null,
          toelichting: null,
          woordenschat: null,
          minimumdoelRef: null,
          minimumdoel: null,
          nietMeerInOpstap: false,
          koppelingen: [],
          gerelateerdeDoelen: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    toon({ doelen: [groeten] });

    fireEvent.click(screen.getByRole("button", { name: /Groet de anderen\./ }));

    expect(await screen.findByRole("dialog", { name: t("doel.titel") })).toBeInTheDocument();
  });
});
