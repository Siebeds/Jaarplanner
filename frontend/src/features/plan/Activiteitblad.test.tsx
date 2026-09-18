import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { GeplandeActiviteit, ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { NIEMAND, ikMet, metIk } from "../../test/rechten";
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

function client(ik: Ik = ikMet({ leerkrachtLeeftijden: ["K3"], hoofdleerkrachtLeeftijden: ["K3"] })) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-voor-klas", "thema-1", "klas-1"], THEMA);
  return metIk(qc, ik);
}

function Blad({ qc, magPlannen, fout, onVerplaats = vi.fn(), onVerwijder = vi.fn() }: {
  qc: QueryClient;
  magPlannen: boolean;
  fout: string | null;
  onVerplaats?: (datum: string, begin: string, einde: string) => void;
  onVerwijder?: () => void;
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
        onVerwijder={onVerwijder}
        onSluit={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("Activiteitblad, de dag", () => {
  it("haalt de activiteit uit de agenda met het vuilbakicoon, en heeft geen knop Haal weg meer (TB-025)", () => {
    const verwijder = vi.fn();
    render(<Blad qc={client()} magPlannen fout={null} onVerwijder={verwijder} />);

    const blad = screen.getByRole("dialog");
    expect(within(blad).queryByRole("button", { name: "Haal weg" })).toBeNull();
    const bak = within(blad).getByRole("button", { name: t("periode.vanDagAria", { naam: "Bladerslinger" }) });
    expect(bak).toHaveAttribute("title", t("periode.vanDag"));

    fireEvent.click(bak);
    expect(verwijder).toHaveBeenCalledTimes(1);
  });

  it("toont het icoon niet aan wie de klas niet mag plannen", () => {
    render(<Blad qc={client()} magPlannen={false} fout={null} />);

    expect(screen.queryByRole("button", { name: t("periode.vanDagAria", { naam: "Bladerslinger" }) })).toBeNull();
  });
});

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

  it("houdt blad en melding dezelfde als ook het inhoudsrecht wegvalt, zodat de weigering een keer klinkt", async () => {
    // A leerkracht whose only klas at K3 is this one: she may plan it and change K3's activiteiten.
    const qc = client(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] }));
    const { rerender } = render(<Blad qc={qc} magPlannen fout={null} />);
    expect(screen.getByRole("button", { name: t("themabeheer.bewaar") })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t("periode.opDag")), { target: { value: "2026-10-07" } });
    fireEvent.click(screen.getByRole("button", { name: t("periode.verplaats") }));
    rerender(<Blad qc={qc} magPlannen fout={WEIGERING} />);
    const dialoog = screen.getByRole("dialog");
    const melding = within(dialoog).getByRole("alert");

    // Admin removed her klastoewijzing: the refetched rights hold neither the planning nor the content right.
    // Awaited for one task: TanStack Query hands `setQueryData` to its observers on the next one.
    await act(async () => {
      qc.setQueryData(["ik"], NIEMAND);
      await new Promise((r) => setTimeout(r, 0));
    });
    rerender(<Blad qc={qc} magPlannen={false} fout={WEIGERING} />);

    // The facts now, in the same dialog, with the same alert: not remounted, so not announced or scrolled again.
    expect(screen.getByRole("dialog")).toBe(dialoog);
    expect(within(dialoog).getByRole("heading", { name: "Bladerslinger" })).toBeInTheDocument();
    expect(within(dialoog).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(dialoog).getByRole("alert")).toBe(melding);
  });

  it("toont wie de dag niet mag plannen geen fout die bij een ander blad hoorde", () => {
    render(<Blad qc={client()} magPlannen={false} fout={WEIGERING} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
  });
});
