import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { DoelMatchSuggestie, LeerplandoelDetail, ThemaWeergave } from "../../lib/types";
import { DIRECTIE, metIk } from "../../test/rechten";
import { ThemadetailScherm } from "./ThemadetailScherm";

/**
 * A doel linked on the thema page shows what it says, not only its code, and opens its detail when pressed (TB-016).
 * Rendered through the real screen rather than the row alone, because the row was never the problem: this project's
 * recurring failure is a control that exists and is tested but is not reachable where the teacher is.
 */

const antwoord = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

function doel(code: string, tekst: string): LeerplandoelDetail {
  return {
    code,
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K2",
    disciplineNummer: "6",
    disciplineNaam: "Muzische vorming",
    domein: "Beeld",
    subdomein: "Beeldend vormgeven",
    cluster: null,
    tekst,
    voorbeelden: "Met klei, verf en papier.",
    toelichting: null,
    woordenschat: null,
    minimumdoelRef: null,
    minimumdoel: null,
    nietMeerInOpstap: false,
    koppelingen: [],
    gerelateerdeDoelen: [],
  };
}

const THEMADOELTEKST = "De kleuter verkent materialen om iets vorm te geven.";
const SUBDOELTEKST = "De kleuter luistert naar een verhaal.";

const DOELEN: Record<string, LeerplandoelDetail> = {
  "6.5.GK2.3": doel("6.5.GK2.3", THEMADOELTEKST),
  "6.4.GJK.1": doel("6.4.GJK.1", "De kleuter beweegt op muziek."),
  "1.2.GK2.1": doel("1.2.GK2.1", SUBDOELTEKST),
};

const THEMA: ThemaWeergave = {
  id: "t-1",
  naam: "Carnaval",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: true,
  themadoelen: [
    { id: "td-1", koppeling: { id: "k-1", leerplandoelCode: "6.5.GK2.3", status: "Manueel", aiMotivatie: null } },
    { id: "td-2", koppeling: { id: "k-2", leerplandoelCode: "6.4.GJK.1", status: "Manueel", aiMotivatie: null } },
  ],
  subthemas: [
    {
      id: "st-1",
      themaId: "t-1",
      naam: "De stoet",
      duurWeken: 2,
      leeftijd: "K2",
      onderzoeksvragen: [],
      subdoelen: [
        {
          id: "sd-1",
          leeftijd: "K2",
          koppeling: { id: "k-3", leerplandoelCode: "1.2.GK2.1", status: "Aanvaard", aiMotivatie: null },
        },
      ],
      activiteiten: [],
    },
  ],
};

const SUGGESTIE: DoelMatchSuggestie = {
  id: "s-1",
  leerplandoelCode: "6.5.GK2.3",
  status: "Voorgesteld",
  aiMotivatie: "Past bij het verkleden.",
  tekst: THEMADOELTEKST,
  doelsoort: "Gemeenschappelijk",
};
let suggesties: DoelMatchSuggestie[] = [];

const fetchMock = vi.fn((pad: string, init?: RequestInit) => {
  if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
  if (init?.method === "PUT") return Promise.resolve(antwoord({ ...SUGGESTIE, status: "Aanvaard" }));
  const leerplandoel = /\/api\/leerplandoelen\/([^/?]+)$/.exec(pad);
  if (leerplandoel) return Promise.resolve(antwoord(DOELEN[decodeURIComponent(leerplandoel[1])]));
  if (pad.endsWith("/doelsuggesties")) return Promise.resolve(antwoord(suggesties));
  if (pad.endsWith("/api/jaarfasen")) return Promise.resolve(antwoord(["JK", "K2", "K3"]));
  if (pad.endsWith("/api/themas/t-1")) return Promise.resolve(antwoord(THEMA));
  return Promise.resolve(new Response("{}", { status: 404 }));
});

beforeEach(() => {
  fetchMock.mockClear();
  suggesties = [];
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon() {
  // As directie, who holds every right on this page: the unlink and the verdict buttons are drawn only for whoever
  // holds their row of the ADR-0030 matrix (E6-02), and these tests are about what they do, not about who sees them.
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), DIRECTIE);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/themas/t-1"]}>
        <Routes>
          <Route path="/themas/:themaId" element={<ThemadetailScherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ThemadetailScherm: gekoppelde doelen tonen hun tekst (TB-016)", () => {
  it("toont bij elk themadoel de doeltekst naast de code", async () => {
    toon();

    expect(await screen.findByText(THEMADOELTEKST)).toBeInTheDocument();
    expect(await screen.findByText("De kleuter beweegt op muziek.")).toBeInTheDocument();
    expect(screen.getByText("6.5.GK2.3")).toBeInTheDocument();
  });

  it("toont bij een subdoel de doeltekst", async () => {
    toon();

    expect(await screen.findByText(SUBDOELTEKST)).toBeInTheDocument();
    expect(screen.getByText("1.2.GK2.1")).toBeInTheDocument();
  });

  it("opent bij een klik de volledige doeldetail, zonder koppelknop", async () => {
    toon();
    await screen.findByText(THEMADOELTEKST);

    // By role, not by text: a click on the text bubbles to any ancestor with a handler, so an `<li onClick>` that no
    // keyboard can reach would pass a text query. A native button is focusable and answers Enter and Space by itself.
    fireEvent.click(screen.getByRole("button", { name: new RegExp(THEMADOELTEKST) }));

    const blad = await screen.findByRole("dialog", { name: t("doel.titel") });
    expect(await within(blad).findByText("Met klei, verf en papier.")).toBeInTheDocument();
    expect(within(blad).getByText(THEMADOELTEKST)).toBeInTheDocument();
    // Linking is the job of the control above the list; a doel opened from it is already linked.
    expect(within(blad).queryByRole("button", { name: t("doel.koppelAan") })).not.toBeInTheDocument();
  });

  it("geeft de focus terug aan de regel wanneer de detail sluit", async () => {
    toon();
    await screen.findByText(THEMADOELTEKST);
    const knop = screen.getByRole("button", { name: new RegExp(THEMADOELTEKST) });

    knop.focus();
    fireEvent.click(knop);
    const blad = await screen.findByRole("dialog", { name: t("doel.titel") });
    fireEvent.keyDown(blad, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(knop).toHaveFocus();
  });

  it("opent ook de detail van een subdoel", async () => {
    toon();
    await screen.findByText(SUBDOELTEKST);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(SUBDOELTEKST) }));

    const blad = await screen.findByRole("dialog", { name: t("doel.titel") });
    expect(await within(blad).findByText(SUBDOELTEKST)).toBeInTheDocument();
  });

  // What this does NOT guard: that the remove control sits ABOVE the row's stretched click area. jsdom does no hit
  // testing, so removing the control's `relative z-10` still passes here while a real browser would open the sheet on
  // an unlink. The TB-016 browser pass checks it with `elementFromPoint` (see the ticket's Werklog).
  it("ontkoppelt zonder de detail te openen", async () => {
    toon();
    await screen.findByText(THEMADOELTEKST);

    fireEvent.click(screen.getByRole("button", { name: t("activiteit.ontkoppel", { code: "6.5.GK2.3" }) }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("td-1"),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leest de doeldetail opnieuw na een ontkoppeling, zodat Gebruikt in niet achterloopt", async () => {
    toon();
    await screen.findByText(THEMADOELTEKST);
    const detailReads = () =>
      fetchMock.mock.calls.filter(([pad, init]) => pad.endsWith("/api/leerplandoelen/6.5.GK2.3") && !init?.method)
        .length;
    const voor = detailReads();

    fireEvent.click(screen.getByRole("button", { name: t("activiteit.ontkoppel", { code: "6.5.GK2.3" }) }));

    await waitFor(() => expect(detailReads()).toBeGreaterThan(voor));
  });

  it("leest de doeldetail opnieuw na een oordeel over een doelsuggestie", async () => {
    suggesties = [SUGGESTIE];
    toon();
    await screen.findByText(THEMADOELTEKST);
    const detailReads = () =>
      fetchMock.mock.calls.filter(([pad, init]) => pad.endsWith("/api/leerplandoelen/6.5.GK2.3") && !init?.method)
        .length;
    const voor = detailReads();

    fireEvent.click(await screen.findByRole("button", { name: t("thema.aanvaard") }));

    await waitFor(() => expect(detailReads()).toBeGreaterThan(voor));
  });

  it("markeert in de rij een doel dat uit Op.stap verdwenen is", async () => {
    const oud = DOELEN["6.4.GJK.1"];
    DOELEN["6.4.GJK.1"] = { ...oud, nietMeerInOpstap: true };
    try {
      toon();

      const rij = await screen.findByRole("button", { name: /De kleuter beweegt op muziek\./ });
      expect(within(rij).getByText(t("doel.vervallen"))).toBeInTheDocument();
      const andereRij = screen.getByRole("button", { name: new RegExp(THEMADOELTEKST) });
      expect(within(andereRij).queryByText(t("doel.vervallen"))).not.toBeInTheDocument();
    } finally {
      DOELEN["6.4.GJK.1"] = oud;
    }
  });
});
