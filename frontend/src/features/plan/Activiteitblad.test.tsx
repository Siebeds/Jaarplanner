import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeplandeActiviteit, ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { Activiteitblad } from "./Activiteitblad";

/**
 * A refused day action from the activiteit sheet (E6-02 slice 4, fix round 2, F7; WCAG 4.1.3).
 *
 * The sheet stays open on a failure and is a modal dialog, so it announces the failure itself. After a refusal the
 * refetched rights take the day section away; the refusal stays, as the same element, and says why.
 */

const WEIGERING = "Je hebt geen toegang tot deze actie.";

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
      activiteiten: [
        {
          id: "act-1",
          naam: "Bladerslinger",
          activiteitType: "Spel",
          hoek: null,
          verwachteUitkomsten: null,
          onderzoeksvraagId: null,
          kleur: null,
          lengteInLesuren: 1,
          doelkoppelingen: [],
        },
      ],
    },
  ],
};

const GEPLAND: GeplandeActiviteit = {
  plaatsingId: "p-1",
  activiteitId: "act-1",
  activiteitNaam: "Bladerslinger",
  activiteitType: "Spel",
  subthemaId: "sub-1",
  subthemaNaam: "Bladeren",
  themaId: "thema-1",
  themaNaam: "Herfst",
  begin: "09:00:00",
  einde: "09:50:00",
  status: "Manueel",
  kleur: null,
  doelcodes: [],
  valtBuitenThemaperiode: false,
};

function client() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-voor-klas", "thema-1", "klas-1"], THEMA);
  return metIk(qc, ikMet({ leerkrachtLeeftijden: ["K3"], hoofdleerkrachtLeeftijden: ["K3"] }));
}

function Blad({ qc, magPlannen, fout, onVerplaats = vi.fn() }: {
  qc: QueryClient;
  magPlannen: boolean;
  fout: string | null;
  onVerplaats?: (datum: string, begin: string, einde: string) => void;
}) {
  return (
    <QueryClientProvider client={qc}>
      <Activiteitblad
        activiteit={GEPLAND}
        datum="2026-10-06"
        klasId="klas-1"
        magPlannen={magPlannen}
        vroegste="2026-09-01"
        laatste="2027-06-30"
        bezig={false}
        fout={fout}
        onVerplaats={onVerplaats}
        onVerwijder={vi.fn()}
        onSluit={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("Activiteitblad na een geweigerde dagactie", () => {
  it("meldt de weigering in het blad, en houdt ze staan als de dagsectie met de rechten verdwijnt", () => {
    const qc = client();
    const verplaats = vi.fn();
    const { rerender } = render(<Blad qc={qc} magPlannen fout={null} onVerplaats={verplaats} />);

    fireEvent.change(screen.getByLabelText(t("periode.opDag")), { target: { value: "2026-10-07" } });
    fireEvent.click(screen.getByRole("button", { name: t("periode.verplaats") }));
    expect(verplaats).toHaveBeenCalledWith("2026-10-07", "09:00:00", "09:50:00");

    rerender(<Blad qc={qc} magPlannen fout={WEIGERING} onVerplaats={verplaats} />);
    const blad = screen.getByRole("dialog");
    const melding = within(blad).getByRole("alert");
    expect(melding).toHaveTextContent(WEIGERING);

    // The refetched rights arrive: no day section, and the same alert, so it is not announced a second time.
    rerender(<Blad qc={qc} magPlannen={false} fout={WEIGERING} onVerplaats={verplaats} />);
    expect(screen.queryByRole("button", { name: t("periode.verplaats") })).toBeNull();
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBe(melding);
  });

  it("toont wie de dag niet mag plannen geen fout die bij een ander blad hoorde", () => {
    render(<Blad qc={client()} magPlannen={false} fout={WEIGERING} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
  });
});
