import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Aanmeldpoort } from "./Aanmeldpoort";
import { aanmeldOmleiding } from "../lib/api";
import type { Ik } from "../lib/aanmelding";
import { t } from "../i18n";

/**
 * The gate in front of the shell (TB-026). Behaviour only: how the tussenpagina looks, and that it
 * matches the static copy in `index.html`, is a browser pass, since jsdom applies no stylesheet.
 */
const IK: Ik = {
  id: "7e57a000-0000-4000-8000-000000000001",
  naam: "An Peeters",
  email: "an@school.be",
  isDirectie: false,
  heeftThemabeheer: false,
  hoofdleerkrachtLeeftijden: [],
  leerkrachtLeeftijden: [],
  eigenKlasIds: [],
  rapportklasIds: [],
  lopendeRapportklasIds: [],
};

const SCHIL = "schil-van-de-app";

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

function renderPoort() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Aanmeldpoort>
        <p>{SCHIL}</p>
      </Aanmeldpoort>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Aanmeldpoort", () => {
  it("toont alleen de tussenpagina zolang niet bekend is wie aangemeld is", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    renderPoort();

    expect(screen.getByRole("heading", { level: 1, name: t("app.naam") })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(t("aanmelding.tussenpagina.openen"));
    expect(screen.queryByText(SCHIL)).not.toBeInTheDocument();
  });

  it("toont de app zodra bekend is wie aangemeld is", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(IK)));

    renderPoort();

    expect(await screen.findByText(SCHIL)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: t("app.naam") })).not.toBeInTheDocument();
  });

  it("toont de app nooit bij een 401, en zegt dat de aanmelding volgt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 401)));
    const stuurDoor = vi.spyOn(aanmeldOmleiding, "stuurDoor").mockImplementation(() => {});

    renderPoort();

    expect(await screen.findByText(t("aanmelding.tussenpagina.doorsturen"))).toBeInTheDocument();
    expect(stuurDoor).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(SCHIL)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("zegt het als de server niet antwoordt, en vraagt het opnieuw", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValue(json(IK));
    vi.stubGlobal("fetch", fetchMock);

    renderPoort();

    expect(await screen.findByRole("alert")).toHaveTextContent(t("aanmelding.tussenpagina.fout"));
    expect(screen.queryByText(t("aanmelding.tussenpagina.doorsturen"))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("aanmelding.tussenpagina.opnieuw") }));

    expect(await screen.findByText(SCHIL)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
