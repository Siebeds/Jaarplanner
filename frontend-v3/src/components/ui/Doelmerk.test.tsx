import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Doelmerk } from "./Doelmerk";
import { t } from "../../i18n";

/**
 * The bug this component exists to prevent: zero rendering as nothing.
 *
 * An activiteitregel used to print its doelcodes when it had some and print nothing when it had
 * none, so the state a teacher scans the list for was the one state the list did not show. The test
 * that matters is therefore the boring one below: at zero there is still text on screen. It is
 * written as an assertion about the rendered words rather than about a class name, because the
 * failure mode is not "the colour is wrong", it is "there is nothing there".
 */
describe("Doelmerk", () => {
  it("zegt het ook als er geen doel is", () => {
    render(<Doelmerk aantal={0} />);
    expect(screen.getByText(t("activiteit.geenDoel"))).toBeInTheDocument();
  });

  it("noemt het aantal in woorden, niet als los cijfer", () => {
    render(<Doelmerk aantal={3} />);
    expect(screen.getByText(t("activiteit.aantalDoelen", { aantal: 3 }))).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("gebruikt het enkelvoud bij één doel", () => {
    render(<Doelmerk aantal={1} />);
    expect(screen.getByText(t("activiteit.eenDoel"))).toBeInTheDocument();
  });

  it("draagt in beide toestanden een woord, niet enkel een kleur", () => {
    // Art. XII / WCAG 1.4.1. The two states differ in hue, in the leading shape and in the words;
    // this pins the third, because it is the only one a screen reader and a greyscale print share.
    const leeg = render(<Doelmerk aantal={0} />);
    expect(leeg.container.textContent?.trim()).not.toBe("");
    leeg.unmount();

    const vol = render(<Doelmerk aantal={2} />);
    expect(vol.container.textContent?.trim()).not.toBe("");
  });
});
