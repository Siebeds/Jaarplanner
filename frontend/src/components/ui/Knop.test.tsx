import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { AiKnop, Knop } from "./Knop";

describe("Knop", () => {
  it("houdt de focus en negeert een klik zolang hij bezig is (TB-073)", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <Knop type="submit" onClick={onClick}>
          {t("themabeheer.bewaar")}
        </Knop>
      </form>,
    );
    const knop = screen.getByRole("button", { name: t("themabeheer.bewaar") });
    knop.focus();

    rerender(
      <form onSubmit={onSubmit}>
        <Knop type="submit" bezig onClick={onClick}>
          {t("themabeheer.bewaarBezig")}
        </Knop>
      </form>,
    );
    expect(knop).toHaveFocus();
    expect(knop).not.toBeDisabled();
    expect(knop).toHaveAttribute("aria-disabled", "true");
    expect(knop).toHaveAttribute("aria-busy", "true");

    fireEvent.click(knop);
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("zegt in rust niets over bezig zijn", () => {
    render(<Knop>{t("themabeheer.bewaar")}</Knop>);
    const knop = screen.getByRole("button", { name: t("themabeheer.bewaar") });
    expect(knop).not.toHaveAttribute("aria-disabled");
    expect(knop).not.toHaveAttribute("aria-busy");
  });
});

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
    const { rerender } = render(<AiKnop>{t("plan.genereer")}</AiKnop>);
    expect(screen.queryByTestId("ai-vonken")).toBeNull();
    expect(screen.queryByTestId("ai-puntjes")).toBeNull();

    rerender(
      <AiKnop bezig disabled>
        {t("periode.bezig")}
      </AiKnop>,
    );
    expect(screen.getByTestId("ai-vonken")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("ai-puntjes")).toHaveAttribute("aria-hidden", "true");
    // The dots add nothing to what a screen reader hears.
    expect(screen.getByRole("button", { name: t("periode.bezig") })).toBeInTheDocument();
  });

  it("laat een gewone knop zonder ring", () => {
    render(<Knop rang="hoofd">{t("plan.toevoegen")}</Knop>);

    expect(screen.getByRole("button", { name: t("plan.toevoegen") })).not.toHaveClass("knop-ai");
  });
});
