import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Eindvoorstel, ThemaBibliotheekItem } from "../../lib/types";
import { jaarplanSleutels, themaSleutels } from "../../lib/queries";
import { t } from "../../i18n";
import { periode, volleDag } from "../../lib/datum";
import { Themaplaatsingblad } from "./Themaplaatsingblad";

/**
 * Placing a thema by hand (ADR-0053): the server's proposed end fills the field until the teacher picks her own, the
 * parts around a vacation are shown before saving, and a refusal is shown in the server's words.
 */

const HERFST: ThemaBibliotheekItem = {
  id: "t-herfst",
  naam: "Herfst",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [],
  minimumdoelen: [],
};

const VOORSTEL: Eindvoorstel = {
  van: "2026-10-19",
  tot: "2026-11-20",
  delen: [
    { van: "2026-10-19", tot: "2026-10-30" },
    { van: "2026-11-09", tot: "2026-11-20" },
  ],
  beperktDoor: "VolgendThema",
  volgendThemaNaam: "Sint",
};

function toon(fout: string | null = null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(themaSleutels.bibliotheek(), [HERFST]);
  qc.setQueryData(jaarplanSleutels.voorstel("klas-1", "t-herfst", "2026-10-19"), VOORSTEL);
  const onPlaats = vi.fn();

  render(
    <QueryClientProvider client={qc}>
      <Themaplaatsingblad
        open
        klasId="klas-1"
        beginVoorstel="2026-10-19"
        eersteSchooldag="2026-09-01"
        laatsteSchooldag="2027-06-30"
        bezig={false}
        fout={fout}
        onPlaats={onPlaats}
        onSluit={vi.fn()}
      />
    </QueryClientProvider>,
  );

  const blad = screen.getByRole("dialog");
  fireEvent.change(within(blad).getByLabelText(t("plan.thema")), { target: { value: "t-herfst" } });
  return { blad, onPlaats };
}

describe("Themaplaatsingblad", () => {
  it("vult het voorgestelde einde in, zegt waarom het vroeger valt en toont de delen", () => {
    const { blad } = toon();

    expect(within(blad).getByLabelText(t("plan.begindatum"))).toHaveValue("2026-10-19");
    expect(within(blad).getByLabelText(t("plan.einddatum"))).toHaveValue("2026-11-20");
    expect(within(blad).getByText(t("plan.voorgesteldEinde", { datum: volleDag("2026-11-20") }))).toBeInTheDocument();
    expect(within(blad).getByText(t("plan.beperktVolgend", { naam: "Sint" }))).toBeInTheDocument();
    expect(within(blad).getByText(t("plan.inDelen", { aantal: 2 }))).toBeInTheDocument();
    expect(within(blad).getByText(periode("2026-11-09", "2026-11-20"))).toBeInTheDocument();
  });

  it("voegt het thema toe met het einde dat de leerkracht zelf koos", () => {
    const { blad, onPlaats } = toon();

    fireEvent.change(within(blad).getByLabelText(t("plan.einddatum")), { target: { value: "2026-10-30" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("plan.toevoegen") }));

    expect(onPlaats).toHaveBeenCalledWith({ themaId: "t-herfst", van: "2026-10-19", tot: "2026-10-30" });
    // The proposal's parts no longer describe her end, so they are not shown.
    expect(within(blad).queryByText(t("plan.inDelen", { aantal: 2 }))).toBeNull();
  });

  it("toont een weigering van de server in haar eigen woorden", () => {
    const { blad } = toon("Van 21 september 2026 tot 23 oktober 2026 loopt al het thema 'Water'.");

    expect(within(blad).getByRole("alert")).toHaveTextContent("loopt al het thema 'Water'");
  });
});
