import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { Hoekenlijst } from "./Hoekenlijst";
import type { HoekverrijkingsvoorstelWeergave } from "./gegevens";
import type { Verrijkingenweek, Verrijkingsreeks } from "./verrijkingenweek";

/**
 * FB-028 (ADR-0070): a small AI button on each corner's row in a subthema block asks for a verrijking, and the proposal
 * under the row is taken over, changed first, or rejected. Only for whoever may plan the klas.
 */
const antwoord = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const HOEKEN = [
  { id: "h-boek", klasId: "k-1", naam: "boekenhoek", omschrijving: null, aantalVerrijkingen: 1 },
  { id: "h-bouw", klasId: "k-1", naam: "bouwhoek", omschrijving: null, aantalVerrijkingen: 0 },
];

const HERFST = { subthemaId: "s-herfst", subthemaNaam: "De herfst", van: "2026-09-14", tot: "2026-09-25" };

const weekMet = (reeks: Verrijkingsreeks): Verrijkingenweek => ({
  status: "klaar",
  reeksen: [{ ...reeks, themaId: "t-1", themaNaam: "Seizoenen", aantalDagen: 10 }],
  periodes: reeks.periodeId
    ? [
        {
          subthemaperiodeId: reeks.periodeId,
          subthemaId: reeks.subthemaId,
          subthemaNaam: reeks.subthemaNaam,
          van: reeks.van,
          tot: reeks.tot,
          verrijkingen: [{ id: "v-1", hoekId: "h-boek", tekst: "prentenboeken over de herfst" }],
        },
      ]
    : [],
});

const VOORSTEL: HoekverrijkingsvoorstelWeergave = {
  id: "vs-1",
  hoekId: "h-bouw",
  subthemaId: "s-herfst",
  tekst: "Takken en boomschors om mee te bouwen.",
  aiMotivatie: "Past bij het bos in de herfst.",
};

let open: HoekverrijkingsvoorstelWeergave[] = [];
let aiAntwoord: () => Response = () => antwoord({ isGeslaagd: true, voorstel: VOORSTEL });

beforeEach(() => {
  open = [];
  aiAntwoord = () => {
    open = [VOORSTEL];
    return antwoord({ isGeslaagd: true, voorstel: VOORSTEL });
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(aiAntwoord());
      if (init?.method === "PUT") {
        open = [];
        return Promise.resolve(antwoord({ status: "Aanvaard", periode: null }));
      }
      return Promise.resolve(antwoord(pad.includes("hoekverrijkingsvoorstellen") ? open : []));
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function toon({ magPlannen = true, reeks = { ...HERFST, periodeId: "p-herfst" } as Verrijkingsreeks } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Hoekenlijst
          klasId="k-1"
          laadt={false}
          mislukt={false}
          hoeken={HOEKEN}
          week={weekMet(reeks)}
          volgende={{ status: "klaar", reeks: null, periodes: [] }}
          magPlannen={magPlannen}
          tegelRef={{ current: null }}
          rijId={(blok, hoekId) => `${blok}-${hoekId}`}
          onKiesHoek={vi.fn()}
          onVoorbereiden={vi.fn()}
          voorbereidenId="voorbereiden"
          onNieuw={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const oproepen = (methode: string) =>
  (vi.mocked(fetch).mock.calls as [string, RequestInit | undefined][])
    .filter(([, init]) => init?.method === methode)
    .map(([pad, init]) => ({ pad, body: JSON.parse(String(init!.body)) }));

const vraagKnop = (hoek: string) => screen.findByRole("button", { name: t("hoekvoorstel.vraag", { hoek }) });

describe("Hoekvoorstel: de AI stelt een verrijking voor per hoek (FB-028)", () => {
  it("vraagt per hoek een voorstel voor het subthema van het blok, en toont het met zijn motivatie", async () => {
    toon();

    fireEvent.click(await vraagKnop("bouwhoek"));

    expect(await screen.findByText(VOORSTEL.tekst)).toBeInTheDocument();
    expect(screen.getByText(VOORSTEL.aiMotivatie)).toBeInTheDocument();
    expect(screen.getByText(t("plaatsing.aiVoorstel"))).toBeInTheDocument();
    expect(oproepen("POST")).toEqual([
      { pad: "/api/klassen/k-1/hoeken/h-bouw/verrijkingsvoorstel", body: { subthemaId: "s-herfst" } },
    ]);
    // Asking changes no verrijking.
    expect(oproepen("PUT")).toEqual([]);
  });

  it("neemt een voorstel over in het opgeslagen venster van het subthema", async () => {
    open = [VOORSTEL];
    toon();

    fireEvent.click(await screen.findByRole("button", { name: `${t("hoekvoorstel.overnemen")}: bouwhoek` }));

    await waitFor(() =>
      expect(oproepen("PUT")).toEqual([
        {
          pad: "/api/klassen/k-1/hoekverrijkingsvoorstellen/vs-1/beslissing",
          body: { status: "Aanvaard", subthemaperiodeId: "p-herfst" },
        },
      ]),
    );
    await waitFor(() => expect(screen.queryByText(VOORSTEL.tekst)).toBeNull());
  });

  it("neemt een aangepaste tekst over, met de dagen wanneer het subthema nog geen venster heeft", async () => {
    open = [VOORSTEL];
    toon({ reeks: HERFST });

    fireEvent.click(await screen.findByRole("button", { name: `${t("plaatsing.pasAan")}: bouwhoek` }));
    const veld = screen.getByRole("textbox", { name: t("hoekvoorstel.tekstVoor", { hoek: "bouwhoek" }) });
    expect(veld).toHaveValue(VOORSTEL.tekst);
    fireEvent.change(veld, { target: { value: "Takken om mee te bouwen." } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekvoorstel.overnemen") }));

    await waitFor(() =>
      expect(oproepen("PUT")[0]?.body).toEqual({
        status: "Aanvaard",
        tekst: "Takken om mee te bouwen.",
        van: "2026-09-14",
        tot: "2026-09-25",
      }),
    );
  });

  it("weigert een voorstel zonder de verrijking te raken", async () => {
    open = [{ ...VOORSTEL, hoekId: "h-boek" }];
    toon();

    fireEvent.click(await screen.findByRole("button", { name: `${t("plaatsing.weiger")}: boekenhoek` }));

    await waitFor(() => expect(oproepen("PUT")[0]?.body).toEqual({ status: "Geweigerd" }));
    expect(screen.getByText("prentenboeken over de herfst")).toBeInTheDocument();
  });

  it("zegt het wanneer de AI niets nieuws vond, en wanneer het antwoord onbruikbaar was", async () => {
    aiAntwoord = () => antwoord({ isGeslaagd: true, voorstel: null });
    toon();

    fireEvent.click(await vraagKnop("bouwhoek"));
    expect(await screen.findByText(t("hoekvoorstel.nietsNieuws"))).toBeInTheDocument();

    aiAntwoord = () => antwoord({ title: "Invalid AI response" }, 422);
    fireEvent.click(await vraagKnop("bouwhoek"));
    expect(await screen.findByText(t("plaatsing.aiOngeldig"))).toBeInTheDocument();
  });

  it("toont wie de klas niet mag plannen geen AI-knop en vraagt geen voorstellen op", async () => {
    toon({ magPlannen: false });

    const blok = await screen.findByRole("region", { name: "De herfst" });
    expect(within(blok).getByText("bouwhoek")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoekvoorstel.vraag", { hoek: "bouwhoek" }) })).toBeNull();
    const gelezen = (vi.mocked(fetch).mock.calls as [string][]).map(([pad]) => pad);
    expect(gelezen.some((pad) => pad.includes("hoekverrijkingsvoorstellen"))).toBe(false);
  });
});
