import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../lib/aanmelding";
import type { KlasWeergave, SchooljaarSamenvatting } from "../lib/types";
import { t } from "../i18n";
import { ADMIN, NIEMAND, ikMet, metIk } from "../test/rechten";
import { Klaskiezer } from "./Klaskiezer";

/**
 * The klaskiezer's jaarfase field writes `PUT /api/klassen/{id}`, the §3 "beheren" row: admin only (E6-02). Every
 * gebruiker still picks a schooljaar and a klas here, which is a context and not a write.
 *
 * Since FB-013 the server offers only the klassen a gebruiker may read, so an empty list is said for who is looking.
 */

const JAAR: SchooljaarSamenvatting = { id: "jaar-1", naam: "2026-2027", start: "2026-09-01", eind: "2027-06-30" };
const KLAS: KlasWeergave = {
  id: "klas-1",
  schooljaarId: JAAR.id,
  naam: "Kleuters blauw",
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: ["JK", "K2", "K3"],
  jaarfase: null,
  mogelijkeJaarfasen: ["JK", "K2", "K3"],
  kanLeerlingenHebben: false,
};

/** What the mocked selection offers; each test sets it. */
const selectie = vi.hoisted(() => ({ klassen: [] as KlasWeergave[], laadt: false, fout: false }));

vi.mock("../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: selectie.klassen[0] ?? null,
    schooljaar: JAAR,
    schooljaren: [JAAR],
    klassen: selectie.klassen,
    laadt: selectie.laadt,
    fout: selectie.fout,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

beforeEach(() => {
  selectie.klassen = [KLAS];
  selectie.laadt = false;
  selectie.fout = false;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open(ik: Ik) {
  render(
    <QueryClientProvider client={metIk(new QueryClient(), ik)}>
      <Klaskiezer />
    </QueryClientProvider>,
  );
  const knop = selectie.klassen.length > 0 ? KLAS.naam : t("context.geenKlas");
  fireEvent.click(screen.getByRole("button", { name: knop }));
  return screen.getByRole("dialog");
}

describe("Klaskiezer", () => {
  it("laat een leerkracht van de klas kiezen, maar niet de leeftijd van de klas instellen", () => {
    const blad = open(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: [KLAS.id] }));

    expect(within(blad).getByRole("combobox", { name: t("context.klas") })).toBeInTheDocument();
    expect(within(blad).queryByRole("combobox", { name: t("context.jaarFase") })).toBeNull();
  });

  it("laat admin de leeftijd instellen", () => {
    const blad = open(ADMIN);

    expect(within(blad).getByRole("combobox", { name: t("context.jaarFase") })).toBeInTheDocument();
  });

  describe("zonder klas in de lijst (FB-013)", () => {
    beforeEach(() => {
      selectie.klassen = [];
    });

    it("zegt een gebruiker zonder enig recht waarom er niets te kiezen is", () => {
      const blad = open(NIEMAND);

      expect(within(blad).getByText(t("context.geenInzage"))).toBeInTheDocument();
      expect(within(blad).queryByText(t("context.geenKlassen"))).toBeNull();
    });

    it("zegt een leerkracht niet dat het schooljaar geen klassen heeft, alleen geen die ze mag inkijken", () => {
      const blad = open(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["andere-klas"] }));

      expect(within(blad).getByText(t("context.geenKlassenInzage"))).toBeInTheDocument();
      expect(within(blad).queryByText(t("context.geenKlassen"))).toBeNull();
    });

    it("zegt niets over klassen of rechten zolang de lijst laadt, of als ze niet laadde", () => {
      selectie.laadt = true;
      const laden = open(NIEMAND);
      expect(within(laden).getByText(t("context.klassenLaden"))).toBeInTheDocument();
      expect(within(laden).queryByText(t("context.geenInzage"))).toBeNull();
    });

    it("zegt dat de klassen niet laadden, en niet dat er geen zijn", () => {
      selectie.fout = true;
      const fout = open(ikMet({ leerkrachtLeeftijden: ["K3"] }));
      expect(within(fout).getByText(t("context.klassenLaadFout"))).toBeInTheDocument();
      expect(within(fout).queryByText(t("context.geenKlassenInzage"))).toBeNull();
    });

    it.each([
      ["admin", ADMIN],
      ["themabeheer", ikMet({ heeftThemabeheer: true })],
    ])("zegt %s dat het schooljaar nog geen klassen heeft", (_, ik) => {
      const blad = open(ik);

      expect(within(blad).getByText(t("context.geenKlassen"))).toBeInTheDocument();
    });
  });
});
