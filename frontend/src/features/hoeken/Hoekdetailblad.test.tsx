import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hoekdetailblad } from "./Hoekdetailblad";
import type { HoekmomentWeergave, HoekplaatsingWeergave } from "./gegevens";
import { t } from "../../i18n";

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
  verrijkingen: [],
  momenten,
});

const gelijk = [
  moment("m-1", "2026-09-14", "08:00:00", "11:50:00"),
  moment("m-2", "2026-09-15", "08:00:00", "11:50:00"),
  moment("m-3", "2026-09-16", "08:00:00", "11:50:00"),
  moment("m-4", "2026-09-17", "08:00:00", "11:50:00"),
];

// The owner's screenshot: only the Monday's bottom edge pulled up to 10:00.
const maandagKorter = [moment("m-1", "2026-09-14", "08:00:00", "10:00:00"), ...gelijk.slice(1)];

const opUur = (periode: string, dagen: string) => t("hoekdetail.opUur", { periode, dagen });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(bouwhoek(gelijk)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon(momenten: HoekmomentWeergave[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Hoekdetailblad open plaatsing={bouwhoek(momenten)} bezig={false} onVerwijder={() => {}} onSluit={() => {}} />
    </QueryClientProvider>,
  );
}

const openUren = () => fireEvent.click(screen.getByRole("button", { name: t("hoekdetail.urenAanpassen") }));

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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [pad, init] = fetchMock.mock.calls[0];
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

  it("telt dagen en geen rijen wanneer een dag er twee heeft", () => {
    // Tuesday dragged onto Monday morning: four rows, three days, and one day with other hours.
    toon([moment("m-2", "2026-09-14", "07:00:00", "07:45:00"), ...gelijk.filter((m) => m.id !== "m-2")]);
    openUren();

    expect(
      screen.getByText(t("hoekdetail.geldtVoor", { dagen: t("hoekdetail.aantalSchooldagen", { aantal: 3 }) })),
    ).toBeInTheDocument();
    expect(screen.getByText(t("hoekdetail.afwijkendEen"))).toBeInTheDocument();
  });

  it("bewaart geen einde dat voor het begin ligt", () => {
    toon(gelijk);
    openUren();

    fireEvent.change(screen.getByLabelText(t("hoekdetail.tot")), { target: { value: "07:00" } });

    expect(screen.getByRole("alert")).toHaveTextContent(t("hoekdetail.eindeVoorBegin"));
    expect(screen.getByRole("button", { name: t("hoekdetail.bewaren") })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("biedt geen uren aan voor een hoek zonder rijen, want er is niets om ze op te zetten", () => {
    toon([]);

    expect(screen.getByText(t("hoekdetail.geenUur"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoekdetail.urenAanpassen") })).toBeNull();
  });
});
