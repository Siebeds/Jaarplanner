import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Algemenefichedetailblad } from "./Algemenefichedetailblad";
import type { AlgemeneFichemomentWeergave, AlgemeneFicheplaatsingWeergave } from "./gegevens";
import { toonBereik } from "../plan/tijd";
import { t } from "../../i18n";
import { volleDag } from "../../lib/datum";

/**
 * A planned algemene fiche, in the sheet that describes it.
 *
 * Two things are pinned. One day can be changed without a drag (WCAG 2.2 SC 2.5.7), through the same endpoint the
 * drag uses and for that day only. And the delete's cost is said only where it is true: when this is the fiche's
 * only period and the fiche carries goals.
 */
const moment = (id: string, datum: string, begin: string, einde: string): AlgemeneFichemomentWeergave => ({
  id,
  datum,
  begin,
  einde,
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

function toon({ momentId = null, enige = false }: { momentId?: string | null; enige?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Algemenefichedetailblad
        open
        plaatsing={turnen}
        momentId={momentId}
        enigePeriodeMetDoelen={enige}
        bezig={false}
        onVerwijder={() => {}}
        onSluit={() => {}}
      />
    </QueryClientProvider>,
  );
}

const opUur = (begin: string, einde: string, dagen: string) =>
  t("fichedetail.opUur", { periode: toonBereik(begin, einde), dagen });

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
  });

  it("zegt alleen bij de enige periode van een fiche met doelen dat de fiche dan niet meer meetelt", () => {
    const { unmount } = toon({ enige: true });
    expect(screen.getByText(t("fichedetail.laatstePeriode"))).toBeInTheDocument();
    unmount();

    toon({ enige: false });
    expect(screen.queryByText(t("fichedetail.laatstePeriode"))).not.toBeInTheDocument();
  });
});
