import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Themastroken } from "./Themastroken";
import type { Themavak } from "./themavakken";
import type { Subthemaruimte } from "./subthemareeksen";
import { t } from "../../i18n";
import { themapaginaPad } from "../themas/themapagina";

/**
 * The thema band as a pointer's shortcut to the thema's page (FB-037, ADR-0042): which thema it opens, and that it opens
 * nothing where it names none.
 */
const vak = (themas: Themavak["themas"]): Themavak => ({
  plaatsingId: "p1",
  van: "2026-09-01",
  tot: "2026-10-01",
  themas,
});

// 16 september 2026 is a Wednesday in the middle of the period, where a wide row drops the name.
const toon = (v: Themavak, datum = "2026-09-16") =>
  render(
    <MemoryRouter>
      <Themastroken vak={v} datum={datum} />
    </MemoryRouter>,
  );

describe("Themastroken (FB-037, FB-039)", () => {
  const herfst = () => vak([{ id: "t-herfst", naam: "De herfst" }]);
  const naam = () => t("periode.naarThema", { naam: "De herfst" });

  it("opent de themapagina ook midden in de periode, daar zonder tabstop en buiten de toegankelijkheidsboom", () => {
    const { container } = toon(herfst());

    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", themapaginaPad("t-herfst"));
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).toHaveAttribute("aria-hidden", "true");
    // The band that prints the name is the keyboard's stop; the day's own button speaks the thema.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("maakt de band die de naam draagt een tabstop, genoemd naar waar hij naartoe gaat", () => {
    // 14 september 2026 is a Monday: the head of the row prints the name.
    toon(herfst(), "2026-09-14");

    const link = screen.getByRole("link", { name: naam() });
    expect(link).toHaveAttribute("href", themapaginaPad("t-herfst"));
    expect(link).not.toHaveAttribute("tabindex");
    link.focus();
    expect(link).toHaveFocus();
  });

  it("is een tabstop op elke dag waar geen buur de naam draagt", () => {
    render(
      <MemoryRouter>
        <Themastroken vak={herfst()} datum="2026-09-16" altijdNaam />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: naam() })).toBeInTheDocument();
  });

  it("geeft de band een doel van 24 pixels (SC 2.5.8)", () => {
    const { container } = toon(herfst());
    // jsdom has no layout, so this pins the class that sets the height; the browser pass measures it.
    expect(container.querySelector("a")).toHaveClass("h-6");
  });

  it("opent de themapagina", () => {
    render(
      <MemoryRouter initialEntries={["/agenda"]}>
        <Routes>
          <Route path="/agenda" element={<Themastroken vak={herfst()} datum="2026-09-01" />} />
          <Route path="/themas/:id" element={<p>themapagina</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: naam() }));
    expect(screen.getByText("themapagina")).toBeInTheDocument();
  });

  it("opent met twee thema's in de periode het thema dat het label noemt", () => {
    const { container } = toon(
      vak([
        { id: "t-herfst", naam: "De herfst" },
        { id: "t-sint", naam: "Sint" },
      ]),
      "2026-09-01",
    );

    expect(screen.getByText(t("periode.themaMeer", { naam: "De herfst", aantal: 1 }))).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", themapaginaPad("t-herfst"));
  });

  it("opent niets in een periode zonder thema", () => {
    const { container } = toon(vak([]), "2026-09-01");

    expect(screen.getByText(t("periode.geenThema"))).toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("Themastroken: subthema inplannen (FB-087)", () => {
  const herfst = () => vak([{ id: "t-herfst", naam: "De herfst" }]);
  const naam = t("periode.planSubthemaIn", { naam: "De herfst" });
  const toonMet = (datum: string, onPlanSubthema?: (id: string) => void, v = herfst()) =>
    render(
      <MemoryRouter>
        <Themastroken vak={v} datum={datum} dicht onPlanSubthema={onPlanSubthema} />
      </MemoryRouter>,
    );

  it("zet de knop op de band die de naam draagt, en geeft de plaatsing door", () => {
    const geklikt: string[] = [];
    // 14 september 2026 is a Monday: the head of the row prints the name.
    toonMet("2026-09-14", (id) => geklikt.push(id));

    fireEvent.click(screen.getByRole("button", { name: naam }));
    expect(geklikt).toEqual(["p1"]);
  });

  it("zet geen knop midden in de rij, waar de naam wegvalt", () => {
    toonMet("2026-09-16", () => {});
    expect(screen.queryByRole("button", { name: naam })).toBeNull();
  });

  it("zet geen knop zonder callback, en geen in een periode zonder thema", () => {
    toonMet("2026-09-14");
    expect(screen.queryByRole("button")).toBeNull();
    toonMet("2026-09-01", () => {}, vak([]));
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Themastroken: geen knop naast een lopend subthema (FB-087)", () => {
  const herfst = () => vak([{ id: "t-herfst", naam: "De herfst" }]);
  const naam = t("periode.planSubthemaIn", { naam: "De herfst" });
  const toonMet = (datum: string, ruimte: Subthemaruimte) =>
    render(
      <MemoryRouter>
        <Themastroken vak={herfst()} datum={datum} dicht onPlanSubthema={() => {}} ruimte={ruimte} />
      </MemoryRouter>,
    );

  it("zet geen knop op de band met de naam als er die dag al een subthema loopt", () => {
    // 14 september 2026 is a Monday: the band prints the name.
    toonMet("2026-09-14", "geen");
    expect(screen.queryByRole("button", { name: naam })).toBeNull();
  });

  it("zet de knop midden in de rij waar een vrije strook begint", () => {
    toonMet("2026-09-16", "begint");
    expect(screen.getByRole("button", { name: naam })).toBeInTheDocument();
  });

  it("zet geen tweede knop verder in dezelfde vrije strook", () => {
    toonMet("2026-09-17", "vrij");
    expect(screen.queryByRole("button", { name: naam })).toBeNull();
  });
});
