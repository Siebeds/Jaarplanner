import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api";
import type { Ik } from "../../lib/aanmelding";
import { volleDag } from "../../lib/datum";
import { geenToegangZin, isGeenToegang } from "../../lib/rechten";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { NIEMAND, ikMet, metIk } from "../../test/rechten";
import { Agendamelding } from "./Agendamelding";
import { Nieuweactiviteitblad } from "./Nieuweactiviteitblad";

/**
 * Refusals in the new-activiteit sheet (E6-02 slice 4, fix rounds 2 and 3; WCAG 4.1.3, the E3-06 rule).
 *
 * The sheet creates the activiteit, then plans it. It is a modal dialog, so a failure has to be announced inside it,
 * and the agenda's own alert must not mount behind it. From a refusal on, whether of the create or of the plan, the
 * sheet shows only the refusal: Bewaren would be refused again or make a second activiteit, and the day line would
 * promise a plan.
 */

const WEIGERING = "Je hebt geen toegang tot deze actie.";
const DAG = "2026-10-06";

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
      activiteiten: [],
    },
  ],
};

function client(ik: Ik) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-voor-klas", "thema-1", "klas-1"], THEMA);
  return metIk(qc, ik);
}

/** The agenda's two halves that matter here: its strip, and the sheet, told the same things the agenda tells them. */
function Agenda({
  qc,
  open,
  fout,
  onPlan = vi.fn(),
}: {
  qc: QueryClient;
  open: boolean;
  fout: unknown;
  onPlan?: (activiteitId: string, duur: number) => void;
}): ReactNode {
  return (
    <QueryClientProvider client={qc}>
      <Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen={open} />
      <Nieuweactiviteitblad
        datum={open ? DAG : null}
        tijd="9:15"
        klasId="klas-1"
        themaIds={["thema-1"]}
        planBezig={false}
        planFout={geenToegangZin(fout)}
        planGeweigerd={isGeenToegang(fout)}
        onPlan={onPlan}
        onSluit={vi.fn()}
      />
    </QueryClientProvider>
  );
}

const dagregel = () => t("tijdraster.enOpDitUur", { dag: volleDag(DAG), tijd: "9:15" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Nieuweactiviteitblad na een weigering", () => {
  it("meldt een geweigerde planning in het blad, zonder Bewaren of dagregel, en de agenda zet er geen melding achter", () => {
    const qc = client(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
    const { rerender } = render(<Agenda qc={qc} open fout={null} />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
    expect(screen.getByRole("button", { name: t("themabeheer.bewaar") })).toBeInTheDocument();
    expect(screen.getByText(dagregel())).toBeInTheDocument();

    // The create succeeded and the plan came back 403, with the sheet still open.
    const fout = new ApiError(403, "geweigerd", WEIGERING);
    rerender(<Agenda qc={qc} open fout={fout} />);

    const blad = screen.getByRole("dialog");
    const melding = within(blad).getByRole("alert");
    expect(melding).toHaveTextContent(t("periode.gemaaktNietGepland"));
    expect(melding).toHaveTextContent(WEIGERING);
    // Counted with hidden elements included: the page behind a modal is aria-hidden, and an alert there is the defect.
    expect(screen.getAllByRole("alert", { hidden: true })).toEqual([melding]);
    // The activiteit exists and this klas may not be planned: no second create, and no promise of a plan.
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(blad).queryByText(dagregel())).toBeNull();

    // Closing the sheet does not bring the same refusal back as a second, focus-taking alert on the page.
    rerender(<Agenda qc={qc} open={false} fout={fout} />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
  });

  it("houdt de geweigerde planning als de vernieuwde rechten geen subthema meer laten om in te maken", () => {
    const qc = client(NIEMAND);
    render(<Agenda qc={qc} open fout={new ApiError(403, "geweigerd", WEIGERING)} />);

    const blad = screen.getByRole("dialog");
    expect(within(blad).getByRole("alert")).toHaveTextContent(WEIGERING);
    expect(within(blad).queryByText(t("periode.geenSubthemaOmIn"))).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
  });

  it("meldt een geweigerde aanmaak als enige melding, zonder 'geen subthema', ook als de rechten niets meer laten", async () => {
    const aanvraag = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: WEIGERING }), {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        }),
    );
    vi.stubGlobal("fetch", aanvraag);
    // A leerkracht whose only klas at K3 is this one: directie removes her klastoewijzing before she saves.
    const qc = client(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] }));
    const plan = vi.fn();
    render(<Agenda qc={qc} open fout={null} onPlan={plan} />);

    fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Eikels tellen" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
    await screen.findByRole("alert");

    // The refusal refetches the rights, and they hold nothing at K3 any more.
    // Awaited for one task: TanStack Query hands `setQueryData` to its observers on the next one.
    await act(async () => {
      qc.setQueryData(["ik"], NIEMAND);
      await new Promise((r) => setTimeout(r, 0));
    });

    const blad = screen.getByRole("dialog");
    const meldingen = within(blad).getAllByRole("alert");
    expect(meldingen).toHaveLength(1);
    expect(meldingen[0]).toHaveTextContent(WEIGERING);
    // Nothing was made, so nothing says it was.
    expect(meldingen[0]).not.toHaveTextContent(t("periode.gemaaktNietGepland"));
    expect(within(blad).queryByText(t("periode.geenSubthemaOmIn"))).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(plan).not.toHaveBeenCalled();
    expect(aanvraag).toHaveBeenCalledWith(
      expect.stringContaining("/api/subthemas/sub-1/activiteiten"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
