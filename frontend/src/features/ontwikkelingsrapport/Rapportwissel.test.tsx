import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { ADMIN, ikMet, metIk } from "../../test/rechten";
import { t } from "../../i18n";
import { Rapportstart, Rapportwissel } from "./Rapportwissel";

/**
 * Which parts of the ontwikkelingsrapport each person is offered, and where the bare address sends them (FB-002).
 * The children are behind the report's right (R17, D18); the set and the scale are for anyone to view (AC5).
 */

const K3_LEERKRACHT = ikMet({ eigenKlasIds: ["k3"], rapportklasIds: ["k3"], lopendeRapportklasIds: ["k3"] });
const HOOFDLEERKRACHT_K3 = ikMet({ hoofdleerkrachtLeeftijden: ["K3"] });

function toon(ik: Ik, pad = "/ontwikkelingsrapport") {
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pad]}>
        <Routes>
          <Route path="ontwikkelingsrapport">
            <Route index element={<Rapportstart />} />
            <Route path="kinderen" element={<p>kinderen-scherm</p>} />
            <Route path="rapportdoelen" element={<p>rapportdoelen-scherm</p>} />
            <Route path="sterrenschaal" element={<Rapportwissel />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const deel = (sleutel: "kinderen" | "rapportdoelen" | "sterrenschaal") =>
  screen.queryByRole("link", { name: t(`ontwikkelingsrapport.${sleutel}`) });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Rapportwissel", () => {
  it("biedt een K3-leerkracht de drie onderdelen aan, en markeert het huidige", () => {
    toon(K3_LEERKRACHT, "/ontwikkelingsrapport/sterrenschaal");

    expect(deel("kinderen")).toHaveAttribute("href", "/ontwikkelingsrapport/kinderen");
    expect(deel("rapportdoelen")).toBeInTheDocument();
    expect(deel("sterrenschaal")).toHaveAttribute("aria-current", "page");
  });

  it("biedt een hoofdleerkracht van K3 zonder klas de set en de schaal aan, en de kinderen niet (R17, AC5)", () => {
    toon(HOOFDLEERKRACHT_K3, "/ontwikkelingsrapport/sterrenschaal");

    expect(deel("kinderen")).not.toBeInTheDocument();
    expect(deel("rapportdoelen")).toBeInTheDocument();
    expect(deel("sterrenschaal")).toBeInTheDocument();
  });
});

describe("Rapportstart", () => {
  it("stuurt een K3-leerkracht en admin naar de kinderen", () => {
    toon(K3_LEERKRACHT);
    expect(screen.getByText("kinderen-scherm")).toBeInTheDocument();
  });

  it("stuurt admin ook naar de kinderen", () => {
    toon(ADMIN);
    expect(screen.getByText("kinderen-scherm")).toBeInTheDocument();
  });

  it("stuurt wie geen rapport mag lezen naar het eerste onderdeel dat die wel mag zien", () => {
    toon(HOOFDLEERKRACHT_K3);
    expect(screen.getByText("rapportdoelen-scherm")).toBeInTheDocument();
  });
});
