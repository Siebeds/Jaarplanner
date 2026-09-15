import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { t } from "../../i18n";
import type { Rapportdoel, Rapportsubdoel } from "./rapportset";
import { RapportdoelenScherm } from "./RapportdoelenScherm";

/**
 * The one K3 set of rapportdoelen (FB-002): a titel and the decided K3 subdoelen it bundles, changed by a K3 leerkracht
 * in a running schooljaar and viewed by directie (R3, R4, R6, R31). The server filters which subdoelen may be bundled
 * (D11, D12), so the picker here shows what the server offers and nothing else.
 */

const K3_LEERKRACHT = ikMet({
  eigenKlasIds: ["k3"],
  leerkrachtLeeftijden: ["K3"],
  rapportklasIds: ["k3"],
  lopendeRapportklasIds: ["k3"],
});

const S1: Rapportsubdoel = {
  id: "s1",
  leerplandoelCode: "NL.1",
  leerplandoelTekst: "Luistert naar een verhaal.",
  doelsoort: "Gemeenschappelijk",
  themaNaam: "Herfst",
  subthemaNaam: "Paddenstoelen",
};
const S2: Rapportsubdoel = {
  id: "s2",
  leerplandoelCode: "NL.2",
  leerplandoelTekst: "Vertelt over een ervaring.",
  doelsoort: "Gemeenschappelijk",
  themaNaam: "Herfst",
  subthemaNaam: "Bladeren",
};
const START: Rapportdoel[] = [{ id: "r1", titel: "Luisteren en spreken", volgorde: 1, subdoelen: [S1] }];

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

interface Verzoek {
  methode: string;
  pad: string;
  lichaam?: unknown;
}

/** A small server over an in-memory set; `kandidaten` is the pool of decided K3 subdoelen it offers. */
function toon(ik: Ik, kandidaten: Rapportsubdoel[] = [S1, S2]) {
  let rapportdoelen = [...START];
  const verzoeken: Verzoek[] = [];
  const metSubdoelen = (lichaam: { titel: string; subdoelIds: string[] }) => ({
    titel: lichaam.titel,
    subdoelen: kandidaten.filter((subdoel) => lichaam.subdoelIds.includes(subdoel.id)),
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (invoer: string, init?: RequestInit) => {
      const pad = String(invoer);
      const methode = init?.method ?? "GET";
      const lichaam = init?.body ? JSON.parse(String(init.body)) : undefined;
      verzoeken.push({ methode, pad, lichaam });

      if (pad.endsWith("/api/rapportdoelen/kandidaten")) return json(kandidaten);
      if (pad.endsWith("/api/rapportdoelen/volgorde") && methode === "PUT") return new Response(null, { status: 204 });
      if (pad.endsWith("/api/rapportdoelen") && methode === "GET") return json(rapportdoelen);
      if (pad.endsWith("/api/rapportdoelen") && methode === "POST") {
        const nieuw = { id: `r${rapportdoelen.length + 1}`, volgorde: rapportdoelen.length + 1, ...metSubdoelen(lichaam) };
        rapportdoelen = [...rapportdoelen, nieuw];
        return json(nieuw, 201);
      }
      const een = /\/api\/rapportdoelen\/([^/]+)$/.exec(pad);
      if (een && methode === "PUT") {
        rapportdoelen = rapportdoelen.map((r) => (r.id === een[1] ? { ...r, ...metSubdoelen(lichaam) } : r));
        return json(rapportdoelen.find((r) => r.id === een[1]));
      }
      if (een && methode === "DELETE") {
        rapportdoelen = rapportdoelen.filter((r) => r.id !== een[1]);
        return new Response(null, { status: 204 });
      }
      return json({}, 404);
    }),
  );

  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/ontwikkelingsrapport/rapportdoelen"]}>
        <RapportdoelenScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return verzoeken;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RapportdoelenScherm, voor een K3-leerkracht", () => {
  it("toont elk rapportdoel met zijn titel en het aantal subdoelen dat het bundelt", async () => {
    toon(K3_LEERKRACHT);

    expect(await screen.findByText("Luisteren en spreken")).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.eenSubdoel"))).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.setUitleg"))).toBeInTheDocument();
  });

  it("maakt een rapportdoel met een titel en een gekozen subdoel", async () => {
    const verzoeken = toon(K3_LEERKRACHT);
    await screen.findByText("Luisteren en spreken");

    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.rapportdoelToevoegen") }));
    const blad = await screen.findByRole("dialog", { name: t("ontwikkelingsrapport.nieuwRapportdoel") });
    fireEvent.change(within(blad).getByRole("textbox", { name: t("ontwikkelingsrapport.titelVeld") }), {
      target: { value: " Samen spreken " },
    });
    fireEvent.click(await within(blad).findByRole("checkbox", { name: /NL\.2/ }));
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByText("Samen spreken")).toBeInTheDocument();
    expect(verzoeken).toContainEqual({
      methode: "POST",
      pad: "/api/rapportdoelen",
      lichaam: { titel: "Samen spreken", subdoelIds: ["s2"] },
    });
  });

  it("opent een bestaand rapportdoel met zijn titel en zijn subdoelen al gekozen", async () => {
    toon(K3_LEERKRACHT);
    fireEvent.click(
      await screen.findByRole("button", { name: t("ontwikkelingsrapport.wijzigRapportdoel", { naam: "Luisteren en spreken" }) }),
    );

    const blad = await screen.findByRole("dialog", { name: t("ontwikkelingsrapport.rapportdoelWijzigen") });
    expect(within(blad).getByRole("textbox", { name: t("ontwikkelingsrapport.titelVeld") })).toHaveValue("Luisteren en spreken");
    expect(await within(blad).findByRole("checkbox", { name: /NL\.1/ })).toBeChecked();
    expect(within(blad).getByRole("checkbox", { name: /NL\.2/ })).not.toBeChecked();
    expect(within(blad).getByText(t("ontwikkelingsrapport.gekozen", { aantal: 1 }))).toBeInTheDocument();
  });

  it("zoekt in de subdoelen op code, tekst en namen, en zegt het als niets past", async () => {
    toon(K3_LEERKRACHT);
    await screen.findByText("Luisteren en spreken");
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.rapportdoelToevoegen") }));
    const blad = await screen.findByRole("dialog");
    await within(blad).findByRole("checkbox", { name: /NL\.1/ });

    const zoek = within(blad).getByRole("searchbox", { name: t("ontwikkelingsrapport.zoekSubdoel") });
    fireEvent.change(zoek, { target: { value: "bladeren" } });
    expect(within(blad).queryByRole("checkbox", { name: /NL\.1/ })).not.toBeInTheDocument();
    expect(within(blad).getByRole("checkbox", { name: /NL\.2/ })).toBeInTheDocument();

    fireEvent.change(zoek, { target: { value: "xyz" } });
    expect(within(blad).getByText(t("ontwikkelingsrapport.geenZoekresultaat"))).toBeInTheDocument();
  });

  it("zegt het als er nog geen beslist K3-subdoel is om te kiezen", async () => {
    toon(K3_LEERKRACHT, []);
    await screen.findByText("Luisteren en spreken");
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.rapportdoelToevoegen") }));

    const blad = await screen.findByRole("dialog");
    expect(await within(blad).findByText(t("ontwikkelingsrapport.geenKandidaten"))).toBeInTheDocument();
  });
});

describe("RapportdoelenScherm, voor directie (R31)", () => {
  it("toont de set zonder één knop om ze aan te passen", async () => {
    toon(DIRECTIE);

    expect(await screen.findByText("Luisteren en spreken")).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.setAlleenBekijken"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("ontwikkelingsrapport.rapportdoelToevoegen") })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("ontwikkelingsrapport.wijzigRapportdoel", { naam: "Luisteren en spreken" }) }),
    ).not.toBeInTheDocument();
  });
});
