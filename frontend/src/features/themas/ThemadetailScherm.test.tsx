import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type {
  ActiviteitWeergave,
  DoelMatchResultaat,
  DoelMatchSuggestie,
  SubdoelplaatsingOverzicht,
  OverzichtLeerplandoel,
  ThemaDoelenoverzicht,
  ThemaWeergave,
} from "../../lib/types";
import { t, telWoord } from "../../i18n";
import { ADMIN, ikMet, metIk } from "../../test/rechten";
import { ALLE_ACTIVITEITEN, openLijsten } from "../../test/lijsten";
import { kleurSleutel } from "../activiteiten/kleuren";
import { STANDAARDDUUR } from "../plan/tijd";
import { ThemadetailScherm } from "./ThemadetailScherm";

/**
 * The thema fiche, as each right sees it (E6-02 slice 4, ADR-0030 §3).
 *
 * One thema with a K3 chapter and an L1 chapter, because the point of per-leeftijd rights is that one page carries
 * content a gebruiker edits and content they only read. The K3 chapter holds three activiteiten that differ only in
 * who made them and whether a goal is linked, which is what decides the maker's delete (R25, R33).
 */

const IK_ID = "ik-1";

function activiteit(id: string, naam: string, extra: Partial<ActiviteitWeergave> = {}): ActiviteitWeergave {
  return {
    id,
    naam,
    activiteitType: "Spel",
    hoek: null,
    verwachteUitkomsten: null,
    onderzoeksvraagId: null,
    kleur: null,
    doelkoppelingen: [],
    makerId: null,
    ...extra,
  };
}

const koppeling = (code: string) => ({ id: `k-${code}`, leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null });

const THEMA: ThemaWeergave = {
  id: "thema-1",
  naam: "Herfst",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [{ id: "td-1", koppeling: koppeling("NED-1") }],
  minimumdoelen: [{ id: "tm-1", minimumdoelRef: "K-MD-1" }],
  subthemas: [
    {
      id: "s-k3",
      themaId: "thema-1",
      naam: "Bladeren",
      duurWeken: 2,
      leeftijd: "K3",
      onderzoeksvragen: [],
      subdoelen: [{ id: "sd-1", leeftijd: "K3", koppeling: koppeling("WIS-1") }],
      activiteiten: [
        activiteit("a-eigen", "Eigen spel", { makerId: IK_ID }),
        activiteit("a-ander", "Andermans spel", { makerId: "iemand-anders" }),
        activiteit("a-gekoppeld", "Gekoppeld spel", { makerId: IK_ID, doelkoppelingen: [koppeling("WO-2")] }),
      ],
    },
    {
      id: "s-l1",
      themaId: "thema-1",
      naam: "Rekenen",
      duurWeken: 2,
      leeftijd: "L1",
      onderzoeksvragen: [],
      subdoelen: [{ id: "sd-2", leeftijd: "L1", koppeling: koppeling("REK-1") }],
      activiteiten: [activiteit("a-l1", "Tellen")],
    },
  ],
};

const SUGGESTIE: DoelMatchSuggestie = {
  id: "sug-1",
  minimumdoelRef: "K-9.1.1",
  status: "Voorgesteld",
  aiMotivatie: "Past bij bladeren verzamelen.",
  omschrijving: "De kleuters kunnen seizoenen onderscheiden.",
  mijlpaal: "K-",
};

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

function toon(
  ik: Ik,
  opties: {
    weiger?: boolean;
    thema?: ThemaWeergave;
    overzicht?: ThemaDoelenoverzicht;
    /** Answers "Vraag suggesties", given the body it was sent. */
    genereer?: (body: unknown) => Response;
    /** Where the page opens, for a link that asks for one subthema (FB-037). */
    pad?: string;
    /** The thema's doelsuggesties, in the order the server sends them. */
    suggesties?: DoelMatchSuggestie[];
    /** The subdoelplaatsing the server answers (FB-057); without it that read fails, as on a server without it. */
    plaatsing?: SubdoelplaatsingOverzicht;
    /** Records every write the page sends, with its body. */
    schrijf?: (methode: string, pad: string, body: unknown) => Response | undefined;
  } = {},
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        const eigen = opties.schrijf?.(init.method, pad, init.body ? JSON.parse(String(init.body)) : undefined);
        if (eigen) return eigen;
        if (opties.genereer && pad.endsWith("/doelsuggesties/genereer")) {
          return opties.genereer(JSON.parse(String(init.body ?? "{}")));
        }
        return opties.weiger
          ? json({ title: "Geen toegang", detail: "Je hebt geen toegang tot deze actie." }, 403)
          : json({});
      }
      if (pad.endsWith("/doelsuggesties")) return json(opties.suggesties ?? [SUGGESTIE]);
      if (pad.endsWith("/api/jaarfasen")) return json(["JK", "K2", "K3", "L1"]);
      if (pad.endsWith("/api/themas/thema-1/doelenoverzicht")) {
        return json(opties.overzicht ?? { themaId: "thema-1", leeftijden: [] });
      }
      if (pad.endsWith("/api/themas/thema-1/subdoelplaatsing")) {
        return opties.plaatsing ? json(opties.plaatsing) : json({}, 404);
      }
      if (pad.endsWith("/api/themas/thema-1")) return json(opties.thema ?? THEMA);
      return json({}, 404);
    }),
  );
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    { ...ik, id: IK_ID },
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opties.pad ?? "/themas/thema-1"]}>
        <Routes>
          <Route path="themas/:themaId" element={<ThemadetailScherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const knop = (naam: string) => screen.queryByRole("button", { name: naam });

/** Opens an "…" menu by keyboard, which is how Radix answers in jsdom, and returns what its items say (FB-094). */
async function menu(label: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: label }), { key: "Enter" });
  return (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
}

const THEMAMENU = t("themabeheer.menuAria", { naam: "Herfst" });
const subthemamenu = (naam: string) => t("subthemabeheer.menuAria", { naam });

/** A chapter's fold button, found by the subthema's name; its summary follows the name in the same label. */
const hoofdstuk = (naam: string, open: boolean) =>
  screen.getByRole("button", { name: new RegExp(`^${naam}`), expanded: open });

/**
 * Opens both chapters. They start shut (FB-011), and on a shut chapter every "this control is absent" check below
 * would pass without testing anything, so the rights tests open them first.
 */
async function openHoofdstukken() {
  await screen.findByText("Bladeren");
  fireEvent.click(hoofdstuk("Bladeren", false));
  fireEvent.click(hoofdstuk("Rekenen", false));
  // The guard: `getByRole` throws unless both are open now, so no absence check below can pass on a shut chapter.
  hoofdstuk("Bladeren", true);
  hoofdstuk("Rekenen", true);
  // Their lists start shut too (TB-051), with the same risk.
  openLijsten();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemadetailScherm: doelsuggesties vragen voor gekozen leeftijden (TB-007, FB-042)", () => {
  const resultaat = (extra: Partial<DoelMatchResultaat> = {}): DoelMatchResultaat => ({
    isGeslaagd: true,
    fout: null,
    bewaard: [SUGGESTIE, { ...SUGGESTIE, id: "sug-2" }, { ...SUGGESTIE, id: "sug-3" }],
    overgeslagenOnbekend: [],
    overgeslagenDuplicaat: [],
    aantalKandidaten: 535,
    jaarFasen: ["K3", "L1"],
    mijlpalen: ["K-", "4-"],
    ...extra,
  });

  /** Opens the choice behind "Vraag suggesties" (FB-042) and returns its leeftijd buttons. */
  const leeftijden = async () => {
    fireEvent.click(await screen.findByRole("button", { name: t("thema.suggestiesVragen") }));
    return screen.findByRole("group", { name: t("thema.leeftijdenLabel") });
  };
  const versturen = () => screen.getByRole("button", { name: t("thema.suggestiesVersturen") });
  const vraag = () => fireEvent.click(versturen());

  it("toont eerst alleen 'Vraag suggesties', en die knop vraagt nog niets aan de AI", async () => {
    const verzonden: unknown[] = [];
    toon(ADMIN, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat());
      },
    });

    const open = await screen.findByRole("button", { name: t("thema.suggestiesVragen") });
    expect(open).toHaveClass("knop-ai");
    expect(screen.queryByRole("group", { name: t("thema.leeftijdenLabel") })).toBeNull();
    expect(screen.queryByText(t("thema.suggestiesVragenVoor"))).toBeNull();
    expect(knop(t("thema.suggestiesVersturen"))).toBeNull();

    fireEvent.click(open);

    const groep = await screen.findByRole("group", { name: t("thema.leeftijdenLabel") });
    expect(screen.getByText(t("thema.suggestiesVragenVoor"))).toBeInTheDocument();
    expect(versturen()).toHaveClass("knop-ai");
    expect(knop(t("thema.suggestiesAnnuleren"))).not.toHaveClass("knop-ai");
    // Only the send button wears the ring now: the one that opened the choice made way for it.
    expect(knop(t("thema.suggestiesVragen"))).toBeNull();
    // Focus moves into the choice, onto its first leeftijd.
    expect(within(groep).getByRole("button", { name: "JK" })).toHaveFocus();
    expect(verzonden).toEqual([]);
  });

  it("sluit de keuze bij annuleren zonder iets te vragen, en zet de leeftijden terug bij de volgende keer", async () => {
    const verzonden: unknown[] = [];
    toon(ADMIN, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat());
      },
    });

    let groep = await leeftijden();
    fireEvent.click(within(groep).getByRole("button", { name: "K3" }));
    fireEvent.click(screen.getByRole("button", { name: t("thema.suggestiesAnnuleren") }));

    expect(screen.queryByRole("group", { name: t("thema.leeftijdenLabel") })).toBeNull();
    expect(knop(t("thema.suggestiesVersturen"))).toBeNull();
    expect(screen.getByRole("button", { name: t("thema.suggestiesVragen") })).toHaveFocus();

    groep = await leeftijden();
    expect(within(groep).getByRole("button", { name: "K3" })).toHaveAttribute("aria-pressed", "true");
    expect(verzonden).toEqual([]);
  });

  it("vraagt na het uitvinken van een leeftijd alleen voor de overige, en sluit de keuze daarna", async () => {
    const verzonden: unknown[] = [];
    toon(ADMIN, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat({ jaarFasen: ["L1"] }));
      },
    });

    const groep = await leeftijden();
    fireEvent.click(within(groep).getByRole("button", { name: "K3" }));
    vraag();

    await waitFor(() => expect(verzonden).toEqual([{ jaarFasen: ["L1"] }]));
    await waitFor(() => expect(screen.queryByRole("group", { name: t("thema.leeftijdenLabel") })).toBeNull());
    expect(screen.getByRole("button", { name: t("thema.suggestiesVragen") })).toHaveFocus();
  });

  it("duidt de leeftijden van de subthema's aan en vraagt voor precies die leeftijden", async () => {
    const verzonden: unknown[] = [];
    toon(ADMIN, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat());
      },
    });

    const groep = await leeftijden();
    expect(within(groep).getByRole("button", { name: "K3" })).toHaveAttribute("aria-pressed", "true");
    expect(within(groep).getByRole("button", { name: "L1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(groep).getByRole("button", { name: "JK" })).toHaveAttribute("aria-pressed", "false");
    expect(within(groep).getByRole("button", { name: "K2" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(t("thema.kiesLeeftijd"))).toBeNull();

    vraag();

    // The mijlpalen the result names, not the leeftijden the buttons show (FB-053).
    const zin = t("thema.suggestiesNieuw", {
      aantal: 3,
      doelen: t("thema.kandidatenMeer", { aantal: 535 }),
      mijlpalen: t("thema.mijlpalenMeer", { lijst: t("thema.opsommingEn", { eerste: "K", laatste: "4" }) }),
    });
    expect(zin).toBe("3 nieuwe voorstellen uit 535 minimumdoelen van mijlpalen K en 4.");
    expect(await screen.findByText(zin)).toBeInTheDocument();
    expect(verzonden).toEqual([{ jaarFasen: ["K3", "L1"] }]);
  });

  it("stuurt een gewijzigde keuze in de volgorde van de jaarfasen, hoe er ook geklikt werd", async () => {
    const verzonden: unknown[] = [];
    toon(ADMIN, {
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat({ jaarFasen: ["K2", "K3"] }));
      },
    });

    const groep = await leeftijden();
    fireEvent.click(within(groep).getByRole("button", { name: "L1" }));
    fireEvent.click(within(groep).getByRole("button", { name: "K2" }));
    expect(within(groep).getByRole("button", { name: "L1" })).toHaveAttribute("aria-pressed", "false");
    vraag();

    await waitFor(() => expect(verzonden).toEqual([{ jaarFasen: ["K2", "K3"] }]));
  });

  it("laat bij een thema zonder subthema's eerst een leeftijd kiezen, en zegt waarom de knop uit staat", async () => {
    const verzonden: unknown[] = [];
    toon(ADMIN, {
      thema: { ...THEMA, subthemas: [] },
      genereer: (body) => {
        verzonden.push(body);
        return json(resultaat({ bewaard: [], aantalKandidaten: 1, jaarFasen: ["K2"], mijlpalen: ["K-"] }));
      },
    });

    const groep = await leeftijden();
    expect(within(groep).queryByRole("button", { pressed: true })).toBeNull();
    expect(versturen()).toBeDisabled();
    expect(screen.getByText(t("thema.kiesLeeftijd"))).toBeInTheDocument();
    expect(versturen()).toHaveAccessibleDescription(t("thema.kiesLeeftijd"));

    fireEvent.click(within(groep).getByRole("button", { name: "K2" }));
    expect(screen.queryByText(t("thema.kiesLeeftijd"))).toBeNull();
    vraag();

    expect(
      await screen.findByText(t("thema.suggestiesGeenNieuwe", { doelen: t("thema.kandidaatEen"), mijlpalen: "mijlpaal K" })),
    ).toBeInTheDocument();
    expect(verzonden).toEqual([{ jaarFasen: ["K2"] }]);
  });

  it("zegt het wanneer er voor de gekozen leeftijden geen doelen geladen zijn", async () => {
    toon(ADMIN, { genereer: () => json(resultaat({ bewaard: [], aantalKandidaten: 0 })) });

    await leeftijden();
    vraag();

    expect(
      await screen.findByText(
        t("thema.suggestiesGeenDoelen", { mijlpalen: t("thema.mijlpalenMeer", { lijst: t("thema.opsommingEn", { eerste: "K", laatste: "4" }) }) }),
      ),
    ).toBeInTheDocument();
  });

  it("toont de Nederlandse weigering van de server", async () => {
    const weigering =
      "Deze aanvraag is te groot voor de AI: de tekst van 1.742 doelen is meer dan één aanvraag mag bevatten (ongeveer 91.000 tokens, de grens is 50.000). Kies minder leeftijden.";
    toon(ADMIN, { genereer: () => json({ title: "Ongeldige aanvraag", detail: weigering }, 400) });

    await leeftijden();
    vraag();

    expect(await screen.findByText(weigering)).toBeInTheDocument();
  });

  it("toont bij een kapot AI-antwoord de eigen zin, niet de Engelse diagnose", async () => {
    toon(ADMIN, { genereer: () => json({ title: "Invalid AI response", detail: "Response is not valid JSON." }, 422) });

    await leeftijden();
    vraag();

    expect(await screen.findByText(t("thema.suggestiesMislukt"))).toBeInTheDocument();
    expect(screen.queryByText("Response is not valid JSON.")).toBeNull();
  });
});

describe("ThemadetailScherm: wie wat mag", () => {
  it("geeft een leerkracht van K3 de activiteiten van K3, en de prullenbak alleen op wat zij zelf maakte zonder doel", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-k3"] }));
    await openHoofdstukken();

    // Not the thema, its themadoelen or the doelsuggesties (R4, R14), nor any subthema (R5, R21) or subdoel (R24).
    expect(knop(t("themabeheer.bewerk"))).toBeNull();
    expect(knop(t("themabeheer.bewerkThema"))).toBeNull();
    expect(knop(THEMAMENU)).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).toBeNull();
    expect(knop(t("doelkiezer.koppel"))).toBeNull();
    expect(knop(t("thema.minimumdoelKoppelen"))).toBeNull();
    expect(knop(t("thema.minimumdoelOntkoppel", { ref: "K-MD-1" }))).toBeNull();
    expect(screen.queryByText(SUGGESTIE.aiMotivatie)).toBeNull();
    // She reads which minimumdoelen the thema aims at (FB-043), and no leerplandoel as a themadoel.
    expect(screen.getByRole("button", { name: /K-MD-1/, expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("NED-1")).toBeNull();
    expect(knop(t("subthemabeheer.toevoegen"))).toBeNull();
    expect(knop(subthemamenu("Bladeren"))).toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Bladeren" }))).toBeNull();
    expect(knop(t("activiteit.ontkoppel", { code: "WIS-1" }))).toBeNull();

    // A new activiteit and its content at K3, and only at K3 (R17, R23).
    expect(screen.getAllByRole("button", { name: t("activiteit.toevoegen") })).toHaveLength(1);
    expect(knop(t("activiteit.bewerkAria", { naam: "Eigen spel" }))).not.toBeNull();
    expect(knop(t("activiteit.bekijkAria", { naam: "Tellen" }))).not.toBeNull();

    // The maker's delete, while no goal is linked (R25, R33): hers, not a colleague's, and not a linked one.
    expect(knop(t("activiteit.verwijderAria", { naam: "Eigen spel" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Andermans spel" }))).toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Gekoppeld spel" }))).toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).toBeNull();
  });

  it("geeft een hoofdleerkracht van K3 het K3-hoofdstuk helemaal, en het L1-hoofdstuk niet", async () => {
    toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
    await openHoofdstukken();

    expect(knop(t("subthemabeheer.toevoegen"))).not.toBeNull();
    expect(await menu(subthemamenu("Bladeren"))).toEqual([t("themabeheer.bewerk"), t("themabeheer.verwijder")]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(knop(subthemamenu("Rekenen"))).toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Bladeren" }))).not.toBeNull();
    expect(knop(t("thema.koppelAanSubthema", { naam: "Rekenen" }))).toBeNull();
    // The subdoel unlink, on a `Gekoppelddoel` row since TB-016: on the K3 subdoel, not on the L1 one (R24).
    expect(knop(t("activiteit.ontkoppel", { code: "WIS-1" }))).not.toBeNull();
    expect(knop(t("activiteit.ontkoppel", { code: "REK-1" }))).toBeNull();
    // Any K3 activiteit, linked or not, whoever made it.
    expect(knop(t("activiteit.verwijderAria", { naam: "Andermans spel" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Gekoppeld spel" }))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).toBeNull();
    // A hoofdleerkracht edits a thema only with themabeheer.
    expect(knop(t("themabeheer.bewerk"))).toBeNull();
    expect(knop(THEMAMENU)).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).toBeNull();
  });

  it("geeft themabeheer het thema, de themadoelen en de doelsuggesties, niet het verwijderen en niet de subthema's", async () => {
    toon(ikMet({ heeftThemabeheer: true }));
    await openHoofdstukken();

    expect(knop(t("themabeheer.bewerk"))).not.toBeNull();
    // A themadoel is a minimumdoel (FB-043): linked and unlinked here, and no leerplandoel picker on the thema.
    expect(knop(t("thema.minimumdoelKoppelen"))).not.toBeNull();
    expect(knop(t("thema.minimumdoelOntkoppel", { ref: "K-MD-1" }))).not.toBeNull();
    expect(knop(t("doelkiezer.koppel"))).toBeNull();
    expect(knop(t("thema.suggestiesVragen"))).not.toBeNull();
    // It calls the model, so it wears the AI ring (ADR-0039).
    expect(knop(t("thema.suggestiesVragen"))).toHaveClass("knop-ai");
    expect(await screen.findByText(SUGGESTIE.aiMotivatie)).toBeInTheDocument();
    expect(knop(t("voorstelstapel.aanvaardAria", { naam: "K-9.1.1" }))).not.toBeNull();
    expect(knop(t("voorstelstapel.weigerAria", { naam: "K-9.1.1" }))).not.toBeNull();

    // I26 needs a wizard run's state the frontend does not read, so the delete is admin's here: no "…" at all, since
    // it would hold nothing.
    expect(knop(THEMAMENU)).toBeNull();
    // Themabeheer holds nothing on the ordinary subthema and activiteit routes (I22).
    expect(knop(t("subthemabeheer.toevoegen"))).toBeNull();
    expect(knop(t("activiteit.toevoegen"))).toBeNull();
    expect(knop(t("activiteit.bekijkAria", { naam: "Eigen spel" }))).not.toBeNull();
  });

  it("geeft admin alles, ook het verwijderen van het thema", async () => {
    toon(ADMIN);
    await openHoofdstukken();

    expect(knop(t("themabeheer.bewerk"))).not.toBeNull();
    expect(await menu(THEMAMENU)).toEqual([t("themabeheer.verwijder")]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(knop(subthemamenu("Rekenen"))).not.toBeNull();
    expect(knop(t("activiteit.verwijderAria", { naam: "Tellen" }))).not.toBeNull();
  });

  it("verwijdert het thema via het menu naast Bewerken, na bevestiging zoals voordien (FB-094)", async () => {
    toon(ADMIN);
    await screen.findByText("Bladeren");
    await menu(THEMAMENU);
    fireEvent.click(screen.getByRole("menuitem", { name: t("themabeheer.verwijder") }));

    expect(await screen.findByRole("dialog", { name: t("themabeheer.verwijderTitel", { naam: "Herfst" }) })).toBeInTheDocument();
  });

  it("bewerkt een subthema via zijn menu, in het subthemaformulier van voordien (FB-094)", async () => {
    toon(ADMIN);
    await screen.findByText("Bladeren");
    await menu(subthemamenu("Bladeren"));
    fireEvent.click(screen.getByRole("menuitem", { name: t("themabeheer.bewerk") }));

    const blad = await screen.findByRole("dialog");
    expect(within(blad).getByDisplayValue("Bladeren")).toBeInTheDocument();
  });

  it("noemt bij een activiteit zonder soort geen soort, en begint niet met een scheiding (FB-050)", async () => {
    const zonderSoort = activiteit("a-leeg", "Zonder soort", { activiteitType: null, kleur: "Olijf" });
    const k3 = { ...THEMA.subthemas[0], activiteiten: [zonderSoort, activiteit("a-spel", "Met soort")] };
    toon(ADMIN, { thema: { ...THEMA, subthemas: [k3, THEMA.subthemas[1]] } });
    await openHoofdstukken();

    // Exact text: the colour alone, with no soort and no leading " · ".
    expect(screen.getByText(t(kleurSleutel("Olijf")))).toBeInTheDocument();
    expect(screen.getAllByText(t("activiteitsoort.Spel")).length).toBeGreaterThan(0);
  });

  it("opent een activiteit voor wie haar niet mag aanpassen als feiten, zonder Bewaren", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["L1"] }));
    await openHoofdstukken();
    fireEvent.click(screen.getByRole("button", { name: t("activiteit.bekijkAria", { naam: "Gekoppeld spel" }) }));

    const blad = await screen.findByRole("dialog");
    expect(
      within(blad).getByText(t("activiteit.duurFeit", { lesuren: t("activiteit.eenLesuur"), minuten: STANDAARDDUUR })),
    ).toBeInTheDocument();
    expect(within(blad).getByText("WO-2")).toBeInTheDocument();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) })).toBeNull();
    expect(within(blad).getByRole("button", { name: t("algemeen.sluiten") })).toBeInTheDocument();
  });

  // Fix round 1, F2: the empty thema is the one I26 case the thema read carries, and the server lets themabeheer
  // delete it (`HeeftAndermansInhoud` false, no linked leeftijd).
  it("geeft themabeheer de prullenbak op een leeg thema, zoals de server", async () => {
    toon(ikMet({ heeftThemabeheer: true }), { thema: { ...THEMA, themadoelen: [], subthemas: [] } });

    expect(await screen.findByRole("button", { name: THEMAMENU })).toBeInTheDocument();
    expect(await menu(THEMAMENU)).toEqual([t("themabeheer.verwijder")]);
  });

  // Fix round 1, F4: a form left open with no leeftijd to offer is a Bewaren that can only be refused, and it used to
  // blame the loading. When the rights go, the form goes.
  it("sluit het subthemaformulier wanneer er geen leeftijd meer is om het te maken", async () => {
    const client = toon(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));
    fireEvent.click(await screen.findByRole("button", { name: t("subthemabeheer.toevoegen") }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Awaited for one task: TanStack Query hands `setQueryData` to its observers on the next one.
    await act(async () => {
      client.setQueryData(["ik"], { ...ikMet({}), id: IK_ID });
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText(t("klasbeheer.leeftijdenOnbekend"))).toBeNull();
  });

  it("toont een voorgesteld minimumdoel met zijn mijlpaal en tekst, en aanvaarden stuurt die beslissing", async () => {
    toon(ikMet({ heeftThemabeheer: true }));

    await screen.findByText(SUGGESTIE.aiMotivatie);
    expect(screen.getByText("K-9.1.1")).toBeInTheDocument();
    // Once on the proposal, and once at the themadoelen' heading, which all share it (FB-094).
    expect(screen.getAllByText(t("minimumdoel.mijlpaalK"))).toHaveLength(2);
    expect(screen.getByText("De kleuters kunnen seizoenen onderscheiden.")).toBeInTheDocument();
    expect(screen.getByText(t("thema.suggesties"))).toBeInTheDocument();

    const fetchSpy = globalThis.fetch as unknown as { mock: { calls: [string, RequestInit | undefined][] } };
    const beslissingen = () =>
      fetchSpy.mock.calls
        .filter(([pad, init]) => init?.method === "PUT" && pad.endsWith("/doelsuggesties/sug-1/status"))
        .map(([, init]) => JSON.parse(String(init!.body)));

    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.aanvaardAria", { naam: "K-9.1.1" }) }));
    await waitFor(() => expect(beslissingen()).toEqual([{ status: "Aanvaard" }]));
  });

  it("toont de voorstellen in de volgorde van de server, het best passende eerst", async () => {
    // Owner ruling 2026-09-16: the model's order, which the server keeps as a rank. Not sorted by code here, and the
    // stack shows the first one on top.
    toon(ikMet({ heeftThemabeheer: true }), {
      suggesties: [
        { ...SUGGESTIE, id: "sug-b", minimumdoelRef: "K-9.9.9", aiMotivatie: "Past het best." },
        { ...SUGGESTIE, id: "sug-a", minimumdoelRef: "K-1.1.1", aiMotivatie: "Past ook." },
        { ...SUGGESTIE, id: "sug-c", minimumdoelRef: "K-5.5.5", aiMotivatie: "Beslist.", status: "Geweigerd" },
      ],
    });

    expect(await screen.findByText("Past het best.")).toBeInTheDocument();
    expect(screen.getByText(t("voorstelstapel.teller", { nummer: 1, totaal: 2 }))).toBeInTheDocument();
    expect(screen.queryByText("Past ook.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.weigerAria", { naam: "K-9.9.9" }) }));
    expect(await screen.findByText("Past ook.")).toBeInTheDocument();
    // A decided proposal is never on the stack.
    expect(screen.queryByText("Beslist.")).toBeNull();
  });

  it("zegt het wanneer de server een oordeel over een doelsuggestie weigert", async () => {
    toon(ikMet({ heeftThemabeheer: true }), { weiger: true });
    fireEvent.click(await screen.findByRole("button", { name: t("voorstelstapel.aanvaardAria", { naam: "K-9.1.1" }) }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Je hebt geen toegang tot deze actie.");
    // The refused suggestion is back on the stack, still waiting for a decision.
    expect(knop(t("voorstelstapel.aanvaardAria", { naam: "K-9.1.1" }))).not.toBeNull();
  });
});

describe("ThemadetailScherm: subthema's staan ingeklapt (FB-011)", () => {
  it("toont elk subthema ingeklapt, met zijn samenvatting in plaats van zijn lijsten", async () => {
    toon(ADMIN);
    await screen.findByText("Bladeren");

    const bladeren = hoofdstuk("Bladeren", false);
    expect(hoofdstuk("Rekenen", false)).toBeInTheDocument();
    expect(within(bladeren).getByText(telWoord(3, "thema.eenActiviteit", "thema.activiteiten"))).toBeInTheDocument();
    // Its one subdoel, WIS-1, is on none of its activiteiten (FB-010 wrote this figure).
    expect(within(bladeren).getByText(t("thema.subdoelInActiviteitEen", { aantal: 0 }))).toBeInTheDocument();
    expect(screen.queryByText("Eigen spel")).toBeNull();
    expect(screen.queryByText("Tellen")).toBeNull();
  });

  // The fold is a native button (`getByRole` above finds it with `aria-expanded`), which answers Enter and Space by
  // itself; jsdom does not turn a key press into a click, so the keyboard half is checked in the browser pass.
  it("klapt één subthema open met een klik, en bij een tweede klik weer in", async () => {
    toon(ADMIN);
    await screen.findByText("Bladeren");

    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();
    expect(screen.getByText("Eigen spel")).toBeInTheDocument();
    expect(hoofdstuk("Rekenen", false)).toBeInTheDocument();
    expect(screen.queryByText("Tellen")).toBeNull();

    fireEvent.click(hoofdstuk("Bladeren", true));
    expect(screen.queryByText("Eigen spel")).toBeNull();
  });

  it("toont in een opengeklapt subthema de onderzoeksvraag, het woordweb en de activiteiten zonder nog iets uit te klappen (FB-094)", async () => {
    const metVraag = {
      ...THEMA,
      subthemas: [
        { ...THEMA.subthemas[0], onderzoeksvragen: [{ id: "ov-1", vraag: "Waarom vallen de bladeren?", probleemstelling: null }] },
        THEMA.subthemas[1],
      ],
    } as ThemaWeergave;
    toon(ADMIN, { thema: metVraag });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    // In reading order: the question, the woordweb, then the activiteiten, each under a small heading of its own.
    const koppen = screen.getAllByRole("heading", { level: 5 }).map((kop) => kop.textContent ?? "");
    const vraag = koppen.indexOf(t("thema.onderzoeksvraagTitel"));
    const woordweb = koppen.indexOf(t("woordweb.titel"));
    expect(vraag).toBeGreaterThan(-1);
    expect(woordweb).toBeGreaterThan(vraag);
    expect(koppen.indexOf(t("thema.activiteitenTitel"))).toBeGreaterThan(woordweb);
    expect(screen.getByText("Waarom vallen de bladeren?")).toBeInTheDocument();
    // Three activiteiten: all of them at once, with nothing to fold open and no "Alle ... bekijken".
    expect(screen.getByText("Eigen spel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ALLE_ACTIVITEITEN })).toBeNull();
    // The subdoelen are one line with a link, shut.
    expect(screen.getByRole("button", { name: t("thema.subdoelenBekijken"), expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("WIS-1")).toBeNull();

    // Activiteiten by name, whatever order the server sent them in.
    const namen = screen
      .getAllByRole("button", { name: /^Activiteit .* (bekijken|bewerken)$/ })
      .map((knop) => knop.getAttribute("aria-label"));
    expect(namen).toEqual(
      ["Andermans spel", "Eigen spel", "Gekoppeld spel"].map((naam) => t("activiteit.bewerkAria", { naam })),
    );
  });

  it("toont de eerste drie activiteiten, en de rest na Alle bekijken (FB-094)", async () => {
    toon(ADMIN, { thema: { ...THEMA, subthemas: [{ ...THEMA.subthemas[0], activiteiten: [...THEMA.subthemas[0].activiteiten, activiteit("a-vier", "Vierde spel")] }, THEMA.subthemas[1]] } });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    expect(screen.getByText("Andermans spel")).toBeInTheDocument();
    expect(screen.queryByText("Vierde spel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t("thema.alleBekijken", { aantal: 4 }), expanded: false }));
    expect(screen.getByText("Vierde spel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("thema.minderTonen"), expanded: true }));
    expect(screen.queryByText("Vierde spel")).toBeNull();
  });

  it("vindt een activiteit met het zoekicoon, ook buiten de eerste drie (TB-051)", async () => {
    toon(ADMIN, { thema: { ...THEMA, subthemas: [{ ...THEMA.subthemas[0], activiteiten: [...THEMA.subthemas[0].activiteiten, activiteit("a-vier", "Vierde spel")] }, THEMA.subthemas[1]] } });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    fireEvent.click(screen.getByRole("button", { name: t("lijst.zoekIn", { lijst: t("thema.lijstActiviteiten") }) }));
    fireEvent.change(screen.getByRole("textbox", { name: t("lijst.zoekIn", { lijst: t("thema.lijstActiviteiten") }) }), {
      target: { value: "vierde" },
    });

    expect(screen.getByText("Vierde spel")).toBeInTheDocument();
    expect(screen.queryByText("Eigen spel")).toBeNull();
  });
});

describe("ThemadetailScherm: subthema's van één leeftijd delen hun leeftijdslabel (FB-047)", () => {
  const k2 = (id: string, naam: string, duurWeken: number) => ({
    ...THEMA.subthemas[0],
    id,
    naam,
    duurWeken,
    leeftijd: "K2",
    subdoelen: [],
    activiteiten: [],
  });
  const DRIE: ThemaWeergave = {
    ...THEMA,
    subthemas: [k2("s-k2a", "Bladeren verzamelen", 2), THEMA.subthemas[0], k2("s-k2b", "Bladeren herkennen", 3)],
  };
  // The K3 chapter is "Bladeren", which both K2 names start with, so it is found by the sr-only leeftijd that follows
  // its name. jsdom, like Chrome, may put a space before that comma, so the patterns allow one.
  const K3_NAAM = "Bladeren\\s?,";
  const metLeeftijd = (naam: string, leeftijd: string) =>
    new RegExp(`^${naam}\\s?${t("thema.subthemaLeeftijd", { leeftijd })}`);
  /** The leeftijd block a chapter hangs in: the section around its fold, while it is shut. */
  const leeftijdsblok = (naam: string) => hoofdstuk(naam, false).closest("section")!;

  it("zet elke leeftijd één keer als kop, met haar subthema's samen in één lijst eronder", async () => {
    toon(ADMIN, { thema: DRIE });
    await screen.findByText("Bladeren verzamelen");

    const voorK2 = t("thema.voorLeeftijd", { leeftijd: "K2" });
    const voorK3 = t("thema.voorLeeftijd", { leeftijd: "K3" });
    const blokK2 = leeftijdsblok("Bladeren verzamelen");
    expect(leeftijdsblok("Bladeren herkennen")).toBe(blokK2);
    expect(within(blokK2).getAllByRole("heading", { name: voorK2 })).toHaveLength(1);
    expect(within(blokK2).getAllByRole("list")).toHaveLength(1);

    const blokK3 = leeftijdsblok(K3_NAAM);
    expect(blokK3).not.toBe(blokK2);
    expect(within(blokK3).getAllByRole("heading", { name: voorK3 })).toHaveLength(1);
    expect(within(blokK2).queryByRole("heading", { name: voorK3 })).toBeNull();

    // Each subthema carries its own duration.
    expect(hoofdstuk("Bladeren verzamelen", false)).toHaveTextContent(telWoord(2, "thema.eenWeek", "thema.weken"));
    expect(hoofdstuk("Bladeren herkennen", false)).toHaveTextContent(telWoord(3, "thema.eenWeek", "thema.weken"));
  });

  it("noemt de leeftijd in de naam van elke vouwknop, voor wie van kop naar kop springt", async () => {
    toon(ADMIN, { thema: DRIE });
    await screen.findByText("Bladeren verzamelen");

    expect(hoofdstuk("Bladeren verzamelen", false)).toHaveAccessibleName(metLeeftijd("Bladeren verzamelen", "K2"));
    expect(hoofdstuk("Bladeren herkennen", false)).toHaveAccessibleName(metLeeftijd("Bladeren herkennen", "K2"));
    expect(hoofdstuk(K3_NAAM, false)).toHaveAccessibleName(metLeeftijd("Bladeren", "K3"));
  });

  it("laat het andere subthema van dezelfde leeftijd dicht wanneer men er één openklapt", async () => {
    toon(ADMIN, { thema: DRIE });
    await screen.findByText("Bladeren herkennen");

    fireEvent.click(hoofdstuk("Bladeren herkennen", false));

    expect(hoofdstuk("Bladeren herkennen", true)).toBeInTheDocument();
    expect(hoofdstuk("Bladeren verzamelen", false)).toBeInTheDocument();
    // Open, the card still shows its duration.
    expect(hoofdstuk("Bladeren herkennen", true)).toHaveTextContent(telWoord(3, "thema.eenWeek", "thema.weken"));
  });
});

describe("ThemadetailScherm: een link vanuit de agenda opent één subthema (FB-037)", () => {
  it("klapt het gevraagde subthema open, geeft zijn knop de focus en laat de andere ingeklapt", async () => {
    toon(ADMIN, { pad: "/themas/thema-1?subthema=s-l1" });
    await screen.findByText("Rekenen");

    const rekenen = await waitFor(() => hoofdstuk("Rekenen", true));
    openLijsten();
    expect(rekenen).toHaveFocus();
    expect(screen.getByText("Tellen")).toBeInTheDocument();
    expect(hoofdstuk("Bladeren", false)).toBeInTheDocument();
  });

  it("opent niets voor een subthema dat niet bij dit thema hoort", async () => {
    toon(ADMIN, { pad: "/themas/thema-1?subthema=elders" });
    await screen.findByText("Rekenen");

    expect(hoofdstuk("Rekenen", false)).toBeInTheDocument();
    expect(hoofdstuk("Bladeren", false)).toBeInTheDocument();
  });
});

describe("ThemadetailScherm: welke subdoelen al een activiteit hebben (FB-010)", () => {
  // Three subdoelen: one on two activiteiten, one on one, one on none; and an activiteit doel that is no subdoel.
  const MET_DRAGERS: ThemaWeergave = {
    ...THEMA,
    subthemas: [
      {
        ...THEMA.subthemas[0],
        subdoelen: [
          { id: "sd-a", leeftijd: "K3", koppeling: koppeling("WIS-1") },
          { id: "sd-b", leeftijd: "K3", koppeling: koppeling("WIS-2") },
          { id: "sd-c", leeftijd: "K3", koppeling: koppeling("WIS-3") },
        ],
        activiteiten: [
          activiteit("a-1", "Tellen met bladeren", { doelkoppelingen: [koppeling("WIS-1"), koppeling("WIS-2")] }),
          activiteit("a-2", "Bladeren wegen", { doelkoppelingen: [koppeling("WIS-1"), koppeling("NED-9")] }),
        ],
      },
    ],
  };

  /** Asserts that `eerst` precedes `daarna` in the chapter button, whose accessible name follows this DOM order. */
  const verwachtVoor = (knop: HTMLElement, eerst: string, daarna: string) => {
    const tekst = knop.textContent ?? "";
    expect(tekst).toContain(eerst);
    expect(tekst).toContain(daarna);
    expect(tekst.indexOf(eerst)).toBeLessThan(tekst.indexOf(daarna));
  };

  /** The rows of one Subkop in the open chapter, found by its heading. */
  const groep = (titel: string) => screen.getByRole("heading", { name: titel }).closest("section")!;
  // The doel row's own button: the remove control beside it names the code too, but in an `aria-label`.
  const rij = (sectie: HTMLElement, code: string) => {
    const knoppen = within(sectie).getAllByRole("button", { name: new RegExp(code) });
    const regel = knoppen.find((k) => !k.hasAttribute("aria-label"));
    if (!regel) throw new Error(`no doel row for ${code}`);
    return regel;
  };

  it("toont bij elk subdoel zijn activiteiten, en markeert een subdoel zonder activiteit met tekst", async () => {
    toon(ADMIN, { thema: MET_DRAGERS });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();

    const subdoelen = groep(t("thema.subdoelenTitel"));
    expect(rij(subdoelen, "WIS-1")).toHaveTextContent(
      t("thema.inActiviteiten", { aantal: 2, namen: "Tellen met bladeren, Bladeren wegen" }),
    );
    expect(rij(subdoelen, "WIS-2")).toHaveTextContent(t("thema.inEenActiviteit", { namen: "Tellen met bladeren" }));
    expect(rij(subdoelen, "WIS-3")).toHaveTextContent(t("thema.nogGeenActiviteit"));
    expect(rij(subdoelen, "WIS-1")).not.toHaveTextContent(t("thema.nogGeenActiviteit"));
  });

  it("zet een doel van een activiteit dat geen subdoel is apart, met die activiteit", async () => {
    toon(ADMIN, { thema: MET_DRAGERS });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();

    const andere = groep(t("thema.andereDoelenTitel"));
    expect(rij(andere, "NED-9")).toHaveTextContent(t("thema.inEenActiviteit", { namen: "Bladeren wegen" }));
    expect(within(andere).queryByRole("button", { name: /WIS-/ })).toBeNull();
  });

  it("vat een ingeklapt subthema samen met hoeveel subdoelen al in een activiteit zitten", async () => {
    toon(ADMIN, { thema: MET_DRAGERS });
    await screen.findByText("Bladeren");

    expect(
      within(hoofdstuk("Bladeren", false)).getByText(t("thema.subdoelenInActiviteit", { aantal: 2, totaal: 3 })),
    ).toBeInTheDocument();
    // FB-048: the subdoelen figure comes before the activiteiten figure.
    verwachtVoor(
      hoofdstuk("Bladeren", false),
      t("thema.subdoelenInActiviteit", { aantal: 2, totaal: 3 }),
      telWoord(2, "thema.eenActiviteit", "thema.activiteiten"),
    );
  });

  it("geeft een subthema zonder subdoelen de gewone telling", async () => {
    toon(ADMIN, { thema: { ...THEMA, subthemas: [{ ...THEMA.subthemas[0], subdoelen: [] }] } });
    await screen.findByText("Bladeren");

    expect(
      within(hoofdstuk("Bladeren", false)).getByText(telWoord(0, "thema.eenSubdoel", "thema.subdoelen")),
    ).toBeInTheDocument();
    verwachtVoor(
      hoofdstuk("Bladeren", false),
      telWoord(0, "thema.eenSubdoel", "thema.subdoelen"),
      telWoord(THEMA.subthemas[0].activiteiten.length, "thema.eenActiviteit", "thema.activiteiten"),
    );
  });

  it("toont geen groep andere doelen wanneer elk doel van een activiteit een subdoel is", async () => {
    const alleenSubdoelen: ThemaWeergave = {
      ...MET_DRAGERS,
      subthemas: [
        {
          ...MET_DRAGERS.subthemas[0],
          activiteiten: [activiteit("a-1", "Tellen met bladeren", { doelkoppelingen: [koppeling("WIS-1")] })],
        },
      ],
    };
    toon(ADMIN, { thema: alleenSubdoelen });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();

    // The chapter is open: its subdoelen are on screen, and only the other group is absent.
    expect(groep(t("thema.subdoelenTitel"))).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: t("thema.andereDoelenTitel") })).toBeNull();
  });

  /** Opens the unlink confirmation of one subdoel and returns it (TB-051). */
  async function ontkoppelVraag(thema: ThemaWeergave, code: string) {
    toon(ADMIN, { thema });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();
    fireEvent.click(screen.getByRole("button", { name: t("activiteit.ontkoppel", { code }) }));
    return screen.findByRole("dialog", { name: t("thema.subdoelOntkoppelTitel", { code }) });
  }

  it("zegt bij het ontkoppelen dat een subdoel via zijn activiteiten blijft meetellen (TB-051)", async () => {
    const vraag = await ontkoppelVraag(MET_DRAGERS, "WIS-1");
    expect(vraag).toHaveTextContent(
      t("thema.subdoelOntkoppelGevolg", { code: "WIS-1", subthema: "Bladeren", leeftijd: "K3" }),
    );
    expect(vraag).toHaveTextContent(
      t("thema.subdoelOntkoppelBlijftMeer", { aantal: 2, namen: "Tellen met bladeren, Bladeren wegen" }),
    );
    expect(vraag).not.toHaveTextContent(t("thema.subdoelOntkoppelGeenDrager"));
  });

  it("noemt de ene activiteit die het subdoel nog draagt (TB-051)", async () => {
    const vraag = await ontkoppelVraag(MET_DRAGERS, "WIS-2");
    expect(vraag).toHaveTextContent(t("thema.subdoelOntkoppelBlijftEen", { namen: "Tellen met bladeren" }));
  });

  it("zegt bij een subdoel zonder dragende activiteit dat het via dit subthema niet meer meetelt (TB-051)", async () => {
    const vraag = await ontkoppelVraag(MET_DRAGERS, "WIS-3");
    expect(vraag).toHaveTextContent(t("thema.subdoelOntkoppelGeenDrager"));
  });

  it("zegt bij een onbeslist subdoel niets over de dekking (TB-051)", async () => {
    const voorgesteld: ThemaWeergave = {
      ...MET_DRAGERS,
      subthemas: [
        {
          ...MET_DRAGERS.subthemas[0],
          subdoelen: [{ id: "sd-v", leeftijd: "K3", koppeling: { ...koppeling("WIS-7"), status: "Voorgesteld" } }],
        },
      ],
    };
    const vraag = await ontkoppelVraag(voorgesteld, "WIS-7");
    expect(vraag).toHaveTextContent(t("thema.subdoelOntkoppelOnbeslist", { code: "WIS-7", subthema: "Bladeren" }));
    expect(vraag).not.toHaveTextContent(/dekking/);
  });

  it("markeert een subdoel dat nog niet beslist is niet als gat", async () => {
    const voorgesteld: ThemaWeergave = {
      ...MET_DRAGERS,
      subthemas: [
        {
          ...MET_DRAGERS.subthemas[0],
          subdoelen: [{ id: "sd-v", leeftijd: "K3", koppeling: { ...koppeling("WIS-7"), status: "Voorgesteld" } }],
          activiteiten: [],
        },
      ],
    };
    toon(ADMIN, { thema: voorgesteld });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();

    const regel = rij(groep(t("thema.subdoelenTitel")), "WIS-7");
    expect(regel).not.toHaveTextContent(t("thema.nogGeenActiviteit"));
  });
});

describe("ThemadetailScherm: doelen per leeftijd, de leerplandoelen van de minimumdoelen (FB-009, TB-048)", () => {
  const leerplandoel = (code: string, tekst: string, extra: Partial<OverzichtLeerplandoel> = {}): OverzichtLeerplandoel => ({
    code,
    doelsoort: "Gemeenschappelijk",
    tekst,
    nietMeerInOpstap: false,
    minimumdoelRef: "K-7",
    plaatsen: [],
    ...extra,
  });

  const OVERZICHT: ThemaDoelenoverzicht = {
    themaId: "thema-1",
    leeftijden: [
      {
        leeftijd: "K2",
        leerplandoelen: [leerplandoel("WIS-2", "Vormen herkennen")],
        buitenMinimumdoelen: [],
      },
      {
        leeftijd: "K3",
        leerplandoelen: [leerplandoel("WIS-1", "Tellen tot tien"), leerplandoel("WIS-3", "Meten met de voet")],
        buitenMinimumdoelen: [
          leerplandoel("NED-1", "Luisteren naar een verhaal", {
            minimumdoelRef: "K-9",
            plaatsen: [
              { soort: "Subdoel", naam: "Bladeren" },
              { soort: "Activiteit", naam: "Eigen spel" },
              { soort: "Activiteit", naam: "Andermans spel" },
            ],
          }),
        ],
      },
    ],
  };

  const rijnaam = (leeftijd: string) => new RegExp(`^${t("thema.leerplandoelenVoor", { leeftijd })}`);
  const leeftijdrij = (leeftijd: string) => screen.findByRole("button", { name: rijnaam(leeftijd), expanded: false });
  /** The lists under the K3 row, once opened. */
  const lijst = () => within(screen.getByRole("button", { name: rijnaam("K3"), expanded: true }).closest("li")!);
  /** The leerplandoelen figure in the summary under the title (FB-094). */
  const samenvattingLeerplandoelen = () =>
    within(screen.getByLabelText(t("thema.samenvatting"))).getByText(t("thema.overzichtLeerplandoelWoordMeer")).parentElement;

  it("telt per leeftijd de leerplandoelen van de minimumdoelen, en de koppelingen erbuiten apart", async () => {
    toon(ADMIN, { overzicht: OVERZICHT });

    expect(await leeftijdrij("K2")).toHaveTextContent(
      telWoord(1, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen"),
    );
    const k3 = await leeftijdrij("K3");
    expect(k3).toHaveTextContent(telWoord(2, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen"));
    expect(k3).toHaveTextContent(telWoord(1, "thema.overzichtEenBuiten", "thema.overzichtBuiten"));
    // The summary counts the list only: three, not four.
    expect(samenvattingLeerplandoelen()).toHaveTextContent("3");
    expect(screen.queryByRole("button", { name: /WIS-1/ })).toBeNull();
  });

  it("toont opengeklapt de lijst zonder plaatsen, en de koppelingen erbuiten met waar ze hangen", async () => {
    toon(ADMIN, { overzicht: OVERZICHT });
    fireEvent.click(await leeftijdrij("K3"));

    const wis1 = lijst().getByRole("button", { name: /WIS-1/ });
    expect(wis1).not.toHaveTextContent(t("thema.overzichtVia", { lijst: "" }).trim());
    expect(lijst().getByRole("heading", { name: t("thema.overzichtBuitenTitel") })).toBeInTheDocument();
    const plaatsen = [
      t("thema.plaatsSubdoel", { naam: "Bladeren" }),
      telWoord(2, "thema.plaatsEenActiviteit", "thema.plaatsActiviteiten"),
    ].join(", ");
    expect(lijst().getByRole("button", { name: /NED-1/ })).toHaveTextContent(t("thema.overzichtVia", { lijst: plaatsen }));
    expect(lijst().getAllByRole("listitem")).toHaveLength(3);
  });

  it("toont geen kop voor koppelingen erbuiten als er geen zijn", async () => {
    toon(ADMIN, { overzicht: OVERZICHT });
    const k2 = await leeftijdrij("K2");
    expect(k2).not.toHaveTextContent(t("thema.overzichtBuiten", { aantal: 0 }));
    fireEvent.click(k2);

    const lijstK2 = within(screen.getByRole("button", { name: rijnaam("K2"), expanded: true }).closest("li")!);
    expect(lijstK2.getByRole("button", { name: /WIS-2/ })).toBeInTheDocument();
    expect(lijstK2.queryByRole("heading")).toBeNull();
  });

  it("zegt geen leerplandoelen bij een leeftijd met alleen koppelingen buiten de minimumdoelen", async () => {
    toon(ADMIN, {
      overzicht: {
        themaId: "thema-1",
        leeftijden: [{ ...OVERZICHT.leeftijden[1], leerplandoelen: [] }],
      },
    });

    const k3 = await leeftijdrij("K3");
    expect(k3).toHaveTextContent(t("thema.overzichtGeenLeerplandoelen"));
    expect(samenvattingLeerplandoelen()).toHaveTextContent("0");
  });

  it("vraagt het overzicht opnieuw op na het ontkoppelen van een minimumdoel", async () => {
    toon(ADMIN, { overzicht: OVERZICHT });
    await leeftijdrij("K3");
    openLijsten();
    const overzichtLezingen = () =>
      vi.mocked(fetch).mock.calls.filter(([pad, init]) => String(pad).endsWith("/doelenoverzicht") && !init?.method).length;
    const voor = overzichtLezingen();

    fireEvent.click(await screen.findByRole("button", { name: t("thema.minimumdoelOntkoppel", { ref: "K-MD-1" }) }));
    fireEvent.click(await screen.findByRole("button", { name: t("thema.ontkoppelBevestig") }));

    await waitFor(() => expect(overzichtLezingen()).toBeGreaterThan(voor));
  });

  it("opent een leerplandoel in het detailblad", async () => {
    toon(ADMIN, { overzicht: OVERZICHT });
    fireEvent.click(await leeftijdrij("K3"));

    fireEvent.click(lijst().getByRole("button", { name: /WIS-1/ }));

    expect(await screen.findByRole("dialog", { name: t("doel.titel") })).toBeInTheDocument();
  });

  it("toont geen blok zolang er niets te tonen is", async () => {
    toon(ADMIN);
    await screen.findByText("Bladeren");

    // First that the overview was asked for at all, so the absence below is an answer and not a component never mounted.
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([pad]) => String(pad).endsWith("/doelenoverzicht"))).toBe(true),
    );
    // It shows a placeholder while loading; the answer (no leeftijden) leaves no row behind.
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Leerplandoelen voor/ })).toBeNull());
  });
});

describe("ThemadetailScherm: een activiteit toont het aantal doelen, niet hun codes (FB-046)", () => {
  const MET_DOELEN: ThemaWeergave = {
    ...THEMA,
    subthemas: [
      {
        ...THEMA.subthemas[0],
        subdoelen: [],
        activiteiten: [
          activiteit("a-3", "Drie doelen", {
            doelkoppelingen: [koppeling("WIS-11"), koppeling("WIS-12"), koppeling("NED-13")],
          }),
          activiteit("a-1", "Een doel", { doelkoppelingen: [koppeling("WIS-14")] }),
          activiteit("a-0", "Geen doel"),
        ],
      },
    ],
  };

  /** One activiteit row: the box that holds its opening overlay. */
  const regel = (naam: string) =>
    screen.getByRole("button", { name: t("activiteit.bekijkAria", { naam }) }).parentElement!;

  async function open(ik: Ik = ADMIN) {
    toon(ik, { thema: MET_DOELEN });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));
    openLijsten();
  }

  it("telt de doelen in het meervoud en in het enkelvoud, zonder een doelcode", async () => {
    await open(ikMet({}));

    expect(regel("Drie doelen")).toHaveTextContent(telWoord(3, "activiteit.eenDoel", "activiteit.aantalDoelen"));
    expect(regel("Een doel")).toHaveTextContent(telWoord(1, "activiteit.eenDoel", "activiteit.aantalDoelen"));
    expect(regel("Een doel")).toHaveTextContent("1 doel");
    for (const naam of ["Drie doelen", "Een doel", "Geen doel"]) {
      expect(regel(naam)).not.toHaveTextContent(/WIS-|NED-/);
    }
  });

  it("maakt een activiteit zonder doel herkenbaar met tekst", async () => {
    await open(ikMet({}));

    expect(regel("Geen doel")).toHaveTextContent(t("activiteit.geenDoel"));
    expect(regel("Drie doelen")).not.toHaveTextContent(t("activiteit.geenDoel"));
  });

  it("toont in de regel geen doelkoppelaar, ook niet voor wie mag koppelen (TB-051)", async () => {
    await open(ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }));

    // A doel is linked to an activiteit in its own sheet, which the row opens: the row holds only that and the bin.
    const knoppen = within(screen.getByRole("button", { name: t("activiteit.bewerkAria", { naam: "Drie doelen" }) }).parentElement!)
      .getAllByRole("button")
      .map((k) => k.getAttribute("aria-label"));
    expect(knoppen).toEqual([
      t("activiteit.bewerkAria", { naam: "Drie doelen" }),
      t("activiteit.verwijderAria", { naam: "Drie doelen" }),
    ]);
    expect(screen.getAllByText(telWoord(3, "activiteit.eenDoel", "activiteit.aantalDoelen"))).not.toHaveLength(0);
  });
});

describe("ThemadetailScherm: de AI plaatst de leerplandoelen van de themadoelen (FB-057)", () => {
  const PLAATSING: SubdoelplaatsingOverzicht = {
    themaId: "thema-1",
    leeftijden: [
      {
        leeftijd: "K3",
        aantalOpen: 3,
        magBeslissen: true,
        heeftSubthema: true,
        subdoelvoorstellen: [
          {
            id: "v-1",
            leerplandoelCode: "WO-5",
            tekst: "Herkent dieren die zich voorbereiden op de winter",
            doelsoort: "Gemeenschappelijk",
            subthemaId: "s-k3",
            aiMotivatie: "Past bij bladeren en egels.",
          },
        ],
        subthemavoorstellen: [
          {
            id: "n-1",
            naam: "Regen en wind",
            onderzoeksvraag: "Waar komt de regen vandaan?",
            duurWeken: 2,
            aiMotivatie: "Geen subthema gaat over het weer.",
            doelen: [
              { id: "v-2", leerplandoelCode: "WO-9", tekst: "Benoemt neerslag", doelsoort: null, subthemaId: null, aiMotivatie: "Weer." },
              { id: "v-3", leerplandoelCode: "WO-11", tekst: "Maakt wind zichtbaar", doelsoort: null, subthemaId: null, aiMotivatie: "Wind." },
            ],
          },
        ],
      },
      { leeftijd: "L1", aantalOpen: 2, magBeslissen: false, subdoelvoorstellen: [], subthemavoorstellen: [], heeftSubthema: true },
    ],
  };

  const HL_K3 = ikMet({ hoofdleerkrachtLeeftijden: ["K3"] });
  const aiKnoppen = () => screen.queryAllByRole("button", { name: t("plaatsing.vraag") });

  it("toont per leeftijd het open aantal, en de AI-knop alleen waar men mag vragen", async () => {
    toon(HL_K3, { plaatsing: PLAATSING });

    expect(await screen.findByText(telWoord(3, "plaatsing.eenOpen", "plaatsing.open"))).toBeInTheDocument();
    expect(screen.getByText(telWoord(2, "plaatsing.eenOpen", "plaatsing.open"))).toBeInTheDocument();
    expect(aiKnoppen()).toHaveLength(1);
  });

  it("toont een leeftijd zonder subthema met haar open aantal en de AI-knop, op haar plaats in de jaarfasen (FB-062)", async () => {
    const schrijf = vi.fn((): Response | undefined => new Response(JSON.stringify({ isGeslaagd: true, aantalVoorgesteld: 4, aantalNieuweSubthemas: 1, aantalOvergeslagen: 0, fout: null })));
    const zonderSubthema: SubdoelplaatsingOverzicht = {
      ...PLAATSING,
      leeftijden: [
        { leeftijd: "K2", aantalOpen: 4, magBeslissen: true, subdoelvoorstellen: [], subthemavoorstellen: [], heeftSubthema: false },
        ...PLAATSING.leeftijden,
      ],
    };
    toon(ikMet({ hoofdleerkrachtLeeftijden: ["K2", "K3"] }), { plaatsing: zonderSubthema, schrijf });

    const k2 = await screen.findByText(telWoord(4, "plaatsing.eenOpen", "plaatsing.open"));
    const k3 = screen.getByText(telWoord(3, "plaatsing.eenOpen", "plaatsing.open"));
    // K2 comes before K3, as the subthema's are ordered, although the thema holds no K2 subthema.
    expect(k2.compareDocumentPosition(k3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aiKnoppen()).toHaveLength(2);

    fireEvent.click(aiKnoppen()[0]);
    await waitFor(() =>
      expect(schrijf).toHaveBeenCalledWith("POST", "/api/themas/thema-1/subdoelplaatsing/K2/genereer", undefined),
    );
  });

  it("toont een voorgesteld subdoel in zijn subthema met de vage ring, een label en stille beslisknoppen", async () => {
    toon(HL_K3, { plaatsing: PLAATSING });
    await screen.findByText("Bladeren");

    // Shut, the chapter says it holds a proposal (FB-011).
    expect(hoofdstuk("Bladeren", false)).toHaveTextContent(telWoord(1, "plaatsing.eenOpenVoorstel", "plaatsing.openVoorstellen"));
    fireEvent.click(hoofdstuk("Bladeren", false));

    const lijst = screen.getByRole("list", { name: t("plaatsing.voorgesteldeSubdoelen") });
    const voorstel = within(lijst).getByRole("listitem");
    expect(voorstel).toHaveClass("voorstel-ai");
    expect(voorstel).toHaveTextContent(t("plaatsing.aiVoorstel"));
    expect(voorstel).toHaveTextContent(t("status.Voorgesteld"));
    expect(voorstel).toHaveTextContent("Past bij bladeren en egels.");
    const aanvaard = within(voorstel).getByRole("button", { name: `${t("plaatsing.aanvaard")}: WO-5` });
    expect(aanvaard).toHaveAttribute("title", t("plaatsing.aanvaard"));
    expect(within(voorstel).getByRole("button", { name: `${t("plaatsing.weiger")}: WO-5` })).toBeInTheDocument();
  });

  it("stuurt een beslissing over een voorgesteld subdoel naar de server", async () => {
    const schrijf = vi.fn((): Response | undefined => new Response(null, { status: 204 }));
    toon(HL_K3, { plaatsing: PLAATSING, schrijf });
    await screen.findByText("Bladeren");
    fireEvent.click(hoofdstuk("Bladeren", false));

    fireEvent.click(screen.getByRole("button", { name: `${t("plaatsing.weiger")}: WO-5` }));

    await waitFor(() =>
      expect(schrijf).toHaveBeenCalledWith("PUT", "/api/subdoelvoorstellen/v-1/status", { status: "Geweigerd" }),
    );
  });

  it("laat een voorgesteld nieuw subthema eerst aanpassen en maakt het met de gekozen doelen", async () => {
    const schrijf = vi.fn((): Response | undefined => new Response(null, { status: 204 }));
    toon(HL_K3, { plaatsing: PLAATSING, schrijf });

    const kaart = await screen.findByRole("article", { name: t("plaatsing.nieuwSubthemaAria", { naam: "Regen en wind" }) });
    expect(kaart).toHaveClass("voorstel-ai");
    expect(kaart).toHaveTextContent("Waar komt de regen vandaan?");
    expect(kaart).toHaveTextContent(t("plaatsing.nieuwSubthema"));

    fireEvent.click(within(kaart).getByRole("button", { name: `${t("plaatsing.pasAan")}: Regen en wind` }));
    fireEvent.change(within(kaart).getByLabelText(t("plaatsing.naam")), { target: { value: "Regen" } });
    fireEvent.change(within(kaart).getByLabelText(t("plaatsing.duurWeken")), { target: { value: "3" } });
    fireEvent.click(within(kaart).getByRole("checkbox", { name: /WO-11/ }));
    fireEvent.click(within(kaart).getByRole("button", { name: t("plaatsing.maakSubthema") }));

    await waitFor(() =>
      expect(schrijf).toHaveBeenCalledWith("PUT", "/api/subthemavoorstellen/n-1/beslissing", {
        status: "Aanvaard",
        naam: "Regen",
        onderzoeksvraag: "Waar komt de regen vandaan?",
        duurWeken: 3,
        leerplandoelCodes: ["WO-9"],
      }),
    );
  });

  it("weigert een nieuw subthema zonder doelen en zegt waarom", async () => {
    const schrijf = vi.fn((): Response | undefined => new Response(null, { status: 204 }));
    toon(HL_K3, { plaatsing: PLAATSING, schrijf });
    const kaart = await screen.findByRole("article", { name: t("plaatsing.nieuwSubthemaAria", { naam: "Regen en wind" }) });

    fireEvent.click(within(kaart).getByRole("button", { name: `${t("plaatsing.pasAan")}: Regen en wind` }));
    for (const vak of within(kaart).getAllByRole("checkbox")) fireEvent.click(vak);
    fireEvent.click(within(kaart).getByRole("button", { name: t("plaatsing.maakSubthema") }));

    expect(within(kaart).getByRole("alert")).toHaveTextContent(t("plaatsing.minstensEenDoel"));
    expect(schrijf).not.toHaveBeenCalled();
  });

  it("vraagt de AI om plaatsen voor één leeftijd en zegt wat er terugkwam", async () => {
    const schrijf = vi.fn((_methode: string, pad: string): Response | undefined =>
      pad.endsWith("/subdoelplaatsing/K3/genereer")
        ? json({ isGeslaagd: true, aantalVoorgesteld: 3, aantalNieuweSubthemas: 1, aantalOvergeslagen: 0, fout: null })
        : undefined,
    );
    toon(HL_K3, { plaatsing: PLAATSING, schrijf });

    const [vraag] = await waitFor(() => {
      const gevonden = aiKnoppen();
      expect(gevonden).toHaveLength(1);
      return gevonden;
    });
    fireEvent.click(vraag);

    expect(
      await screen.findByText(
        t("plaatsing.voorstellenMetNieuw", {
          doelen: telWoord(3, "plaatsing.eenVoorstel", "plaatsing.voorstellen"),
          nieuw: telWoord(1, "plaatsing.eenNieuw", "plaatsing.nieuw"),
        }),
      ),
    ).toBeInTheDocument();
    expect(schrijf).toHaveBeenCalledWith("POST", "/api/themas/thema-1/subdoelplaatsing/K3/genereer", undefined);
  });

  it("toont wie niet mag beslissen alleen het open aantal", async () => {
    const zonderRecht: SubdoelplaatsingOverzicht = {
      themaId: "thema-1",
      leeftijden: PLAATSING.leeftijden.map((l) => ({ ...l, magBeslissen: false, subdoelvoorstellen: [], subthemavoorstellen: [] })),
    };
    toon(ikMet({ leerkrachtLeeftijden: ["K3"] }), { plaatsing: zonderRecht });

    expect(await screen.findByText(telWoord(3, "plaatsing.eenOpen", "plaatsing.open"))).toBeInTheDocument();
    expect(aiKnoppen()).toHaveLength(0);
    expect(screen.queryByRole("article")).toBeNull();
    fireEvent.click(hoofdstuk("Bladeren", false));
    expect(screen.queryByRole("list", { name: t("plaatsing.voorgesteldeSubdoelen") })).toBeNull();
  });
});

/**
 * The summary in the fiche's margin, and the one thing about it a teacher can trip over (TB-039).
 *
 * It adds up koppelingen at three depths, not distinct leerplandoelen, because `totaal` doubles as what a delete of
 * this thema removes. So a leerplandoel hanging under two subthema's is counted twice, and the label says
 * "Doelkoppelingen" to make that readable instead of making it look like a miscount.
 */
describe("ThemadetailScherm: de samenvatting telt koppelingen (TB-039)", () => {
  /** The K3 and the L1 subthema each link WIS-1: two koppelingen, one leerplandoel. */
  const DUBBEL: ThemaWeergave = {
    ...THEMA,
    subthemas: [
      THEMA.subthemas[0],
      { ...THEMA.subthemas[1], subdoelen: [{ id: "sd-2", leeftijd: "L1", koppeling: koppeling("WIS-1") }] },
    ],
  };

  /** The line under the "Doelen" heading (FB-094). */
  const samenvatting = async () => screen.findByText(/^Gekoppeld:/);

  it("noemt het koppelingen, en telt er twee waar één leerplandoel onder twee subthema's hangt", async () => {
    toon(ADMIN, { thema: DUBBEL });

    // The line has to name the koppeling, because that word is the whole explanation of its figures.
    expect(t("thema.gekoppeld", { lijst: "" }).toLowerCase()).toContain("gekoppeld");
    // "2 op subthema's" while the two chapters together show WIS-1 and nothing else.
    expect(await samenvatting()).toHaveTextContent(`2 ${t("thema.doelenOpSubthemas")}`);
    await openHoofdstukken();
    expect(screen.getAllByText("WIS-1")).toHaveLength(2);
    expect(screen.queryByText("REK-1")).toBeNull();
  });

  it("laat de telling van een thema zonder dubbele koppeling ongemoeid", async () => {
    toon(ADMIN);

    const regel = await samenvatting();
    expect(regel).toHaveTextContent(`1 ${t("thema.doelenOpThema")}`);
    expect(regel).toHaveTextContent(`2 ${t("thema.doelenOpSubthemas")}`);
    expect(regel).toHaveTextContent(`1 ${t("thema.doelenOpActiviteiten")}`);
  });
});

describe("ThemadetailScherm: kop, subthema's, dan doelen (FB-094)", () => {
  const OVERZICHT_K3: ThemaDoelenoverzicht = {
    themaId: "thema-1",
    leeftijden: [
      {
        leeftijd: "K3",
        leerplandoelen: [
          { code: "WIS-1", doelsoort: "Gemeenschappelijk", tekst: "Tellen", nietMeerInOpstap: false, minimumdoelRef: "K-MD-1", plaatsen: [] },
        ],
        buitenMinimumdoelen: [],
      },
    ],
  };

  it("zet de vier cijfers één keer onder de titel, en niet nog eens bij de blokken", async () => {
    toon(ADMIN, { overzicht: OVERZICHT_K3 });
    await screen.findByText("Bladeren");
    const samenvatting = await waitFor(() => {
      const dl = screen.getByLabelText(t("thema.samenvatting"));
      expect(dl).toHaveTextContent(t("thema.overzichtLeerplandoelWoordEen"));
      return dl;
    });

    for (const woord of [
      t("themas.weekMeer"),
      t("themas.minimumdoelEen"),
      t("thema.overzichtLeerplandoelWoordEen"),
      t("themas.subthemaMeer"),
    ]) {
      expect(within(samenvatting).getByText(woord)).toBeInTheDocument();
      // Nowhere else on the page as a figure's word of its own.
      expect(screen.getAllByText(woord)).toHaveLength(1);
    }
    // With one leeftijd, its row does not repeat the total.
    expect(screen.getByRole("button", { name: /^Leerplandoelen voor K3/ })).not.toHaveTextContent(
      telWoord(1, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen"),
    );
  });

  it("toont eerst de subthema's en dan de doelen, elk onder een echte kop", async () => {
    toon(ADMIN);
    await screen.findByText("Bladeren");

    const koppen = screen.getAllByRole("heading", { level: 2 }).map((kop) => kop.textContent);
    expect(koppen).toEqual([t("thema.subthemasTitel"), t("thema.doelenTitel")]);
    // The breadcrumb stands in for the old back button.
    expect(screen.getByRole("navigation", { name: t("thema.kruimelpad") })).toHaveTextContent("Herfst");
    expect(screen.getByRole("link", { name: t("themas.titel") })).toHaveAttribute("href", "/themas");
  });

  it("noemt de mijlpaal één keer bij de themadoelen wanneer ze allemaal dezelfde hebben", async () => {
    toon(ADMIN, { suggesties: [] });
    await screen.findByText("Bladeren");

    expect(screen.getAllByText(t("minimumdoel.mijlpaalK"))).toHaveLength(1);
  });
});
