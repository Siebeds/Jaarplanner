import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave, LeerplandoelDetail, ThemaBibliotheekItem, ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ADMIN, NIEMAND, ikMet, metIk } from "../../test/rechten";
import { Bestemmingsblad } from "./Bestemmingsblad";

/**
 * The register's destination sheet lists only the thema's where the gebruiker has something to press (E6-02 slice 4,
 * fix round 2; the E3-06 rule). A hoofdleerkracht of K3 met a thema without subthema's that opened onto nothing. The
 * list is decided with the rights as the sheet opens (fix round 3, F9), so a thema stays listed after a refusal inside
 * it; and a row checks its own failure before the rights (`Activiteitrij`, and `Nieuweactiviteitregel` since the
 * mini-fix after audit round 4, F10), so the refused row keeps its reason too.
 *
 * A change of rights is awaited for one task: TanStack Query hands `setQueryData` to its observers on the next task,
 * so asserting straight after it tests the old rights.
 */

const CODE = "2.1.GL3.10";
const WEIGERING = "Je hebt geen toegang tot deze actie.";

const KLAS: KlasWeergave = {
  id: "klas-K3",
  schooljaarId: "jaar-1",
  naam: "K3 groen",
  leerjaar: 0,
  aantalSubthemas: 1,
  jaarFasen: ["K3"],
  jaarfase: "K3",
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: true,
};

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: KLAS,
    klasId: KLAS.id,
    schooljaarId: KLAS.schooljaarId,
    schooljaar: null,
    schooljaren: [],
    klassen: [KLAS],
    laadt: false,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

function thema(id: string, naam: string, subthemas: ThemaWeergave["subthemas"]): ThemaWeergave {
  return {
    id,
    naam,
    duurWeken: 4,
    invalshoeken: null,
    kernwoordenschat: [],
    rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: false,
    themadoelen: [],
    minimumdoelen: [],
    subthemas,
  };
}

const HERFST = thema("thema-herfst", "Herfst", [
  {
    id: "sub-1",
    themaId: "thema-herfst",
    naam: "Bladeren",
    duurWeken: 2,
    leeftijd: "K3",
    onderzoeksvragen: [],
    subdoelen: [],
    activiteiten: [
      {
        id: "act-1",
        naam: "Bladerslinger",
        activiteitType: "Spel",
        hoek: null,
        verwachteUitkomsten: null,
        onderzoeksvraagId: null,
        kleur: null,
        doelkoppelingen: [],
      },
    ],
  },
]);
const LEEG = thema("thema-leeg", "Leeg thema", []);

function bibliotheekItem(item: ThemaWeergave): ThemaBibliotheekItem {
  return {
    id: item.id,
    naam: item.naam,
    duurWeken: item.duurWeken,
    invalshoeken: null,
    kernwoordenschat: [],
    rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: false,
    themadoelen: [],
    minimumdoelen: [],
  };
}

function maakClient(ik: Ik, themas: ThemaWeergave[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["thema-bibliotheek"], themas.map(bibliotheekItem));
  for (const item of themas) qc.setQueryData(["thema-voor-klas", item.id, KLAS.id], item);
  qc.setQueryData(["leerplandoel", CODE], {
    code: CODE,
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    tekst: "De kleuters tellen tot tien.",
  } as unknown as LeerplandoelDetail);
  return metIk(qc, ik);
}

function toon(ik: Ik, themas: ThemaWeergave[]) {
  const qc = maakClient(ik, themas);
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Bestemmingsblad code={CODE} open onOpenChange={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { blad: screen.getByRole("dialog"), qc };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Bestemmingsblad", () => {
  it("toont een hoofdleerkracht van K3 geen leeg thema, wel het thema met een K3-subthema", () => {
    const { blad } = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [HERFST, LEEG]);

    expect(within(blad).getByText("Herfst")).toBeInTheDocument();
    expect(within(blad).queryByText("Leeg thema")).toBeNull();
  });

  // FB-043: a thema itself takes no leerplandoel any more, so an empty thema offers nothing, to anyone.
  it("toont ook admin het lege thema niet, en zegt themabeheer alleen dat er niets te koppelen is", () => {
    const { blad } = toon(ADMIN, [HERFST, LEEG]);
    expect(within(blad).getByText("Herfst")).toBeInTheDocument();
    expect(within(blad).queryByText("Leeg thema")).toBeNull();
    cleanup();

    const themabeheer = toon(ikMet({ heeftThemabeheer: true }), [HERFST, LEEG]);
    expect(within(themabeheer.blad).getByText(t("koppelen.nietsTeKoppelen"))).toBeInTheDocument();
    expect(within(themabeheer.blad).queryByText("Leeg thema")).toBeNull();
  });

  it("zegt dat er niets te koppelen is als er thema's zijn maar geen enkele knop, niet dat er geen thema's zijn", () => {
    const { blad } = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [LEEG]);

    expect(within(blad).getByText(t("koppelen.nietsTeKoppelen"))).toBeInTheDocument();
    expect(within(blad).queryByText(t("koppelen.geenThemas"))).toBeNull();
    expect(within(blad).queryByText("Leeg thema")).toBeNull();
  });

  it("houdt een geweigerde koppeling in beeld als de vernieuwde rechten het K3-koppelrecht niet meer geven", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: WEIGERING }), {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }),
      ),
    );
    const { blad, qc } = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [HERFST, LEEG]);

    // Searching opens every row down to the activiteit.
    fireEvent.change(within(blad).getByLabelText(t("koppelen.zoek")), { target: { value: "Bladerslinger" } });
    fireEvent.click(
      within(blad).getByRole("button", { name: t("koppelen.koppelAanActiviteitUitleg", { activiteit: "Bladerslinger" }) }),
    );
    expect(await within(blad).findByRole("alert")).toHaveTextContent(WEIGERING);
    const subthemaKnop = { name: t("koppelen.koppelAanSubthemaUitleg", { subthema: "Bladeren" }) };
    expect(within(blad).getByRole("button", subthemaKnop)).toBeInTheDocument();

    // The refusal refetches the rights, and they no longer hold the goal-link right at K3.
    await act(async () => {
      qc.setQueryData(["ik"], NIEMAND);
      await new Promise((r) => setTimeout(r, 0));
    });

    // The new rights arrived: the subthema's own link control is gone.
    expect(within(blad).queryByRole("button", subthemaKnop)).toBeNull();
    expect(within(blad).getByRole("alert")).toHaveTextContent(WEIGERING);
    expect(within(blad).queryByText(t("koppelen.nietsTeKoppelen"))).toBeNull();
  });

  it("houdt een geweigerde nieuwe activiteit in beeld als de vernieuwde rechten haar niet meer laten maken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: WEIGERING }), {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }),
      ),
    );
    const { blad, qc } = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [HERFST, LEEG]);

    fireEvent.change(within(blad).getByLabelText(t("koppelen.zoek")), { target: { value: "Bladeren" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("koppelen.nieuweActiviteitUitleg", { subthema: "Bladeren" }) }));
    fireEvent.change(within(blad).getByLabelText(t("koppelen.activiteitNaam")), { target: { value: "Eikels tellen" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("koppelen.maakEnKoppel") }));
    const melding = await within(blad).findByRole("alert");
    expect(melding).toHaveTextContent(WEIGERING);

    // The refusal refetches the rights: no create right and no goal-link right at K3 any more.
    await act(async () => {
      qc.setQueryData(["ik"], NIEMAND);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(within(blad).queryByRole("button", { name: t("koppelen.koppelAanSubthemaUitleg", { subthema: "Bladeren" }) })).toBeNull();
    // The reason stays, as the same element, and the create it refused is no longer offered.
    expect(within(blad).getByRole("alert")).toBe(melding);
    expect(within(blad).queryByRole("button", { name: t("koppelen.maakEnKoppel") })).toBeNull();
    expect(within(blad).queryByLabelText(t("koppelen.activiteitNaam"))).toBeNull();
  });
});

/**
 * TB-037: this search field draws its own clear button, so `eigen-wisknop` hides the browser's own cross. jsdom
 * cannot evaluate `::-webkit-search-cancel-button`; the class is what guards against a rewritten `className`
 * bringing the second cross back. Measured in a real browser: `backlog/worklogs/TB-037/browsercontrole.md`.
 */
describe("Bestemmingsblad: één wisknop in het zoekveld", () => {
  it("verbergt het eigen kruisje van de browser op het zoekveld", () => {
    const { blad } = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }), [HERFST]);

    expect(within(blad).getByLabelText(t("koppelen.zoek"))).toHaveClass("eigen-wisknop");
  });
});
