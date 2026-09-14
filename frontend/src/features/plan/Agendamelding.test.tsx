import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api";
import { Agendamelding } from "./Agendamelding";

/**
 * The agenda's strip after a failed drag or placement (E6-02 slice 4 fix round 1, WCAG 4.1.3). A refusal arrives after
 * its control has gone and below a full-height grid, so it is an alert that takes focus; any other failure keeps the
 * quiet strip it was, since the control that failed is still where the teacher is.
 */
describe("Agendamelding", () => {
  it("toont een weigering als melding die de focus krijgt, en daarmee in beeld komt", async () => {
    render(
      <Agendamelding
        sleepFout={null}
        fouten={[null, new ApiError(403, "geweigerd", "Je hebt geen toegang tot deze actie."), null]}
      />,
    );

    const melding = screen.getByRole("alert");
    expect(melding).toHaveTextContent("Je hebt geen toegang tot deze actie.");
    expect(melding).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(melding).toHaveFocus());
  });

  it("toont een andere fout zoals voorheen, zonder de focus te nemen", () => {
    render(<Agendamelding sleepFout={null} fouten={[new ApiError(400, "dicht", "Deze dag is gesloten.")]} />);

    expect(screen.getByText("Deze dag is gesloten.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("laat een weigering die in de browser besliste voorgaan, en toont niets zonder fout", () => {
    const { rerender, container } = render(
      <Agendamelding sleepFout="Hier kan het niet." fouten={[new ApiError(403, "x", "Je hebt geen toegang tot deze actie.")]} />,
    );
    expect(screen.getByText("Hier kan het niet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<Agendamelding sleepFout={null} fouten={[null, undefined]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
