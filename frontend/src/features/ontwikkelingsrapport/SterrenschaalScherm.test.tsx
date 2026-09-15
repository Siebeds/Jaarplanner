import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { t } from "../../i18n";
import type { Gradatie } from "./rapportset";
import { SterrenschaalScherm } from "./SterrenschaalScherm";

/**
 * The one K3 sterrenschaal (FB-002), as each person meets it: a K3 leerkracht in a running schooljaar changes it;
 * directie, a K3 hoofdleerkracht without a klas and a K3 leerkracht after the schooljaar view it (R6, R31, D4).
 */

const K3_LEERKRACHT = ikMet({
  eigenKlasIds: ["k3"],
  leerkrachtLeeftijden: ["K3"],
  rapportklasIds: ["k3"],
  lopendeRapportklasIds: ["k3"],
});
const K3_NA_HET_SCHOOLJAAR = ikMet({ eigenKlasIds: ["k3"], rapportklasIds: ["k3"] });
const HOOFDLEERKRACHT_K3 = ikMet({ hoofdleerkrachtLeeftijden: ["K3"] });

/** The owner's example, which the server seeds (owner, 2026-09-15). */
const START: Gradatie[] = [
  { id: "g1", label: "Volledig bereikt", kleur: "Groen", volgorde: 1 },
  { id: "g2", label: "Nog niet volledig", kleur: "Oranje", volgorde: 2 },
];
const KLEUREN = ["Groen", "Lichtgroen", "Geel", "Oranje", "Rood", "Blauw"];

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

interface Verzoek {
  methode: string;
  pad: string;
  lichaam?: unknown;
}

/** A small server over an in-memory scale, so a write and the read after it agree. */
function toon(ik: Ik) {
  let gradaties = [...START];
  const verzoeken: Verzoek[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (invoer: string, init?: RequestInit) => {
      const pad = String(invoer);
      const methode = init?.method ?? "GET";
      const lichaam = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      verzoeken.push({ methode, pad, lichaam });

      if (pad.endsWith("/api/gradaties/kleuren")) return json(KLEUREN);
      if (pad.endsWith("/api/gradaties/volgorde") && methode === "PUT") {
        const ids = (lichaam as { ids: string[] }).ids;
        gradaties = ids.map((id, index) => ({ ...gradaties.find((g) => g.id === id)!, volgorde: index + 1 }));
        return new Response(null, { status: 204 });
      }
      if (pad.endsWith("/api/gradaties") && methode === "GET") return json(gradaties);
      if (pad.endsWith("/api/gradaties") && methode === "POST") {
        const nieuw = { id: `g${gradaties.length + 1}`, volgorde: gradaties.length + 1, ...lichaam } as Gradatie;
        gradaties = [...gradaties, nieuw];
        return json(nieuw, 201);
      }
      const een = /\/api\/gradaties\/([^/]+)$/.exec(pad);
      if (een && methode === "PUT") {
        gradaties = gradaties.map((g) => (g.id === een[1] ? { ...g, ...lichaam } : g));
        return json(gradaties.find((g) => g.id === een[1]));
      }
      if (een && methode === "DELETE") {
        gradaties = gradaties.filter((g) => g.id !== een[1]);
        return new Response(null, { status: 204 });
      }
      return json({}, 404);
    }),
  );

  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/ontwikkelingsrapport/sterrenschaal"]}>
        <SterrenschaalScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return verzoeken;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SterrenschaalScherm, voor een K3-leerkracht", () => {
  it("toont de schaal van het voorbeeld, elke ster met haar label, en zegt dat ze voor heel K3 geldt", async () => {
    toon(K3_LEERKRACHT);

    expect(await screen.findByText("Volledig bereikt")).toBeInTheDocument();
    expect(screen.getByText("Nog niet volledig")).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.schaalUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(t("ontwikkelingsrapport.schaalAlleenBekijken"))).not.toBeInTheDocument();
  });

  it("voegt een gradatie toe met een label en een kleur uit de vaste lijst, bij naam gekozen", async () => {
    const verzoeken = toon(K3_LEERKRACHT);
    await screen.findByText("Volledig bereikt");

    fireEvent.change(screen.getByRole("textbox", { name: t("ontwikkelingsrapport.label") }), {
      target: { value: " Bijna bereikt " },
    });
    // The colour is a radio named by the colour's Dutch name, never a swatch alone (Art. XII).
    fireEvent.click(await screen.findByRole("radio", { name: t("ontwikkelingsrapport.kleuren.geel") }));
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.gradatieToevoegen") }));

    expect(await screen.findByText("Bijna bereikt")).toBeInTheDocument();
    expect(verzoeken).toContainEqual({ methode: "POST", pad: "/api/gradaties", lichaam: { label: "Bijna bereikt", kleur: "Geel" } });
  });

  it("weigert een gradatie zonder kleur zonder iets te versturen", async () => {
    const verzoeken = toon(K3_LEERKRACHT);
    await screen.findByText("Volledig bereikt");

    fireEvent.change(screen.getByRole("textbox", { name: t("ontwikkelingsrapport.label") }), {
      target: { value: "Bijna bereikt" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.gradatieToevoegen") }));

    expect(screen.getByRole("alert")).toHaveTextContent(t("ontwikkelingsrapport.kleurVerplicht"));
    expect(verzoeken.some((verzoek) => verzoek.methode === "POST")).toBe(false);
  });

  it("zet een gradatie een plaats hoger, en de eerste kan niet hoger", async () => {
    const verzoeken = toon(K3_LEERKRACHT);
    await screen.findByText("Volledig bereikt");

    expect(screen.getByRole("button", { name: t("ontwikkelingsrapport.hogerZetten", { naam: "Volledig bereikt" }) })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: t("ontwikkelingsrapport.hogerZetten", { naam: "Nog niet volledig" }) }));

    await vi.waitFor(() =>
      expect(verzoeken).toContainEqual({ methode: "PUT", pad: "/api/gradaties/volgorde", lichaam: { ids: ["g2", "g1"] } }),
    );
  });

  it("hernoemt een gradatie en kiest er een andere kleur voor", async () => {
    const verzoeken = toon(K3_LEERKRACHT);
    fireEvent.click(
      await screen.findByRole("button", { name: t("ontwikkelingsrapport.wijzigGradatie", { naam: "Volledig bereikt" }) }),
    );

    // The row's own field, filled with the label, beside the add form's empty one.
    const velden = screen.getAllByRole("textbox", { name: t("ontwikkelingsrapport.label") });
    const bewerking = velden.find((veld) => (veld as HTMLInputElement).value === "Volledig bereikt")!;
    fireEvent.change(bewerking, { target: { value: "Bereikt" } });
    fireEvent.click(screen.getAllByRole("radio", { name: t("ontwikkelingsrapport.kleuren.lichtgroen") })[0]);
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByText("Bereikt")).toBeInTheDocument();
    expect(verzoeken).toContainEqual({ methode: "PUT", pad: "/api/gradaties/g1", lichaam: { label: "Bereikt", kleur: "Lichtgroen" } });
  });
});

describe("SterrenschaalScherm, voor wie ze alleen bekijkt", () => {
  it.each([
    ["directie (R31)", DIRECTIE],
    ["een hoofdleerkracht van K3 zonder klas (D4)", HOOFDLEERKRACHT_K3],
    ["een K3-leerkracht na het schooljaar (D4)", K3_NA_HET_SCHOOLJAAR],
  ])("toont %s de schaal zonder één knop om ze aan te passen", async (_, ik) => {
    toon(ik);

    expect(await screen.findByText("Volledig bereikt")).toBeInTheDocument();
    expect(screen.getByText(t("ontwikkelingsrapport.schaalAlleenBekijken"))).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: t("ontwikkelingsrapport.gradatieToevoegen") })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("ontwikkelingsrapport.wijzigGradatie", { naam: "Volledig bereikt" }) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("ontwikkelingsrapport.hogerZetten", { naam: "Nog niet volledig" }) }),
    ).not.toBeInTheDocument();
  });
});
