import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { t } from "../../i18n";
import { ADMIN, ikMet, metIk } from "../../test/rechten";
import { ImportScherm } from "./ImportScherm";
import { Schoolcontentimport } from "./Schoolcontentimport";
import type { SchoolcontentImportAntwoord } from "./types";

/**
 * Inladen gates its sections, not its route (E6-02; the 2026-08-03 ruling): the school's thema's for admin and
 * themabeheer (R9), Op.stap for admin (R3). And the FR-1 import's option to delete human decisions is admin's
 * alone (R35), shown only where a preview has counted what it would delete.
 */

function toonScherm(ik: Ik, adres = "/inladen") {
  render(
    <QueryClientProvider client={metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik)}>
      <MemoryRouter initialEntries={[adres]}>
        <ImportScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // The Op.stap section asks where the import stands; it may wait, since these tests are about which section shows.
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImportScherm: de secties per recht", () => {
  it("zegt wie geen van beide mag dat er niets in te laden valt, zonder een sectie", () => {
    toonScherm(ikMet({ leerkrachtLeeftijden: ["K3"], hoofdleerkrachtLeeftijden: ["K3"] }));

    expect(screen.getByText(t("importeren.geenRecht"))).toBeInTheDocument();
    expect(screen.queryByText(t("importeren.school.titel"))).toBeNull();
    expect(screen.queryByText(t("importeren.kov.titel"))).toBeNull();
  });

  it("toont themabeheer alleen de thema's, zonder schakelaar, ook als het adres om Op.stap vraagt", () => {
    toonScherm(ikMet({ heeftThemabeheer: true }), "/inladen?bron=opstap");

    expect(screen.getByText(t("importeren.school.titel"))).toBeInTheDocument();
    expect(screen.queryByText(t("importeren.kov.titel"))).toBeNull();
    expect(screen.queryByText(t("importeren.opstap.kort"))).toBeNull();
  });

  // Fix round 1, F3: a failed /api/ik proves nothing about rights, so it may not say the gebruiker lacks one.
  it("zegt niets over rechten als /api/ik niet antwoordt, en toont geen sectie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/inladen"]}>
          <ImportScherm />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await vi.waitFor(() => expect(client.getQueryState(["ik"])?.status).toBe("error"));
    expect(screen.queryByText(t("importeren.geenRecht"))).toBeNull();
    expect(screen.queryByText(t("importeren.school.titel"))).toBeNull();
  });

  it("geeft admin beide secties en de schakelaar, en opent Op.stap waar het adres dat vraagt", () => {
    toonScherm(ADMIN, "/inladen?bron=opstap");

    expect(screen.getByText(t("importeren.kov.titel"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.opstap.kort"))).toBeInTheDocument();
    expect(screen.getByText(t("importeren.school.kort"))).toBeInTheDocument();
  });
});

describe("Schoolcontentimport: menselijke beslissingen verwijderen (R35)", () => {
  const VOORBEELD: SchoolcontentImportAntwoord = {
    isBestandGeldig: true,
    isVolledigVerwerkt: true,
    problemen: [],
    toegepast: false,
    diff: {
      modus: "Bijwerken",
      themas: [{ naam: "Herfst", soort: "Bijgewerkt" }],
      subthemas: [],
      activiteiten: [],
      bedreigdeBeslissingen: [{ niveau: "Subdoel", contentNaam: "Bladeren", leerplandoelCode: "WO-2", status: "Manueel" }],
      overgeslagen: false,
      opmerkingen: [],
      isLeeg: false,
      vereistReview: true,
    },
  };

  async function toonVoorbeeld(ik: Ik) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(VOORBEELD), { status: 200, headers: { "Content-Type": "application/json" } })),
    );
    render(
      <QueryClientProvider client={metIk(new QueryClient(), ik)}>
        <Schoolcontentimport />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(t("importeren.kiesBestand")), {
      target: { files: [new File(["x"], "themas.xlsx")] },
    });
    fireEvent.click(screen.getByRole("button", { name: t("importeren.bekijkVoorbeeld") }));
    // One decided link: the singular, and "vastgelegd" rather than "jij zelf gezet" (fix round 1, F5).
    await screen.findByText(t("importeren.school.bedreigdEen"));
  }

  it("biedt themabeheer het vinkje niet aan, en zegt dat de koppelingen blijven staan", async () => {
    await toonVoorbeeld(ikMet({ heeftThemabeheer: true }));

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(t("importeren.school.blijvenStaan"))).toBeInTheDocument();
  });

  it("biedt admin het vinkje aan", async () => {
    await toonVoorbeeld(ADMIN);

    expect(screen.getByRole("checkbox", { name: t("importeren.school.opruimen") })).toBeInTheDocument();
    expect(screen.queryByText(t("importeren.school.blijvenStaan"))).toBeNull();
  });
});
