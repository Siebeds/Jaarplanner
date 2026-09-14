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
 * only for whoever can use a section of Inladen, and a new thema only for directie and themabeheer (R4).
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
