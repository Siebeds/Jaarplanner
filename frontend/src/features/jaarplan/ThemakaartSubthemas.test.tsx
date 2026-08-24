import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { KLAS_K3, KLAS_L3, THEMA_HERFST, maakThemaFetchFake } from "../themas/testdata";
import { ThemakaartSubthemas } from "./ThemakaartSubthemas";

/**
 * Pins Fase A of the 2026-08-21 jaarplan redesign (antagonist MAJOR-5, 2026-08-23): the subthema/activiteit
 * doelkoppeling panel opened from a Themakaart. Reuses `themas/testdata`'s stateful fetch fake rather than a
 * new one, because this panel reuses `/themas`'s own hooks and API calls verbatim — a second fake would be a
 * second place the two could drift apart, which is exactly the duplication the antagonist flagged one level up
 * (MAJOR-3) in the component this file tests.
 */

function renderPaneel(themaId: string, klasId: string, fake = maakThemaFetchFake()) {
  vi.stubGlobal("fetch", vi.fn(fake.fetchFake));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <ThemakaartSubthemas themaId={themaId} klasId={klasId} />
    </QueryClientProvider>,
  );

  return { ...fake, container };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemakaartSubthemas — de subthema's van deze klas, op het jaarplanbord", () => {
  it("toont de subthema's van deze klas met hun leeftijd, subdoelen en activiteiten", async () => {
    renderPaneel(THEMA_HERFST, KLAS_L3);

    expect(await screen.findByText("Bladeren")).toBeInTheDocument();
    // The leeftijd is named beside the naam (antagonist MAJOR-2): two subthema's of the same naam at two
    // leeftijden under one thema must not read as one interchangeable row.
    expect(screen.getByText(t("themabeheer.leeftijdWaarde", { leeftijd: "8" }))).toBeInTheDocument();
    expect(screen.getByText("NAT-K3-01")).toBeInTheDocument();
    expect(screen.getByText("Bladkroon maken")).toBeInTheDocument();
    expect(screen.getByText("NAT-K3-02")).toBeInTheDocument();
  });

  it("zegt dat de klas nog geen subthema's heeft onder een thema waar ze niets van bouwde", async () => {
    // K3 derived nothing from Herfst in this fixture (only L3 did).
    renderPaneel(THEMA_HERFST, KLAS_K3);

    expect(await screen.findByText(t("themabeheer.subthemasGeen"))).toBeInTheDocument();
  });

  it("meldt een fout in plaats van te blijven laden wanneer het thema niet gevonden wordt", async () => {
    renderPaneel("onbekend-thema-id", KLAS_L3);

    expect(await screen.findByRole("alert")).toHaveTextContent(t("themabeheer.detailFout"));
  });

  it("koppelt een leerdoel aan een subthema via de doelkiezer, en ontkoppelt het weer", async () => {
    const fake = renderPaneel(THEMA_HERFST, KLAS_L3);
    await screen.findByText("Bladeren");

    fireEvent.click(
      screen.getByRole("button", { name: t("themabeheer.subdoelKoppelAria", { naam: "Bladeren" }) }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "WIS-L3-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "WIS-L3-01",
          waaraan: t("themabeheer.niveauSubthema"),
        }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/subthemas\/.+\/doelkoppelingen$/);
    expect(await screen.findByText("WIS-L3-01")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: t("themabeheer.ontkoppelAria", { code: "NAT-K3-01", waaraan: t("themabeheer.niveauSubthema") }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(2));
    expect(fake.verzoeken[1].pad).toMatch(/^\/api\/subthemas\/.+\/subdoelen\/.+$/);
    expect(fake.verzoeken[1].methode).toBe("DELETE");
    await waitFor(() => expect(screen.queryByText("NAT-K3-01")).not.toBeInTheDocument());
  });

  it("koppelt en ontkoppelt een leerdoel op activiteitniveau", async () => {
    const fake = renderPaneel(THEMA_HERFST, KLAS_L3);
    await screen.findByText("Bladeren");

    fireEvent.click(
      screen.getByRole("button", { name: t("themabeheer.activiteitKoppelAria", { naam: "Bladkroon maken" }) }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "WIS-L3-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "WIS-L3-01",
          waaraan: t("themabeheer.niveauActiviteit"),
        }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/activiteiten\/.+\/doelkoppelingen$/);
    expect(await screen.findByText("WIS-L3-01")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: t("themabeheer.ontkoppelAria", {
          code: "NAT-K3-02",
          waaraan: t("themabeheer.niveauActiviteit"),
        }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(2));
    expect(fake.verzoeken[1].pad).toMatch(/^\/api\/activiteiten\/.+\/doelkoppelingen\/.+$/);
    expect(fake.verzoeken[1].methode).toBe("DELETE");
    await waitFor(() => expect(screen.queryByText("NAT-K3-02")).not.toBeInTheDocument());
  });

  it("heeft geen axe-schendingen met het paneel en de doelkiezer open", async () => {
    const { container } = renderPaneel(THEMA_HERFST, KLAS_L3);
    await screen.findByText("Bladeren");

    fireEvent.click(
      screen.getByRole("button", { name: t("themabeheer.subdoelKoppelAria", { naam: "Bladeren" }) }),
    );
    await screen.findByLabelText(t("themabeheer.doelZoekLabel"));

    expect(await axe(container)).toHaveNoViolations();
  });
});
