import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { LeerplandoelDetail, MinimumdoelDetail } from "../../lib/types";
import { Doeldetailblad } from "./Doeldetailblad";

/**
 * The sheet the thema page opens a linked doel in (TB-016): onward to the minimumdoel inside the same sheet, and back
 * to the doel the page asks for when it asks for another one.
 */

const antwoord = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

function doel(code: string, tekst: string, minimumdoel: LeerplandoelDetail["minimumdoel"] = null): LeerplandoelDetail {
  return {
    code,
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    disciplineNummer: "1",
    disciplineNaam: "Nederlands en communicatie",
    domein: "Luisteren",
    subdomein: "Luisteren naar verhalen",
    cluster: null,
    tekst,
    voorbeelden: null,
    toelichting: null,
    woordenschat: null,
    minimumdoelRef: minimumdoel?.ref ?? null,
    minimumdoel,
    nietMeerInOpstap: false,
    koppelingen: [],
    gerelateerdeDoelen: [],
  };
}

const MINIMUMDOELTEKST = "De kleuters luisteren aandachtig naar een verhaal.";

const MINIMUMDOEL: MinimumdoelDetail = {
  ref: "K-1.2.3",
  leeftijd: "K-",
  nr: "1.2.3",
  omschrijving: MINIMUMDOELTEKST,
  leergebied: "Nederlands",
  rubriek: "Luisteren",
  subrubriek: null,
  soort: "TeBereikenIndividueel",
  nietMeerInOpstap: false,
  aantalLeerplandoelen: 1,
  jaarFasen: [],
  zonderLeerplandoelReden: null,
  zonderLeerplandoelDoelsets: [],
};

const A = doel("1.2.GK3.1", "De kleuter luistert naar een verhaal.", {
  ref: MINIMUMDOEL.ref,
  leeftijd: MINIMUMDOEL.leeftijd,
  nr: MINIMUMDOEL.nr,
  omschrijving: MINIMUMDOELTEKST,
});
const B = doel("1.2.GK3.2", "De kleuter vertelt een verhaal na.");

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string) => {
      if (pad.endsWith(`/api/leerplandoelen/${A.code}`)) return Promise.resolve(antwoord(A));
      if (pad.endsWith(`/api/leerplandoelen/${B.code}`)) return Promise.resolve(antwoord(B));
      if (pad.endsWith(`/api/minimumdoelen/${MINIMUMDOEL.ref}`)) return Promise.resolve(antwoord(MINIMUMDOEL));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon(code: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const blad = (c: string | null) => (
    <QueryClientProvider client={client}>
      <Doeldetailblad code={c} onSluit={vi.fn()} />
    </QueryClientProvider>
  );
  const { rerender } = render(blad(code));
  return (c: string | null) => rerender(blad(c));
}

describe("Doeldetailblad", () => {
  it("gaat van het leerplandoel naar zijn minimumdoel in hetzelfde paneel", async () => {
    toon(A.code);

    const blad = await screen.findByRole("dialog", { name: t("doel.titel") });
    fireEvent.click(await within(blad).findByRole("button", { name: new RegExp(t("doel.bekijkMinimumdoel")) }));

    const minimumdoelblad = await screen.findByRole("dialog", { name: t("minimumdoel.titel") });
    expect(await within(minimumdoelblad).findByText(MINIMUMDOELTEKST)).toBeInTheDocument();
  });

  it("toont het doel waar de pagina opnieuw om vraagt, niet waar de leerkracht vorige keer naartoe ging", async () => {
    const wissel = toon(A.code);
    const blad = await screen.findByRole("dialog", { name: t("doel.titel") });
    fireEvent.click(await within(blad).findByRole("button", { name: new RegExp(t("doel.bekijkMinimumdoel")) }));
    await screen.findByRole("dialog", { name: t("minimumdoel.titel") });

    wissel(null);
    wissel(B.code);

    const nieuw = await screen.findByRole("dialog", { name: t("doel.titel") });
    expect(await within(nieuw).findByText(B.tekst)).toBeInTheDocument();
  });
});
