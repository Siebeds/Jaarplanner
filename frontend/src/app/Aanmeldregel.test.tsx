import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Aanmeldregel } from "./Aanmeldregel";
import { afmeldNavigatie, type Ik } from "../lib/aanmelding";
import { t } from "../i18n";

/**
 * The signed-in row (E6-01). Behaviour only: where it sits and how it looks is a browser pass, since
 * jsdom applies no stylesheet.
 */
const IK: Ik = {
  id: "7e57a000-0000-4000-8000-000000000001",
  naam: "An Peeters",
  email: "an@school.be",
  isAdmin: false,
  heeftThemabeheer: false,
  heeftLeerlingzorg: false,
  hoofdleerkrachtLeeftijden: [],
  leerkrachtLeeftijden: [],
  eigenKlasIds: [],
  rapportklasIds: [],
  lopendeRapportklasIds: [],
};
const ENTRA_AFMELDING = "https://login.voorbeeld.test/logout";

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

function stubApi({ afmelden = 200 }: { afmelden?: number } = {}) {
  // `init` is named so the calls are typed with it: the sign-out test reads its method.
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith("/api/ik")) return json(IK);
    if (url.endsWith("/api/afmelden")) return afmelden === 200 ? json({ doorsturenNaar: ENTRA_AFMELDING }) : json({}, afmelden);
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderMet(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let gaNaar: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  gaNaar = vi.spyOn(afmeldNavigatie, "gaNaar").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Aanmeldregel", () => {
  it("toont niets zolang niet bekend is wie aangemeld is", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const { container } = renderMet(<Aanmeldregel />);

    expect(container).toBeEmptyDOMElement();
  });

  it("toont de naam en meldt af via Microsoft", async () => {
    const fetchMock = stubApi();
    renderMet(<Aanmeldregel />);

    expect(await screen.findByText(IK.naam)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("aanmelding.afmelden") }));

    await waitFor(() => expect(gaNaar).toHaveBeenCalledWith(ENTRA_AFMELDING));
    const afmelding = fetchMock.mock.calls.find(([url]) => url.endsWith("/api/afmelden"));
    expect((afmelding?.[1] as RequestInit | undefined)?.method).toBe("POST");
  });

  it("houdt de naam in het label van de knop in de smalle rail", async () => {
    stubApi();
    renderMet(<Aanmeldregel smal />);

    expect(await screen.findByRole("button", { name: t("aanmelding.afmeldenAls", { naam: IK.naam }) })).toBeInTheDocument();
    expect(screen.queryByText(IK.naam)).not.toBeInTheDocument();
  });

  it("zegt het als afmelden niet lukt, en blijft staan", async () => {
    stubApi({ afmelden: 500 });
    renderMet(<Aanmeldregel />);

    fireEvent.click(await screen.findByRole("button", { name: t("aanmelding.afmelden") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t("aanmelding.afmeldenMislukt"));
    expect(gaNaar).not.toHaveBeenCalled();
  });
});
