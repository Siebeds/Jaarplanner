import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Segment } from "./Segment";

const opties = [
  { waarde: "maand", label: "Maand" },
  { waarde: "werkweek", label: "Werkweek" },
] as const;

/**
 * Each label reserves its semibold width with an ::after that repeats the label. That copy must
 * stay out of the accessible name and out of the text, or every option would read twice (FB-086).
 */
describe("Segment", () => {
  it("names each option once and marks the chosen one", () => {
    render(<Segment label="Weergave" waarde="werkweek" opties={[...opties]} onKies={() => {}} />);

    expect(screen.getByRole("radio", { name: "Werkweek" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Maand" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByText("Werkweek")).toHaveLength(1);
  });

  it("reports the option pressed", () => {
    const onKies = vi.fn();
    render(<Segment label="Weergave" waarde="werkweek" opties={[...opties]} onKies={onKies} />);

    fireEvent.click(screen.getByRole("radio", { name: "Maand" }));
    expect(onKies).toHaveBeenCalledWith("maand");
  });
});
