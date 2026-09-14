import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { Subthemaplanner } from "./Subthemaplanner";

/**
 * The planner's result after rows failed (E6-02 slice 4, fix round 2, F7; WCAG 4.1.3). The planner stays open when a
 * row failed and is a modal dialog, so it announces the failures itself.
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

describe("Subthemaplanner", () => {
  it("meldt de rijen die niet lukten, met de reden, als melding in het blad", () => {
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
          themaIds={["thema-1"]}
          dagen={[]}
          bezig={false}
          resultaat={{ gelukt: 0, totaal: 1, fouten: ["Bladerslinger: Je hebt geen toegang tot deze actie."] }}
          onPlan={vi.fn()}
          onSluit={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const melding = within(screen.getByRole("dialog")).getByRole("alert");
    expect(melding).toHaveTextContent(t("periode.deelsGelukt", { gelukt: 0, totaal: 1 }));
    expect(melding).toHaveTextContent("Bladerslinger: Je hebt geen toegang tot deze actie.");
  });
});
