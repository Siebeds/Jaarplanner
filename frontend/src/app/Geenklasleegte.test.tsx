import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../lib/aanmelding";
import { t } from "../i18n";
import { DIRECTIE, NIEMAND, ikMet, metIk } from "../test/rechten";
import { Geenklasleegte } from "./Geenklasleegte";

/**
 * FB-013 (ADR-0039 Z4): a screen about one klas, with no klas chosen, tells a gebruiker without any right why, and
 * everyone else what the screen itself says. Never before `/api/ik` has answered.
 */

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon(ik?: Ik) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={ik ? metIk(client, ik) : client}>
      <Geenklasleegte titel="Kies eerst een klas" />
    </QueryClientProvider>,
  );
}

describe("Geenklasleegte", () => {
  it("zegt een gebruiker zonder enig recht dat die geen klas kan inkijken", () => {
    toon(NIEMAND);

    expect(screen.getByText(t("context.geenInzageTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("context.geenInzage"))).toBeInTheDocument();
    expect(screen.queryByText("Kies eerst een klas")).toBeNull();
  });

  it("toont iedereen met een recht de eigen zin van het scherm", () => {
    for (const ik of [DIRECTIE, ikMet({ heeftThemabeheer: true }), ikMet({ hoofdleerkrachtLeeftijden: ["K2"] }), ikMet({ eigenKlasIds: ["k"] })]) {
      const { unmount } = render(
        <QueryClientProvider client={metIk(new QueryClient(), ik)}>
          <Geenklasleegte titel="Kies eerst een klas" />
        </QueryClientProvider>,
      );
      expect(screen.getByText("Kies eerst een klas")).toBeInTheDocument();
      expect(screen.queryByText(t("context.geenInzage"))).toBeNull();
      unmount();
    }
  });

  it("zegt niets over rechten zolang /api/ik niet geantwoord heeft", () => {
    toon();

    expect(screen.getByText("Kies eerst een klas")).toBeInTheDocument();
    expect(screen.queryByText(t("context.geenInzage"))).toBeNull();
  });
});
