import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { Subthemaplanner } from "./Subthemaplanner";

/**
 * The planner after rows failed (E6-02 slice 4, fix round 2, fix round 3 and the mini-fix after audit round 4; WCAG
 * 4.1.3, the E3-06 and E5-03 rules). The planner stays open when a row failed and is a modal dialog, so it announces
 * the failures itself. Once the refetched rights say the klas may not be planned, only the result is left: no plan
 * button, no fields, no preview.
 */

const THEMA: ThemaWeergave = {
  id: "thema-1",
  naam: "Herfst",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  leeftijden: ["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"],
  themadoelen: [],
  minimumdoelen: [],
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

function client() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-voor-klas", "thema-1", "klas-1"], THEMA);
  return metIk(qc, ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
}

function Planner({ qc, magPlannen }: { qc: QueryClient; magPlannen: boolean }) {
  return (
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
    </QueryClientProvider>
  );
}

describe("Subthemaplanner", () => {
  it("meldt de rijen die niet lukten, met de reden, als melding in het blad", () => {
    render(<Planner qc={client()} magPlannen />);
    const blad = screen.getByRole("dialog");

    const melding = within(blad).getByRole("alert");
    expect(melding).toHaveTextContent(t("periode.deelsGelukt", { gelukt: 0, totaal: 1 }));
    expect(melding).toHaveTextContent(FOUT);
    expect(within(blad).getByRole("button", { name: t("periode.markeerPeriode") })).toBeInTheDocument();
  });

  it("laat alleen het resultaat staan, als hetzelfde element, als deze klas niet meer gepland mag worden", () => {
    const qc = client();
    const { rerender } = render(<Planner qc={qc} magPlannen />);
    const blad = screen.getByRole("dialog");
    fireEvent.change(within(blad).getByLabelText(t("periode.subthema")), { target: { value: "sub-1" } });
    expect(within(blad).getByText(t("periode.voorbeeld"))).toBeInTheDocument();
    const melding = within(blad).getByRole("alert");

    // The refetched rights arrive: this klas may not be planned.
    rerender(<Planner qc={qc} magPlannen={false} />);

    expect(within(blad).queryByRole("button", { name: t("periode.markeerPeriode") })).toBeNull();
    expect(within(blad).queryByText(t("periode.voorbeeld"))).toBeNull();
    expect(within(blad).queryByLabelText(t("periode.subthema"))).toBeNull();
    expect(within(blad).queryByLabelText(t("periode.eersteDag"))).toBeNull();
    expect(within(blad).queryByLabelText(t("periode.laatsteDag"))).toBeNull();
    expect(within(blad).queryByRole("radiogroup")).toBeNull();
    // The reason stays, as the same element, so it is not announced again.
    expect(within(blad).getByRole("alert")).toBe(melding);
    expect(melding).toHaveTextContent(FOUT);
  });
});
