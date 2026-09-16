import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../../i18n";
import { AiKnop, Knop } from "./Knop";

describe("AiKnop", () => {
  it("draagt de AI-ring en het toverstokje, zodat de kleur nooit het enige teken is", () => {
    render(<AiKnop>{t("plan.genereer")}</AiKnop>);
    const knop = screen.getByRole("button", { name: t("plan.genereer") });

    expect(knop).toHaveClass("knop-ai");
    expect(knop.querySelector("svg")).not.toBeNull();
    expect(knop).not.toHaveAttribute("aria-busy");
  });

  it("meldt zich als bezig zolang de AI werkt", () => {
    render(
      <AiKnop bezig disabled>
        {t("periode.bezig")}
      </AiKnop>,
    );

    expect(screen.getByRole("button", { name: t("periode.bezig") })).toHaveAttribute("aria-busy", "true");
  });

  it("toont vonken en puntjes alleen tijdens een run, verborgen voor een schermlezer", () => {
    const { rerender } = render(<AiKnop>{t("plan.genereerNu")}</AiKnop>);
    expect(screen.queryByTestId("ai-vonken")).toBeNull();
    expect(screen.queryByTestId("ai-puntjes")).toBeNull();

    rerender(
      <AiKnop bezig disabled>
        {t("plan.bezig")}
      </AiKnop>,
    );
    expect(screen.getByTestId("ai-vonken")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("ai-puntjes")).toHaveAttribute("aria-hidden", "true");
    // The dots add nothing to what a screen reader hears.
    expect(screen.getByRole("button", { name: t("plan.bezig") })).toBeInTheDocument();
  });

  it("laat een gewone knop zonder ring", () => {
    render(<Knop rang="hoofd">{t("plan.toevoegen")}</Knop>);

    expect(screen.getByRole("button", { name: t("plan.toevoegen") })).not.toHaveClass("knop-ai");
  });
});
