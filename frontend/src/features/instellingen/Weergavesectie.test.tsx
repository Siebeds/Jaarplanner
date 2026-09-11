import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Weergavesectie } from "./Weergavesectie";
import { useWeergave } from "../../state/weergave";
import { t } from "../../i18n";

beforeEach(() => {
  localStorage.clear();
  useWeergave.setState({ keuze: "systeem" });
});

describe("Weergavesectie", () => {
  it("staat standaard op het toestel", () => {
    render(<Weergavesectie />);
    expect(screen.getByRole("radio", { name: t("weergave.systeem") })).toHaveAttribute("aria-checked", "true");
  });

  it("zet de app donker wanneer de leerkracht Donker kiest", () => {
    render(<Weergavesectie />);
    fireEvent.click(screen.getByRole("radio", { name: t("weergave.donker") }));

    expect(screen.getByRole("radio", { name: t("weergave.donker") })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: t("weergave.systeem") })).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.dataset.weergave).toBe("donker");
  });
});
