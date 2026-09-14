import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api";
import type { Ik } from "../../lib/aanmelding";
import { geenToegangZin } from "../../lib/rechten";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { NIEMAND, ikMet, metIk } from "../../test/rechten";
import { Agendamelding } from "./Agendamelding";
import { Nieuweactiviteitblad } from "./Nieuweactiviteitblad";

/**
 * A refused placement from the new-activiteit sheet (E6-02 slice 4, fix round 2, F7; WCAG 4.1.3).
 *
 * The sheet creates the activiteit, then plans it, and stays open when the plan fails. It is a modal dialog, so the
 * failure has to be announced inside it, and the agenda's own alert must not mount behind it: there its one focus is
 * taken back by the focus trap and the page is hidden from a screen reader.
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
function Agenda({ qc, open, fout }: { qc: QueryClient; open: boolean; fout: unknown }): ReactNode {
  return (
    <QueryClientProvider client={qc}>
      <Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen={open} />
      <Nieuweactiviteitblad
        datum={open ? "2026-10-06" : null}
        tijd="9:15"
        klasId="klas-1"
        themaIds={["thema-1"]}
        planBezig={false}
        planFout={geenToegangZin(fout)}
        onPlan={vi.fn()}
        onSluit={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("Nieuweactiviteitblad na een geweigerde planning", () => {
  it("meldt de weigering in het blad, en de agenda zet er geen melding achter", () => {
    const qc = client(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
    const { rerender } = render(<Agenda qc={qc} open fout={null} />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();

    // The create succeeded and the plan came back 403, with the sheet still open.
    const fout = new ApiError(403, "geweigerd", WEIGERING);
    rerender(<Agenda qc={qc} open fout={fout} />);

    const blad = screen.getByRole("dialog");
    const melding = within(blad).getByRole("alert");
    expect(melding).toHaveTextContent(t("periode.gemaaktNietGepland"));
    expect(melding).toHaveTextContent(WEIGERING);
    // Counted with hidden elements included: the page behind a modal is aria-hidden, and an alert there is the defect.
    expect(screen.getAllByRole("alert", { hidden: true })).toEqual([melding]);

    // Closing the sheet does not bring the same refusal back as a second, focus-taking alert on the page.
    rerender(<Agenda qc={qc} open={false} fout={fout} />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
  });

  it("houdt de weigering als de vernieuwde rechten geen subthema meer laten om in te maken", () => {
    // After the refusal the refetched rights hold nothing at K3: there is no form left, and the refusal is what the
    // sheet has to say rather than "no subthema".
    const qc = client(NIEMAND);
    render(<Agenda qc={qc} open fout={new ApiError(403, "geweigerd", WEIGERING)} />);

    const blad = screen.getByRole("dialog");
    expect(within(blad).getByRole("alert")).toHaveTextContent(WEIGERING);
    expect(within(blad).queryByText(t("periode.geenSubthemaOmIn"))).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
  });
});
