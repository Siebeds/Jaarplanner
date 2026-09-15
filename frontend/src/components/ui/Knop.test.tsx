import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../../i18n";
import { AiKnop, Knop } from "./Knop";

describe("AiKnop", () => {
  it("draagt de AI-ring en het toverstokje, zodat de kleur nooit het enige teken is", () => {
    render(<AiKnop>{t("plan.genereerNu")}</AiKnop>);
    const knop = screen.getByRole("button", { name: t("plan.genereerNu") });

    expect(knop).toHaveClass("knop-ai");
    expect(knop.querySelector("svg")).not.toBeNull();
    expect(knop).not.toHaveAttribute("aria-busy");
  });

  it("meldt zich als bezig zolang de AI werkt", () => {
    render(
      <AiKnop bezig disabled>
        {t("plan.bezig")}
      </AiKnop>,
    );

    expect(screen.getByRole("button", { name: t("plan.bezig") })).toHaveAttribute("aria-busy", "true");
  });

  it("laat een gewone knop zonder ring", () => {
    render(<Knop rang="hoofd">{t("plan.annuleer")}</Knop>);

    expect(screen.getByRole("button", { name: t("plan.annuleer") })).not.toHaveClass("knop-ai");
  });
});
