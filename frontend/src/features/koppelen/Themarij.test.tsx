import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiviteitWeergave, SubthemaWeergave, ThemaWeergave } from "../../lib/types";
import type { Ik } from "../../lib/aanmelding";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import type { Themabestemming } from "./bestemmingen";
import { Themarij } from "./Themarij";

/**
 * What the destination row actually sends, and what it refuses to offer.
 *
 * These are the assertions a browser pass is worst at. The happy path is visible by eye, but the
 * request body is not: an activiteit created here that quietly leaves out the leerplandoelCode looks
 * exactly like one that included it, right up until the teacher goes looking for their doel a week
 * later. So the create test asserts the body, not the button.
 */

const CODE = "WIS-3.14";

function activiteit(naam: string, codes: string[] = []): ActiviteitWeergave {
  return {
    id: `activiteit-${naam}`,
    naam,
    activiteitType: "Spel",
    hoek: null,
    verwachteUitkomsten: null,
    onderzoeksvraagId: null,
    kleur: null,
    doelkoppelingen: codes.map((code, i) => ({
      id: `k${i}`,
      leerplandoelCode: code,
      status: "Manueel" as const,
      aiMotivatie: null,
    })),
  };
}

function subthema(naam: string, activiteiten: ActiviteitWeergave[]): SubthemaWeergave {
  return {
    id: `subthema-${naam}`,
    themaId: "thema-1",
    naam,
    duurWeken: 2,
    leeftijd: "K3",
    onderzoeksvragen: [],
    subdoelen: [],
    activiteiten,
  };
}

function thema(themadoelCodes: string[] = []): ThemaWeergave {
  return {
    id: "thema-1",
    naam: "Herfst en bladeren",
    duurWeken: 4,
    invalshoeken: null,
    kernwoordenschat: [],
    rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: themadoelCodes.length >= 2,
    themadoelen: themadoelCodes.map((code, i) => ({
      id: `td${i}`,
      koppeling: { id: `k${i}`, leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null },
    })),
    subthemas: [subthema("Bladeren sorteren", [activiteit("Bladerslinger"), activiteit("Blad tellen", [CODE])])],
  };
}

function tak(themadoelCodes: string[] = []): Themabestemming {
  const t = thema(themadoelCodes);
  return {
    thema: t,
    alGekoppeld: t.themadoelen.some((td) => td.koppeling.leerplandoelCode === CODE),
    themaVol: t.themadoelen.length >= 3,
    subthemas: t.subthemas.map((s) => ({
      subthema: s,
      alGekoppeld: false,
      activiteiten: s.activiteiten.map((a) => ({
        activiteit: a,
        alGekoppeld: a.doelkoppelingen.some((k) => k.leerplandoelCode === CODE),
      })),
    })),
  };
}

/**
 * Who links, by default: a hoofdleerkracht of K3 who also holds themabeheer, so every level of this K3 tree is
 * theirs (R4, R19, R24). The E6-02 cases at the end say who else is looking.
 */
const KOPPELAAR = ikMet({ heeftThemabeheer: true, hoofdleerkrachtLeeftijden: ["K3"] });

function toon(bestemming: Themabestemming, standaardOpen = true, ik: Ik = KOPPELAAR) {
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    ik,
  );
  return render(
    <QueryClientProvider client={client}>
      <Themarij tak={bestemming} code={CODE} klasId="klas-1" standaardOpen={standaardOpen} />
    </QueryClientProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: "nieuw", naam: "x" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Themarij", () => {
  it("koppelt een bestaande activiteit met één klik", async () => {
    toon(tak());

    fireEvent.click(screen.getByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/activiteiten/activiteit-Bladerslinger/doelkoppelingen");
    expect(JSON.parse(init.body)).toEqual({ leerplandoelCode: CODE });
  });

  it("biedt een activiteit die het doel al draagt niet nog eens aan", () => {
    toon(tak());

    // The row is present and says so, but it is not a control: clicking it would be a duplicate the
    // server refuses.
    expect(screen.getByText("Blad tellen")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Blad tellen" }) }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(t("koppelen.gekoppeld")).length).toBeGreaterThan(0);
  });

  it("maakt een nieuwe activiteit met het doel er al aan", async () => {
    toon(tak());

    fireEvent.click(screen.getByRole("button", { name: t("koppelen.nieuweActiviteitUitleg", { subthema: "Bladeren sorteren" }) }));
    fireEvent.change(screen.getByLabelText(t("koppelen.activiteitNaam")), { target: { value: "Bladeren persen" } });
    fireEvent.click(screen.getByRole("button", { name: t("koppelen.maakEnKoppel") }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/subthemas/subthema-Bladeren sorteren/activiteiten");

    // THE ASSERTION THIS FILE EXISTS FOR. The doel travels with the create, so the activiteit can
    // never exist for a moment without the doel that caused a teacher to make it.
    const body = JSON.parse(init.body);
    expect(body.leerplandoelCodes).toEqual([CODE]);
    expect(body.naam).toBe("Bladeren persen");
  });

  it("weigert een naamloze activiteit voordat het verzoek vertrekt", async () => {
    toon(tak());

    fireEvent.click(screen.getByRole("button", { name: t("koppelen.nieuweActiviteitUitleg", { subthema: "Bladeren sorteren" }) }));
    expect(screen.getByRole("button", { name: t("koppelen.maakEnKoppel") })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("koppelt aan het thema zolang er ruimte is", async () => {
    toon(tak(["NED-1.1"]));

    fireEvent.click(screen.getByRole("button", { name: t("koppelen.koppelAanThemaUitleg", { thema: "Herfst en bladeren" }) }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/themas/thema-1/themadoelen");
  });

  it("biedt geen vierde themadoel aan, maar zegt waarom", () => {
    toon(tak(["A-1", "A-2", "A-3"]));

    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanThemaUitleg", { thema: "Herfst en bladeren" }) }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(t("koppelen.themaVol", { max: 3 }))).toBeInTheDocument();
  });

  it("houdt de dichtgeklapte rij leeg, op een gekoppelde na", () => {
    // Closed, a thema row is navigation. The link button moved inside because nine identical ones
    // down the list drowned the sheet, but "Gekoppeld" stayed out here: it is the one thing a
    // teacher must be able to see without opening every thema.
    toon(tak(), false);
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanThemaUitleg", { thema: "Herfst en bladeren" }) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(t("koppelen.gekoppeld"))).not.toBeInTheDocument();

    toon(tak([CODE]), false);
    expect(screen.getByText(t("koppelen.gekoppeld"))).toBeInTheDocument();
  });

  it("zegt het als een koppeling mislukt, in plaats van niets te doen", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    toon(tak());

    fireEvent.click(screen.getByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t("koppelen.koppelMislukt"));
  });

  // E6-02: a stale control meets a refusal. It is named as one, and no retry is offered, since trying again is refused
  // again.
  it("noemt een weigering van de server een weigering, zonder opnieuw te laten proberen", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ title: "Geen toegang", detail: "Je hebt geen toegang tot deze actie." }), {
        status: 403,
      }),
    );
    toon(tak());

    fireEvent.click(screen.getByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Je hebt geen toegang tot deze actie.");
    expect(screen.queryByRole("button", { name: t("koppelen.opnieuw") })).not.toBeInTheDocument();
  });

  /*
    E6-02, ADR-0030 §3: each level is offered to whoever may link there. A leerkracht of K3 may make activiteiten but
    not link goals to them (R19), a subthema is the hoofdleerkracht's (R24), and a thema is themabeheer's (R4). The
    tree still says where the doel already sits.
  */
  it("biedt een leerkracht van de leeftijd niets om te koppelen, maar toont waar het doel al hangt", () => {
    toon(tak(), true, ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] }));

    expect(screen.getByText("Bladerslinger")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanSubthemaUitleg", { subthema: "Bladeren sorteren" }) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanThemaUitleg", { thema: "Herfst en bladeren" }) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.nieuweActiviteitUitleg", { subthema: "Bladeren sorteren" }) }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(t("koppelen.gekoppeld")).length).toBeGreaterThan(0);
  });

  it("biedt themabeheer zonder hoofdleerkrachtschap alleen het thema aan", () => {
    toon(tak(["NED-1.1"]), true, ikMet({ heeftThemabeheer: true }));

    expect(
      screen.getByRole("button", { name: t("koppelen.koppelAanThemaUitleg", { thema: "Herfst en bladeren" }) }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanSubthemaUitleg", { subthema: "Bladeren sorteren" }) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }),
    ).not.toBeInTheDocument();
  });

  it("biedt een hoofdleerkracht van een andere leeftijd niets in deze K3-boom", () => {
    toon(tak(), true, ikMet({ hoofdleerkrachtLeeftijden: ["L1"] }));

    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("koppelen.koppelAanSubthemaUitleg", { subthema: "Bladeren sorteren" }) }),
    ).not.toBeInTheDocument();
  });
});
