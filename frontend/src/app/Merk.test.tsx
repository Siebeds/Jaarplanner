import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../i18n";
import { Merk } from "./Merk";

function bronnen(container: HTMLElement) {
  return Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
}

describe("Merk (FB-083)", () => {
  it("names the app Vizier", () => {
    expect(t("app.naam")).toBe("Vizier");
  });

  it("shows the horizontal logo by fixed name, in both colourways, and the name as text", () => {
    const { container } = render(<Merk />);
    expect(bronnen(container)).toEqual(["/merk/merk-horizontaal.svg", "/merk/merk-horizontaal-donker.svg"]);
    expect(screen.getByText("Vizier")).toBeInTheDocument();
  });

  it("keeps the mark alone in the rail, and the name for a screen reader", () => {
    const { container } = render(<Merk compact />);
    expect(bronnen(container)).toEqual(["/merk/merk-beeldmerk.svg", "/merk/merk-beeldmerk-donker.svg"]);
    expect(screen.getByText("Vizier")).toHaveClass("sr-only");
  });

  it("hides the images from assistive technology, so the name is read once", () => {
    const { container } = render(<Merk />);
    for (const img of container.querySelectorAll("img")) {
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveAttribute("aria-hidden", "true");
    }
  });
});
