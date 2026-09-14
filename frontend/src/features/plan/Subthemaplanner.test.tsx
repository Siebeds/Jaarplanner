import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { Subthemaplanner } from "./Subthemaplanner";

/**
 * The planner after rows failed (E6-02 slice 4, fix rounds 2 and 3; WCAG 4.1.3, the E3-06 rule). The planner stays
 * open when a row failed and is a modal dialog, so it announces the failures itself; once the refetched rights say
 * the klas may not be planned, its plan button goes.
 */

const THEMA: ThemaWeergave = {
  id: "thema-1",
  naam: "Herfst",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [],
  subthemas: [
    {
      id: "sub-1",
      themaId: "thema-1",
      naam: "Bladeren",
      duurWeken: 2,
      leeftijd: "K3",
      onderzoeksvragen: [],
      subdoelen: [],
      activiteiten: [],
    },
  ],
};

const FOUT = "Bladerslinger: Je hebt geen toegang tot deze actie.";

function toon(magPlannen: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-voor-klas", "thema-1", "klas-1"], THEMA);
  metIk(qc, ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));

  render(
    <QueryClientProvider client={qc}>
      <Subthemaplanner
        open
        klasId="klas-1"
        klasNaam="K3 groen"
        magSubthemaMaken
        magPlannen={magPlannen}
        themaIds={["thema-1"]}
        dagen={[]}
        bezig={false}
        resultaat={{ gelukt: 0, totaal: 1, fouten: [FOUT] }}
        onPlan={vi.fn()}
        onSluit={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return screen.getByRole("dialog");
}

describe("Subthemaplanner", () => {
  it("meldt de rijen die niet lukten, met de reden, als melding in het blad", () => {
    const blad = toon(true);

    const melding = within(blad).getByRole("alert");
    expect(melding).toHaveTextContent(t("periode.deelsGelukt", { gelukt: 0, totaal: 1 }));
    expect(melding).toHaveTextContent(FOUT);
    expect(within(blad).getByRole("button", { name: t("periode.markeerPeriode") })).toBeInTheDocument();
  });

  it("toont geen planknop meer als de vernieuwde rechten zeggen dat deze klas niet gepland mag worden", () => {
    const blad = toon(false);

    expect(within(blad).queryByRole("button", { name: t("periode.markeerPeriode") })).toBeNull();
    // The reason stays.
    expect(within(blad).getByRole("alert")).toHaveTextContent(FOUT);
  });
});
