import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Doelsoortmerk } from "./Doelsoortmerk";
import { DOELSOORTEN } from "../../lib/types";
import { t } from "../../i18n";

/**
 * Art. XII and WCAG 2.2 AA 1.4.1: colour is never the only carrier of a distinction.
 *
 * The mark is the place that rule is easiest to break, because a coloured square looks finished.
 * This pins that every doelsoort renders BOTH its Op.stap mark and its full name, so deleting
 * either one fails here rather than in an accessibility audit after release.
 */
describe("Doelsoortmerk", () => {
  it.each(DOELSOORTEN)("draagt voor %s een naam naast de kleur", (soort) => {
    render(<Doelsoortmerk soort={soort} />);
    expect(screen.getByText(t(`doelsoort.${soort}`))).toBeInTheDocument();
  });

  it("toont het Op.stap-teken zelf, niet alleen de naam", () => {
    const { container } = render(<Doelsoortmerk soort="Minimumdoel" />);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("MD");
  });
});
