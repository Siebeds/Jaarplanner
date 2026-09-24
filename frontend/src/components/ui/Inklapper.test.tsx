import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Inklapper } from "./Inklapper";

function Vouw(props: { standaardOpen?: boolean }) {
  return (
    <Inklapper.Root standaardOpen={props.standaardOpen}>
      <Inklapper.Knop>
        <Inklapper.Pijl />
        Groep
      </Inklapper.Knop>
      <Inklapper.Inhoud>Inhoud van de groep</Inklapper.Inhoud>
    </Inklapper.Root>
  );
}

describe("Inklapper (TB-075)", () => {
  it("meldt dicht, en verwijst naar niets zolang er niets staat", () => {
    render(<Vouw />);
    const knop = screen.getByRole("button", { name: "Groep" });
    expect(knop).toHaveAttribute("type", "button");
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(knop).not.toHaveAttribute("aria-controls");
    expect(screen.queryByText("Inhoud van de groep")).not.toBeInTheDocument();
  });

  it("opent op een klik, en aria-controls wijst dan naar de inhoud", () => {
    render(<Vouw />);
    const knop = screen.getByRole("button", { name: "Groep" });
    fireEvent.click(knop);
    expect(knop).toHaveAttribute("aria-expanded", "true");
    const inhoud = screen.getByText("Inhoud van de groep");
    expect(knop.getAttribute("aria-controls")).toBe(inhoud.id);
    fireEvent.click(knop);
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inhoud van de groep")).not.toBeInTheDocument();
  });

  it("draait de pijl in één richting: naar rechts dicht, naar onder open", () => {
    const { container } = render(<Vouw />);
    const pijl = container.querySelector("svg")!;
    expect(pijl.getAttribute("class")).toContain("-rotate-90");
    fireEvent.click(screen.getByRole("button", { name: "Groep" }));
    expect(pijl.getAttribute("class")).not.toContain("rotate");
  });

  it("begint open met standaardOpen", () => {
    render(<Vouw standaardOpen />);
    expect(screen.getByRole("button", { name: "Groep" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Inhoud van de groep")).toBeInTheDocument();
  });

  it("volgt een gegeven open en meldt de wissel aan de aanroeper", () => {
    const onOpenChange = vi.fn();
    function Gestuurd() {
      const [open, setOpen] = useState(false);
      return (
        <Inklapper.Root
          open={open}
          onOpenChange={(waarde) => {
            onOpenChange(waarde);
            setOpen(waarde);
          }}
        >
          <Inklapper.Knop>Groep</Inklapper.Knop>
          <Inklapper.Inhoud als="ul">
            <li>Rij</li>
          </Inklapper.Inhoud>
        </Inklapper.Root>
      );
    }
    render(<Gestuurd />);
    fireEvent.click(screen.getByRole("button", { name: "Groep" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("toont een inhoud met zichtbaar ook dicht, zonder open te melden", () => {
    render(
      <Inklapper.Root>
        <Inklapper.Knop>Groep</Inklapper.Knop>
        <Inklapper.Inhoud zichtbaar>Gevonden</Inklapper.Inhoud>
      </Inklapper.Root>,
    );
    expect(screen.getByText("Gevonden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Groep" })).toHaveAttribute("aria-expanded", "false");
  });
});
