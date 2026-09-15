import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../lib/aanmelding";
import type { KlasWeergave, SchooljaarSamenvatting } from "../lib/types";
import { t } from "../i18n";
import { DIRECTIE, ikMet, metIk } from "../test/rechten";
import { Klaskiezer } from "./Klaskiezer";

/**
 * The klaskiezer's jaarfase field writes `PUT /api/klassen/{id}`, the §3 "beheren" row: directie only (E6-02). Every
 * gebruiker still picks a schooljaar and a klas here, which is a context and not a write.
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

vi.mock("../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: KLAS,
    schooljaar: JAAR,
    schooljaren: [JAAR],
    klassen: [KLAS],
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

beforeEach(() => {
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
  fireEvent.click(screen.getByRole("button", { name: KLAS.naam }));
  return screen.getByRole("dialog");
}

describe("Klaskiezer", () => {
  it("laat een leerkracht van de klas kiezen, maar niet de leeftijd van de klas instellen", () => {
    const blad = open(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: [KLAS.id] }));

    expect(within(blad).getByRole("combobox", { name: t("context.klas") })).toBeInTheDocument();
    expect(within(blad).queryByRole("combobox", { name: t("context.jaarFase") })).toBeNull();
  });

  it("laat directie de leeftijd instellen", () => {
    const blad = open(DIRECTIE);

    expect(within(blad).getByRole("combobox", { name: t("context.jaarFase") })).toBeInTheDocument();
  });
});
