import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { WoordwebWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Woordweb } from "./Woordweb";

/**
 * The woordweb block (FB-036, ADR-0043): one's own web around the subthema's name, AI proposals that wait for a
 * decision, and colleagues' webs to read.
 */

const IK = "a0000000-0000-4000-8000-000000000001";
const COLLEGA = "b0000000-0000-4000-8000-000000000002";

function ik(delen: Partial<Ik> = {}): Ik {
  return {
    id: IK,
    naam: "Leerkracht An",
    email: "an@school.be",
    isAdmin: false,
    heeftThemabeheer: false,
    heeftLeerlingzorg: false,
    hoofdleerkrachtLeeftijden: [],
    leerkrachtLeeftijden: ["K3"],
    eigenKlasIds: [],
    rapportklasIds: [],
    lopendeRapportklasIds: [],
    ...delen,
  };
}

const EIGEN: WoordwebWeergave = {
  id: "web-eigen",
  subthemaId: "s-1",
  eigenaarId: IK,
  eigenaarNaam: "Leerkracht An",
  isEigen: true,
  woorden: [
    { id: "w-1", woord: "wind", status: "Manueel", aiMotivatie: null },
    { id: "w-2", woord: "plas", status: "Manueel", aiMotivatie: null },
    { id: "w-3", woord: "wolk", status: "Voorgesteld", aiMotivatie: "Wolken brengen regen." },
    { id: "w-4", woord: "tsunami", status: "Geweigerd", aiMotivatie: "Water uit zee." },
  ],
};

const VAN_COLLEGA: WoordwebWeergave = {
  id: "web-collega",
  subthemaId: "s-1",
  eigenaarId: COLLEGA,
  eigenaarNaam: "Leerkracht Bo",
  isEigen: false,
  woorden: [
    { id: "c-1", woord: "paraplu", status: "Manueel", aiMotivatie: null },
    { id: "c-2", woord: "donder", status: "Voorgesteld", aiMotivatie: "Hoort bij onweer." },
  ],
};

type Oproep = { methode: string; pad: string; lichaam: unknown };

function toon(webs: WoordwebWeergave[], gebruiker: Ik = ik(), antwoorden: Record<string, Response> = {}) {
  const oproepen: Oproep[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const pad = String(url);
      const methode = init?.method ?? "GET";
      oproepen.push({ methode, pad, lichaam: init?.body ? JSON.parse(String(init.body)) : undefined });
      const vast = antwoorden[`${methode} ${pad}`];
      if (vast) return vast;
      if (pad.endsWith("/api/ik")) return new Response(JSON.stringify(gebruiker), { status: 200 });
      if (pad.endsWith("/api/subthemas/s-1/woordwebs")) return new Response(JSON.stringify(webs), { status: 200 });
      return new Response(JSON.stringify(webs[0] ?? EIGEN), { status: 200 });
    }),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Woordweb subthemaId="s-1" naam="Regen" />
    </QueryClientProvider>,
  );
  return oproepen;
}

const schrijfOproepen = (oproepen: Oproep[]) => oproepen.filter((o) => o.methode !== "GET");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Woordweb", () => {
  it("laat een leeg web de AI nog niet vragen, en maakt het eigen web met de eerste woorden", async () => {
    const oproepen = toon([]);

    const invoer = await screen.findByLabelText(t("woordweb.invoerLabel"));
    // No AI control that cannot act (FB-094): one quiet sentence until the first word.
    expect(screen.queryByRole("button", { name: t("woordweb.voorstellen") })).toBeNull();
    expect(screen.getByText(t("woordweb.eerstZelf"))).toBeInTheDocument();

    fireEvent.paste(invoer, { clipboardData: { getData: () => "wind, regen\nwolk" } });

    await waitFor(() => expect(schrijfOproepen(oproepen)).toHaveLength(1));
    const [oproep] = schrijfOproepen(oproepen);
    expect(oproep.methode).toBe("POST");
    expect(oproep.pad).toMatch(/\/api\/subthemas\/s-1\/woordwebs\/eigen\/woorden$/);
    expect(oproep.lichaam).toEqual({ woorden: ["wind", "regen", "wolk"] });
  });

  it("zet de eigen woorden rond de naam, en een getypt woord gaat naar het bestaande web", async () => {
    const oproepen = toon([EIGEN]);

    const web = await screen.findByRole("group", { name: t("woordweb.eigenLabel", { naam: "Regen" }) });
    // The name sits between the two halves of the words: wind, then the name, then plas.
    expect(web.textContent).toMatch(/wind.*Regen.*plas/);
    // A proposal and a rejected word are not in the web.
    expect(within(web).queryByText("wolk")).toBeNull();
    expect(screen.queryByText("tsunami")).toBeNull();
    expect(screen.getByRole("button", { name: t("woordweb.voorstellen") })).toBeEnabled();
    expect(screen.queryByText(t("woordweb.eerstZelf"))).toBeNull();

    const invoer = within(web).getByLabelText(t("woordweb.invoerLabel"));
    fireEvent.change(invoer, { target: { value: "modder" } });
    fireEvent.keyDown(invoer, { key: "Enter" });

    await waitFor(() => expect(schrijfOproepen(oproepen)).toHaveLength(1));
    expect(schrijfOproepen(oproepen)[0].pad).toMatch(/\/api\/woordwebs\/web-eigen\/woorden$/);
    expect(schrijfOproepen(oproepen)[0].lichaam).toEqual({ woorden: ["modder"] });
  });

  it("toont een AI-voorstel met zijn motivatie en bewaart de beslissing", async () => {
    const oproepen = toon([EIGEN]);

    expect(await screen.findByText("Wolken brengen regen.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${t("plaatsing.aanvaard")}: wolk` }));

    await waitFor(() => expect(schrijfOproepen(oproepen)).toHaveLength(1));
    const [oproep] = schrijfOproepen(oproepen);
    expect(oproep.methode).toBe("PUT");
    expect(oproep.pad).toMatch(/\/api\/woordwebs\/web-eigen\/woorden\/w-3\/status$/);
    expect(oproep.lichaam).toEqual({ status: "Aanvaard" });
  });

  it("toont het web van een collega met haar naam, zonder haar voorstellen en zonder knoppen", async () => {
    toon([EIGEN, VAN_COLLEGA]);

    const collega = await screen.findByRole("listitem", { name: t("woordweb.vanCollega", { naam: "Leerkracht Bo" }) });
    expect(within(collega).getByText("Leerkracht Bo")).toBeInTheDocument();
    expect(within(collega).getByText("paraplu")).toBeInTheDocument();
    expect(within(collega).queryByText("donder")).toBeNull();
    expect(within(collega).queryByRole("button")).toBeNull();
  });

  it("laat admin een woord uit het web van een collega halen (D3)", async () => {
    const oproepen = toon([VAN_COLLEGA], ik({ isAdmin: true }));

    const collega = await screen.findByRole("listitem", { name: t("woordweb.vanCollega", { naam: "Leerkracht Bo" }) });
    fireEvent.click(within(collega).getByRole("button", { name: t("woordweb.haalWeg", { woord: "paraplu" }) }));

    await waitFor(() => expect(schrijfOproepen(oproepen)).toHaveLength(1));
    expect(schrijfOproepen(oproepen)[0]).toMatchObject({ methode: "DELETE" });
    expect(schrijfOproepen(oproepen)[0].pad).toMatch(/\/api\/woordwebs\/web-collega\/woorden\/c-1$/);
  });

  it("zegt het wanneer het antwoord van de AI onbruikbaar was", async () => {
    toon([EIGEN], ik(), {
      "POST /api/woordwebs/web-eigen/voorstellen": new Response(
        JSON.stringify({ title: "Invalid AI response", detail: "Word at index 0 has a missing/blank 'motivatie'." }),
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      ),
    });

    fireEvent.click(await screen.findByRole("button", { name: t("woordweb.voorstellen") }));

    expect(await screen.findByText(t("woordweb.aiOngeldig"))).toBeInTheDocument();
  });
});
