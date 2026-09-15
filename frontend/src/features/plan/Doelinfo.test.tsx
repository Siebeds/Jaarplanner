import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Doelinfo, type Infodoel } from "./Doelinfo";
import type { LeerplandoelDetail } from "../../lib/types";
import { t } from "../../i18n";

/**
 * The info icon and the window it opens (FB-018).
 *
 * Pinned: what the window lists, where its text comes from (carried when the carrier had it, fetched only once the
 * window opens when it had codes alone), what it says when there are none, and that a goal opens the doel's detail.
 * Where the window sits on screen is the browser pass's: jsdom lays nothing out.
 */
const antwoord = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

function detail(code: string, tekst: string): LeerplandoelDetail {
  return {
    code,
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    disciplineNummer: "1",
    disciplineNaam: "Taal",
    domein: "Mondelinge taalvaardigheid",
    subdomein: "Spreken",
    cluster: null,
    tekst,
    voorbeelden: null,
    toelichting: null,
    woordenschat: null,
    minimumdoelRef: null,
    minimumdoel: null,
    nietMeerInOpstap: false,
    koppelingen: [],
    gerelateerdeDoelen: [],
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Every doel the window or the detail asks for, with a text that names its code.
  fetchMock = vi.fn((pad: string) => {
    const code = decodeURIComponent(pad.split("/").pop() ?? "");
    return Promise.resolve(antwoord(detail(code, `Tekst van ${code}.`)));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Renders the icon and returns it. */
function toon(doelen: readonly Infodoel[], naam = "onthaal") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Doelinfo naam={naam} doelen={doelen} />
    </QueryClientProvider>,
  );
  return screen.getByRole("button", { name: t("doelinfo.open", { naam }) });
}

const gelezen = (code: string) => fetchMock.mock.calls.some(([pad]) => pad === `/api/leerplandoelen/${code}`);

const groeten: Infodoel = { code: "1.1.GK3.1", doelsoort: "Gemeenschappelijk", tekst: "Groet de anderen." };
const vertellen: Infodoel = { code: "1.2.GK3.2", doelsoort: "Gemeenschappelijk", tekst: "Vertelt over het weekend." };

describe("Doelinfo", () => {
  it("toont de doelen die de fiche meebracht, zonder ze op te halen", () => {
    fireEvent.click(toon([groeten, vertellen]));

    const venster = screen.getByRole("dialog", { name: "onthaal" });
    expect(within(venster).getByText(t("doelinfo.aantalDoelen", { aantal: 2 }))).toBeInTheDocument();
    expect(within(venster).getByText("1.1.GK3.1")).toBeInTheDocument();
    expect(within(venster).getByText("Groet de anderen.")).toBeInTheDocument();
    expect(within(venster).getByText("Vertelt over het weekend.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("zegt één doel in het enkelvoud", () => {
    fireEvent.click(toon([groeten]));

    expect(screen.getByRole("dialog", { name: "onthaal" })).toHaveTextContent(t("doelinfo.eenDoel"));
  });

  it("haalt de tekst van een doel met alleen een code pas op wanneer het venster opengaat", async () => {
    const knop = toon([{ code: "3.2.GK3.4" }], "kringgesprek");
    // A grid of forty blocks must not read forty goals on load (TB-017 is about exactly that cost).
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(knop);

    expect(await screen.findByText("Tekst van 3.2.GK3.4.")).toBeInTheDocument();
    expect(gelezen("3.2.GK3.4")).toBe(true);
  });

  it("zegt in het venster dat er nog geen doelen gekoppeld zijn", () => {
    fireEvent.click(toon([]));

    expect(screen.getByRole("dialog", { name: "onthaal" })).toHaveTextContent(t("doelinfo.geen"));
  });

  it("opent vanuit het venster het detail van een doel, en sluit het venster", async () => {
    fireEvent.click(toon([groeten]));

    fireEvent.click(screen.getByRole("button", { name: /Groet de anderen\./ }));

    const detailblad = await screen.findByRole("dialog", { name: t("doel.titel") });
    expect(await within(detailblad).findByText("Tekst van 1.1.GK3.1.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "onthaal" })).not.toBeInTheDocument();
  });
});
