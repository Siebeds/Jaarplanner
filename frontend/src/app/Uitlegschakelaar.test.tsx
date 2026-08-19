import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it } from "vitest";

import { Uitleg, UitlegProvider } from "./uitleg";
import { Uitlegschakelaar } from "./Uitlegschakelaar";

/**
 * E9-01: the one switch that decides whether the screens carry their instructional prose (owner ruling 2026-08-19).
 *
 * The tests below are organised around the two things that would make this feature harmful rather than merely broken:
 * a default that shows the prose anyway, and a switch that also hides an error message.
 *
 * **Known noise, recorded rather than hidden:** every test that clicks emits a React `act(...)` warning naming
 * `UitlegProvider`. The behaviour is correct — persistence, DOM removal, keyboard operation and both axe passes are all
 * asserted below — and the warning's stack carries no test-side frame, only the provider. Ruled out along the way: an
 * impure state updater (the `localStorage` write did sit inside `setIsAan`, which is genuinely wrong and was fixed for
 * its own sake, and the warning survived it), the `jest-axe` call, and the unmount-and-rerender in the reload test.
 * One pre-existing test in this repo emits the same warning, so it is not unique to this file. **Left unresolved on
 * purpose:** it is cosmetic, and chasing it further was worth less than the feature work. Whoever sees it should know
 * it is known, not that it went unnoticed.
 */

function Proefscherm() {
  return (
    <UitlegProvider>
      <Uitlegschakelaar />
      <Uitleg>
        <p>Versleep een thema naar een andere themaperiode.</p>
      </Uitleg>
      {/* Stands for every error, degrade and withheld-figure sentence: outside the wrapper, so unconditional. */}
      <p role="alert">De weergave van dit schooljaar kon niet geladen worden.</p>
    </UitlegProvider>
  );
}

const uitlegTekst = "Versleep een thema naar een andere themaperiode.";
const foutTekst = "De weergave van dit schooljaar kon niet geladen worden.";

beforeEach(() => {
  window.localStorage.clear();
});

describe("Uitlegschakelaar", () => {
  /** The owner's ruling, and the single most important assertion in this file. */
  it("shows no instructional prose to a teacher who has never touched it", () => {
    render(<Proefscherm />);

    expect(screen.queryByText(uitlegTekst)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uitleg tonen" })).toHaveAttribute("aria-pressed", "false");
  });

  /**
   * **The rule that keeps the feature from being harmful.** An error, a degrade or a withheld-figure explanation is
   * not help and must survive the switch in both positions — a teacher must never lose the sentence telling them what
   * went wrong because they switched off clutter.
   */
  it("never hides an error, in either position", async () => {
    const gebruiker = userEvent.setup();
    render(<Proefscherm />);

    expect(screen.getByText(foutTekst)).toBeInTheDocument();

    await gebruiker.click(screen.getByRole("button", { name: "Uitleg tonen" }));
    expect(screen.getByText(foutTekst)).toBeInTheDocument();

    await gebruiker.click(screen.getByRole("button", { name: "Uitleg tonen" }));
    expect(screen.getByText(foutTekst)).toBeInTheDocument();
  });

  it("shows the prose once switched on and hides it again", async () => {
    const gebruiker = userEvent.setup();
    render(<Proefscherm />);
    const schakelaar = screen.getByRole("button", { name: "Uitleg tonen" });

    await gebruiker.click(schakelaar);
    expect(screen.getByText(uitlegTekst)).toBeInTheDocument();
    expect(schakelaar).toHaveAttribute("aria-pressed", "true");

    await gebruiker.click(schakelaar);
    expect(screen.queryByText(uitlegTekst)).not.toBeInTheDocument();
    expect(schakelaar).toHaveAttribute("aria-pressed", "false");
  });

  /**
   * **Renders nothing, rather than hiding.** A `sr-only` or `hidden` paragraph would fix the look and none of the
   * substance for a screen-reader user, who is the half of the audience least able to skim past 113 paragraphs.
   * `queryByText` alone would pass on a visually hidden element, so this asserts the DOM is genuinely free of it.
   */
  it("removes the sentence from the DOM rather than hiding it", () => {
    const { container } = render(<Proefscherm />);

    expect(container.textContent).not.toContain(uitlegTekst);
  });

  it("survives a reload", async () => {
    const gebruiker = userEvent.setup();
    const eerste = render(<Proefscherm />);

    await gebruiker.click(screen.getByRole("button", { name: "Uitleg tonen" }));
    eerste.unmount();

    render(<Proefscherm />);

    expect(screen.getByText(uitlegTekst)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uitleg tonen" })).toHaveAttribute("aria-pressed", "true");
  });

  /**
   * The stored value is the word `"aan"`, so anything else — including a value left by another version of this app —
   * reads as off. The safe direction: an unrecognised preference gives the quiet screen the owner asked for.
   */
  it("treats an unrecognised stored value as off", () => {
    window.localStorage.setItem("jaarplanner.uitleg", "true");

    render(<Proefscherm />);

    expect(screen.queryByText(uitlegTekst)).not.toBeInTheDocument();
  });

  /**
   * A component mounted **outside** the provider gets the default, which is off. Every existing component test mounts a
   * card on its own; this is what lets them keep passing without each wiring up a provider, and it means a forgotten
   * provider yields the quiet screen rather than a crash.
   */
  it("defaults to off outside a provider", () => {
    render(
      <Uitleg>
        <p>{uitlegTekst}</p>
      </Uitleg>,
    );

    expect(screen.queryByText(uitlegTekst)).not.toBeInTheDocument();
  });

  /**
   * **State on a carrier that is not colour** (Art. XII, WCAG 2.2 AA). The check glyph is present exactly when the
   * switch is on, so a teacher who cannot distinguish petrol from paper still reads the state. It is `aria-hidden`,
   * because `aria-pressed` already announces it and a stray glyph would be said twice.
   */
  it("carries its state in a glyph as well as in colour", async () => {
    const gebruiker = userEvent.setup();
    const { container } = render(<Proefscherm />);

    expect(container.textContent).not.toContain("✓");

    await gebruiker.click(screen.getByRole("button", { name: "Uitleg tonen" }));

    expect(container.textContent).toContain("✓");
    // Still exactly the visible label, so Label in Name (SC 2.5.3) holds in both positions.
    expect(screen.getByRole("button", { name: "Uitleg tonen" })).toBeInTheDocument();
  });

  it("is reachable and operable by keyboard", async () => {
    const gebruiker = userEvent.setup();
    render(<Proefscherm />);

    await gebruiker.tab();
    expect(screen.getByRole("button", { name: "Uitleg tonen" })).toHaveFocus();

    await gebruiker.keyboard("{Enter}");
    expect(screen.getByText(uitlegTekst)).toBeInTheDocument();
  });

  it("has no axe violations in either position", async () => {
    const gebruiker = userEvent.setup();
    const { container } = render(<Proefscherm />);

    expect(await axe(container)).toHaveNoViolations();

    await gebruiker.click(screen.getByRole("button", { name: "Uitleg tonen" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
