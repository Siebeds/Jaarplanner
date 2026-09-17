import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { JaarplanGeneratieResultaat, JaarplanWeergave, Themaplaatsing } from "../../lib/types";
import { Generatiebalk } from "./Generatiebalk";
import { aantalOpenThemas } from "./openvoorstellen";

/** The AI generation of the year plan on the plan screen (TB-053, ADR-0055). */

const VOORSTEL: Themaplaatsing = {
  id: "p-1",
  themaId: "t-1",
  themaNaam: "Herfst",
  van: "2026-10-05",
  tot: "2026-10-30",
  isVervallen: false,
  status: "Voorgesteld",
  aiMotivatie: "Past bij de herfst.",
  vergrendeld: false,
  doelcodes: [],
  duurWeken: 5,
  reeks: {
    deel: 1,
    aantalDelen: 2,
    reeksVan: "2026-10-05",
    reeksTot: "2026-11-13",
    weken: 5,
    eindeAangepast: false,
    stoptBijEindeSchooljaar: false,
  },
};

const TWEEDE_DEEL: Themaplaatsing = {
  ...VOORSTEL,
  id: "p-2",
  van: "2026-11-09",
  tot: "2026-11-13",
  reeks: { ...VOORSTEL.reeks!, deel: 2 },
};

const MANUEEL: Themaplaatsing = { ...VOORSTEL, id: "p-3", themaId: "t-2", status: "Manueel", aiMotivatie: null, reeks: null };
const VAST: Themaplaatsing = { ...VOORSTEL, id: "p-4", themaId: "t-3", vergrendeld: true, reeks: null };

function resultaat(overschrijf: Partial<JaarplanGeneratieResultaat> = {}): JaarplanGeneratieResultaat {
  return {
    isGeslaagd: true,
    aantalNieuw: 2,
    aantalBehouden: 0,
    aantalVervangen: 0,
    nietGeplaatst: [],
    jaarplan: {} as JaarplanWeergave,
    ...overschrijf,
  };
}

function toon(props: Partial<Parameters<typeof Generatiebalk>[0]> = {}) {
  const onGenereer = vi.fn();
  render(
    <Generatiebalk plaatsingen={[]} bezig={false} resultaat={null} fout={null} onGenereer={onGenereer} {...props} />,
  );
  return onGenereer;
}

describe("Generatiebalk", () => {
  it("genereert meteen wanneer er geen open voorstel is", () => {
    const onGenereer = toon({ plaatsingen: [MANUEEL, VAST] });

    fireEvent.click(screen.getByRole("button", { name: t("plan.genereer") }));

    expect(onGenereer).toHaveBeenCalledOnce();
    expect(screen.queryByText(t("plan.generatieVraag"))).toBeNull();
  });

  it("vraagt eerst wanneer open voorstellen zouden verdwijnen, en telt een gesplitst thema één keer", () => {
    const onGenereer = toon({ plaatsingen: [VOORSTEL, TWEEDE_DEEL, MANUEEL, VAST] });

    fireEvent.click(screen.getByRole("button", { name: t("plan.genereer") }));

    expect(onGenereer).not.toHaveBeenCalled();
    expect(screen.getByText(t("plan.generatieVraag"))).toBeTruthy();
    expect(screen.getByText(t("plan.generatieGevolgEen"))).toBeTruthy();

    const knoppen = screen.getAllByRole("button", { name: t("plan.genereer") });
    fireEvent.click(knoppen[knoppen.length - 1]);
    expect(onGenereer).toHaveBeenCalledOnce();
  });

  it("annuleren genereert niet", () => {
    const onGenereer = toon({ plaatsingen: [VOORSTEL] });

    fireEvent.click(screen.getByRole("button", { name: t("plan.genereer") }));
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.annuleer") }));

    expect(onGenereer).not.toHaveBeenCalled();
  });

  it("zegt hoeveel thema's voorgesteld zijn en welke niet pasten, zonder de overgeslagen voorstellen te noemen", () => {
    toon({
      resultaat: resultaat({
        aantalNieuw: 2,
        nietGeplaatst: [
          { themaNaam: "Water", reden: "GeenPlaats" },
          { themaNaam: "Winter", reden: "GeenLesweek" },
          { themaNaam: "Ruimte", reden: "OnbekendThema" },
          { themaNaam: "Herfst", reden: "AlGepland" },
        ],
      }),
    });

    const regel = screen.getByText(new RegExp(t("plan.generatieNieuw", { aantal: 2 })));
    expect(regel.textContent).toBe(
      `${t("plan.generatieNieuw", { aantal: 2 })} ${t("plan.generatiePasteNiet", { themas: "Water, Winter" })}`,
    );
    expect(regel.textContent).not.toContain("Ruimte");
  });

  it("zegt het wanneer niets voorgesteld is", () => {
    toon({ resultaat: resultaat({ aantalNieuw: 0 }) });

    expect(screen.getByText(t("plan.generatieGeenNieuw"))).toBeTruthy();
  });

  it("toont de fout en geen rapport", () => {
    toon({ resultaat: resultaat(), fout: "Het antwoord van de AI was onbruikbaar." });

    expect(screen.getByText("Het antwoord van de AI was onbruikbaar.")).toBeTruthy();
    expect(screen.queryByText(t("plan.generatieNieuw", { aantal: 2 }))).toBeNull();
  });

  it("is uitgeschakeld en zegt dat het bezig is terwijl het genereert", () => {
    toon({ bezig: true });

    const knop = screen.getByRole("button", { name: t("plan.genereerBezig") });
    expect((knop as HTMLButtonElement).disabled).toBe(true);
    expect(knop.getAttribute("aria-busy")).toBe("true");
  });
});

describe("aantalOpenThemas", () => {
  it("telt open, niet vergrendelde voorstellen per thema", () => {
    expect(aantalOpenThemas([VOORSTEL, TWEEDE_DEEL, MANUEEL, VAST])).toBe(1);
    expect(aantalOpenThemas([])).toBe(0);
  });
});
