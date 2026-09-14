import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { LeerplandoelDetail } from "../../lib/types";
import { Doeldetail } from "./Doeldetail";

/**
 * "Koppel dit doel" appears exactly when the caller can take the teacher somewhere with it (TB-016). The register
 * passes a destination and keeps the button; the thema page opens this detail for a doel it already linked and passes
 * `null`. `onKoppel` is required but nullable, so the compiler makes every caller choose; this guards what each choice
 * renders, not which one `DoelenScherm` makes.
 */

const DOEL: LeerplandoelDetail = {
  code: "6.5.GK2.3",
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K2",
  disciplineNummer: "6",
  disciplineNaam: "Muzische vorming",
  domein: "Beeld",
  subdomein: "Beeldend vormgeven",
  cluster: null,
  tekst: "De kleuter verkent materialen om iets vorm te geven.",
  voorbeelden: null,
  toelichting: null,
  woordenschat: null,
  minimumdoelRef: null,
  minimumdoel: null,
  nietMeerInOpstap: false,
  koppelingen: [],
  gerelateerdeDoelen: [],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(DOEL), { status: 200, headers: { "Content-Type": "application/json" } })),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon(onKoppel: (() => void) | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Doeldetail code={DOEL.code} onKies={vi.fn()} onKiesMinimumdoel={vi.fn()} onKoppel={onKoppel} />
    </QueryClientProvider>,
  );
}

describe("Doeldetail: de koppelknop", () => {
  it("toont Koppel dit doel wanneer er een bestemming is, zoals in het register", async () => {
    toon(vi.fn());

    expect(await screen.findByRole("button", { name: t("doel.koppelAan") })).toBeInTheDocument();
  });

  it("laat de knop weg zonder bestemming, in plaats van een knop die niets doet", async () => {
    toon(null);

    expect(await screen.findByText(DOEL.tekst)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("doel.koppelAan") })).not.toBeInTheDocument();
  });
});
