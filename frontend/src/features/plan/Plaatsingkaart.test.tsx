import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Themaplaatsing } from "../../lib/types";
import { t } from "../../i18n";
import { periode } from "../../lib/datum";
import { Plaatsingkaart } from "./Plaatsingkaart";

/**
 * A placed thema with its own days (ADR-0049), for a gebruiker who may plan this klas and for one who may only read it
 * (E6-02, ADR-0030 §3, R7).
 */

const PLAATSING: Themaplaatsing = {
  id: "p-1",
  themaId: "t-1",
  themaNaam: "Herfst",
  van: "2026-10-19",
  tot: "2026-10-30",
  isVervallen: false,
  status: "Voorgesteld",
  aiMotivatie: "Past bij de herfst.",
  vergrendeld: true,
  doelcodes: [],
  duurWeken: 4,
  reeks: {
    deel: 1,
    aantalDelen: 2,
    reeksVan: "2026-10-19",
    reeksTot: "2026-11-20",
    weken: 4,
    eindeAangepast: false,
    stoptBijEindeSchooljaar: false,
  },
};

const TWEEDE_DEEL: Themaplaatsing = {
  ...PLAATSING,
  id: "p-2",
  van: "2026-11-09",
  tot: "2026-11-20",
  reeks: { ...PLAATSING.reeks!, deel: 2 },
};

function toon(overschrijf: Partial<Parameters<typeof Plaatsingkaart>[0]> = {}) {
  const handlers = {
    onAanvaard: vi.fn(),
    onWeiger: vi.fn(),
    onVergrendel: vi.fn(),
    onBewaarDatums: vi.fn(),
    onVerschuif: vi.fn(),
    onVerwijder: vi.fn(),
  };
  render(
    <MemoryRouter>
      <Plaatsingkaart
        plaatsing={PLAATSING}
        plaatsingen={[PLAATSING, TWEEDE_DEEL]}
        eersteSchooldag="2026-09-01"
        laatsteSchooldag="2027-06-30"
        magBewerken
        bezig={false}
        {...handlers}
        {...overschrijf}
      />
    </MemoryRouter>,
  );
  return handlers;
}

describe("Plaatsingkaart", () => {
  it("toont wie deze klas niet mag plannen de plaatsing zonder één knop, en dat ze vergrendeld is", () => {
    toon({ magBewerken: false });

    expect(screen.getByRole("heading", { name: "Herfst" })).toBeInTheDocument();
    expect(screen.getByText("Past bij de herfst.")).toBeInTheDocument();
    expect(screen.getByText(t("plan.vergrendeld"))).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText(t("plan.begindatum"))).toBeNull();
    expect(screen.getByRole("link", { name: /Open in de agenda/ })).toHaveAttribute("href", "/agenda/dag/2026-10-19");
  });

  it("noemt het deel en de andere delen van het thema", () => {
    toon();

    expect(screen.getByText(/deel 1\/2/)).toBeInTheDocument();
    expect(screen.getByText(t("plan.andereDelen"))).toBeInTheDocument();
    expect(screen.getByText(periode("2026-11-09", "2026-11-20"))).toBeInTheDocument();
  });

  it("bewaart nieuwe datums pas met de knop, en niet zolang ze ongewijzigd zijn", () => {
    const { onBewaarDatums } = toon();
    const bewaar = screen.getByRole("button", { name: t("plan.bewaarDatums") });
    expect(bewaar).toBeDisabled();

    fireEvent.change(screen.getByLabelText(t("plan.einddatum")), { target: { value: "2026-10-23" } });
    expect(bewaar).toBeEnabled();
    fireEvent.click(bewaar);

    expect(onBewaarDatums).toHaveBeenCalledWith("2026-10-19", "2026-10-23");
  });

  it("weigert een einde voor het begin", () => {
    toon();
    fireEvent.change(screen.getByLabelText(t("plan.einddatum")), { target: { value: "2026-10-01" } });

    expect(screen.getByRole("button", { name: t("plan.bewaarDatums") })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(t("tijdraster.eindeVoorBegin"));
  });

  it("laat een vervallen plaatsing ook met dezelfde datums opnieuw bewaren", () => {
    const { onBewaarDatums } = toon({ plaatsing: { ...PLAATSING, isVervallen: true } });

    expect(screen.getByText(t("plan.vervallen"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("plan.bewaarDatums") }));
    expect(onBewaarDatums).toHaveBeenCalledWith("2026-10-19", "2026-10-30");
  });

  it("verschuift een week vroeger of later, met het toetsenbord bereikbaar", () => {
    const { onVerschuif } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("plan.weekVroeger") }));
    fireEvent.click(screen.getByRole("button", { name: t("plan.weekLater") }));

    expect(onVerschuif).toHaveBeenNthCalledWith(1, "2026-10-12");
    expect(onVerschuif).toHaveBeenNthCalledWith(2, "2026-10-26");
  });

  it("zegt dat weigeren het voorstel uit het plan haalt, en geeft aanvaarden, slot en verwijderen", () => {
    const { onAanvaard, onWeiger, onVergrendel, onVerwijder } = toon();

    expect(screen.getByText(t("plan.weigerUitleg"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("plan.aanvaard") }));
    fireEvent.click(screen.getByRole("button", { name: t("plan.weiger") }));
    fireEvent.click(screen.getByRole("button", { name: t("plan.vergrendeld") }));
    fireEvent.click(screen.getByRole("button", { name: t("plan.verwijder") }));

    expect(onAanvaard).toHaveBeenCalled();
    expect(onWeiger).toHaveBeenCalled();
    expect(onVergrendel).toHaveBeenCalledWith(false);
    expect(onVerwijder).toHaveBeenCalled();
  });

  it("biedt geen oordeel meer aan na een beslissing", () => {
    toon({ plaatsing: { ...PLAATSING, status: "Manueel", aiMotivatie: null } });

    expect(screen.queryByRole("button", { name: t("plan.aanvaard") })).toBeNull();
    expect(screen.queryByText(t("plan.weigerUitleg"))).toBeNull();
  });

  it("zegt dat het einde is aangepast, en waarom als het schooljaar eerder eindigt", () => {
    toon({
      plaatsing: {
        ...PLAATSING,
        reeks: { ...PLAATSING.reeks!, eindeAangepast: true, weken: 2, stoptBijEindeSchooljaar: true },
      },
    });

    expect(
      screen.getByText(new RegExp(t("plan.eindeAangepast", { weken: 2, duur: 4 }))),
    ).toHaveTextContent(t("plan.stoptBijEinde"));
  });
});
