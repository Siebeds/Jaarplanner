import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api";
import { Agendamelding } from "./Agendamelding";

/**
 * The agenda's strip after a failed drag or placement (E6-02 slice 4 fix rounds 1 and 2, WCAG 4.1.3). A refusal is an
 * alert that takes focus, any other failure keeps the quiet strip it was. The alert mounts only while no agenda sheet
 * is open: a modal sheet would take its focus back and hide it from a screen reader, so a refusal that arrives inside a
 * sheet is that sheet's to announce, and one that arrives with the picker open waits for the picker to close.
 */

const WEIGERING = "Je hebt geen toegang tot deze actie.";
const geweigerd = () => new ApiError(403, "geweigerd", WEIGERING);

describe("Agendamelding", () => {
  it("toont een weigering als melding die de focus krijgt, en daarmee in beeld komt", async () => {
    render(<Agendamelding sleepFout={null} fouten={[null, geweigerd(), null]} kiezerOpen={false} bladOpen={false} />);

    const melding = screen.getByRole("alert");
    expect(melding).toHaveTextContent(WEIGERING);
    expect(melding).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(melding).toHaveFocus());
  });

  it("toont een andere fout zoals voorheen, zonder de focus te nemen", () => {
    render(
      <Agendamelding
        sleepFout={null}
        fouten={[new ApiError(400, "dicht", "Deze dag is gesloten.")]}
        kiezerOpen={false}
        bladOpen={false}
      />,
    );

    expect(screen.getByText("Deze dag is gesloten.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("laat een weigering die in de browser besliste voorgaan, en toont niets zonder fout", () => {
    const { rerender, container } = render(
      <Agendamelding sleepFout="Hier kan het niet." fouten={[geweigerd()]} kiezerOpen={false} bladOpen={false} />,
    );
    expect(screen.getByText("Hier kan het niet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<Agendamelding sleepFout={null} fouten={[null, undefined]} kiezerOpen={false} bladOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("laat een weigering die binnenkomt terwijl een blad open is aan dat blad, ook nadat het sluit", () => {
    const { rerender } = render(<Agendamelding sleepFout={null} fouten={[null]} kiezerOpen={false} bladOpen />);

    const fout = geweigerd();
    rerender(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();

    // The sheet closes; the same refusal is still the mutation's error. The teacher has read it in the sheet.
    rerender(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen={false} />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();

    // A new refusal with no sheet open is the page's again.
    rerender(<Agendamelding sleepFout={null} fouten={[geweigerd()]} kiezerOpen={false} bladOpen={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(WEIGERING);
  });

  it("wacht met een weigering tot de kiezer dicht is, en neemt dan de focus", async () => {
    const fout = geweigerd();
    const { rerender } = render(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen bladOpen={false} />);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();

    rerender(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen={false} />);
    const melding = screen.getByRole("alert");
    await waitFor(() => expect(melding).toHaveFocus());
  });

  it("houdt een melding die er al stond staan als er een blad opent en weer sluit", async () => {
    const fout = geweigerd();
    const { rerender } = render(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen={false} />);
    const melding = screen.getByRole("alert");
    await waitFor(() => expect(melding).toHaveFocus());

    rerender(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen />);
    rerender(<Agendamelding sleepFout={null} fouten={[fout]} kiezerOpen={false} bladOpen={false} />);

    // The same element: not unmounted and mounted again, which would take focus and scroll the page a second time.
    expect(screen.getByRole("alert")).toBe(melding);
  });
});
