import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { DoelenScherm } from "../doelen/DoelenScherm";
import { ThemasScherm } from "./ThemasScherm";

/**
 * The two headers that lead to Inladen, and the one that makes a thema (E6-02; the E1-22 carry-forward). Each link is
 * only for whoever can use a section of Inladen, and a new thema only for admin and themabeheer (R4).
 */

function toon(scherm: "themas" | "doelen", ik: Ik) {
  render(
    <QueryClientProvider client={metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik)}>
      <MemoryRouter>{scherm === "themas" ? <ThemasScherm /> : <DoelenScherm />}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Every list may wait: the headers are what these tests look at.
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const LEERKRACHT = ikMet({ leerkrachtLeeftijden: ["K3"], hoofdleerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] });
const THEMABEHEER = ikMet({ heeftThemabeheer: true });

describe("ThemasScherm", () => {
  it("biedt een leerkracht, ook een hoofdleerkracht, geen nieuw thema en geen Inladen", () => {
    toon("themas", LEERKRACHT);
    expect(screen.queryByRole("button", { name: t("themas.nieuw") })).toBeNull();
    expect(screen.queryByRole("link", { name: t("navigatie.inladen") })).toBeNull();
  });

  it("biedt themabeheer een nieuw thema en Inladen", () => {
    toon("themas", THEMABEHEER);
    expect(screen.getByRole("button", { name: t("themas.nieuw") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("navigatie.inladen") })).toHaveAttribute("href", "/inladen");
  });
});

describe("ThemasScherm: de kaart van een thema (TB-051)", () => {
  it("telt de minimumdoelen van het thema, en geen klassen of doelen van alle niveaus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              id: "t-1",
              naam: "Winter",
              duurWeken: 5,
              invalshoeken: null,
              kernwoordenschat: [],
              rijkeWoordenschat: [],
              heeftVoldoendeThemadoelen: true,
              themadoelen: [],
              minimumdoelen: ["K-1.1.1", "K-1.1.2", "K-1.1.3"].map((ref, i) => ({ id: `m-${i}`, minimumdoelRef: ref })),
              aantalAfgeleideLeeftijden: 3,
              aantalSubthemas: 9,
              aantalActiviteiten: 40,
              aantalDoelkoppelingen: 460,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    toon("themas", LEERKRACHT);

    const kaart = await screen.findByRole("link", { name: /Winter/ });
    expect(kaart).toHaveTextContent(`3 ${t("themas.minimumdoelMeer")}`);
    expect(kaart).not.toHaveTextContent(/klas/);
    expect(kaart).not.toHaveTextContent("460");
  });

  it("toont geen melding bij een thema met minder dan twee minimumdoelen (TB-055)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              id: "t-2",
              naam: "Lente",
              duurWeken: 3,
              invalshoeken: null,
              kernwoordenschat: [],
              rijkeWoordenschat: [],
              heeftVoldoendeThemadoelen: false,
              themadoelen: [],
              minimumdoelen: [{ id: "m-0", minimumdoelRef: "K-1.1.1" }],
              aantalAfgeleideLeeftijden: 0,
              aantalSubthemas: 0,
              aantalActiviteiten: 0,
              aantalDoelkoppelingen: 0,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    toon("themas", LEERKRACHT);

    const kaart = await screen.findByRole("link", { name: /Lente/ });
    expect(kaart).toHaveTextContent(`1 ${t("themas.minimumdoelEen")}`);
    expect(kaart).not.toHaveTextContent(/themadoelen/i);
  });
});

describe("DoelenScherm", () => {
  it("biedt een leerkracht geen Inladen", () => {
    toon("doelen", LEERKRACHT);
    expect(screen.queryByRole("link", { name: t("navigatie.inladen") })).toBeNull();
  });

  it("biedt themabeheer Inladen, dat voor hen op de thema's uitkomt", () => {
    toon("doelen", THEMABEHEER);
    expect(screen.getByRole("link", { name: t("navigatie.inladen") })).toHaveAttribute("href", "/inladen?bron=opstap");
  });
});
