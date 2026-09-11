import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KlasWeergave } from "../../lib/types";
import { t } from "../../i18n";
import type { AlgemeneFicheWeergave } from "../algemene-fiches/gegevens";
import { Algemenefichesectie } from "./Algemenefichesectie";

/**
 * The algemene fiches section in Instellingen (owner, 2026-09-11).
 *
 * The two things worth pinning are the ones a browser pass reads least reliably: which sentence a row
 * carries about dekking in which state (the E5-03 rule: a conditional sentence asserts only what its
 * condition guarantees), and which request an unlink actually sends.
 */

vi.mock("../../lib/selectie", () => ({ useActieveSelectie: () => ({ klas: null }) }));

const KLAS = { id: "klas-1", naam: "K3 groen", jaarFasen: ["K3"], jaarfase: "K3" } as KlasWeergave;

function fiche(overrides: Partial<AlgemeneFicheWeergave> = {}): AlgemeneFicheWeergave {
  return {
    id: "fiche-1",
    klasId: KLAS.id,
    naam: "Turnen",
    omschrijving: "in de zaal",
    aantalPlaatsingen: 0,
    doelen: [
      { koppelingId: "k1", leerplandoelCode: "LO-K3-01", doelsoort: "Minimumdoel", jaarFase: "K3", tekst: "loopt en springt" },
    ],
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function antwoord(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function toon(fiches: AlgemeneFicheWeergave[]) {
  fetchMock = vi.fn((_pad: string, init?: RequestInit) =>
    Promise.resolve(antwoord(init?.method && init.method !== "GET" ? fiches[0] : fiches)),
  );
  vi.stubGlobal("fetch", fetchMock);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Algemenefichesectie klassen={[KLAS]} laadt={false} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Algemenefichesectie", () => {
  it("zegt bij een fiche met doelen die nergens in de agenda staat dat de doelen nog niet meetellen", async () => {
    toon([fiche()]);

    expect(await screen.findByText("Turnen")).toBeInTheDocument();
    expect(screen.getByText(t("algemeneFiches.nietIngepland"))).toBeInTheDocument();
    expect(screen.getByText("loopt en springt")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/klassen/klas-1/algemene-fiches");
  });

  it("noemt bij een ingeplande fiche alleen hoe vaak ze in de agenda staat", async () => {
    toon([fiche({ aantalPlaatsingen: 3 })]);

    expect(await screen.findByText(t("algemeneFiches.aantalPlaatsingen", { aantal: 3 }))).toBeInTheDocument();
    expect(screen.queryByText(t("algemeneFiches.nietIngepland"))).not.toBeInTheDocument();
  });

  it("zegt niets over de dekking bij een fiche zonder doelen", async () => {
    toon([fiche({ doelen: [] })]);

    expect(await screen.findByText("Turnen")).toBeInTheDocument();
    expect(screen.queryByText(t("algemeneFiches.nietIngepland"))).not.toBeInTheDocument();
  });

  it("ontkoppelt een doel met een DELETE op die ene koppeling", async () => {
    toon([fiche()]);

    fireEvent.click(await screen.findByRole("button", { name: t("algemeneFiches.ontkoppel", { code: "LO-K3-01" }) }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/algemene-fiches/fiche-1/doelkoppelingen/k1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("biedt het koppelen van een doel aan onder de naam van de fiche", async () => {
    toon([fiche()]);

    expect(
      await screen.findByRole("button", { name: t("algemeneFiches.koppelVoor", { naam: "Turnen" }) }),
    ).toBeInTheDocument();
  });

  it("zegt bij het verwijderen hoeveel doelen er mee verdwijnen", async () => {
    toon([
      fiche({
        doelen: [
          { koppelingId: "k1", leerplandoelCode: "LO-K3-01", doelsoort: "Minimumdoel", jaarFase: "K3", tekst: "a" },
          { koppelingId: "k2", leerplandoelCode: "LO-K3-02", doelsoort: "Gemeenschappelijk", jaarFase: "K3", tekst: "b" },
        ],
      }),
    ]);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.verwijder") }));

    expect(await screen.findByText(t("algemeneFiches.verwijderDoelen", { aantal: 2 }))).toBeInTheDocument();
  });
});
