import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import nl from "../../i18n/nl.json";
import { Jaarplankalender } from "./Jaarplankalender";
import type { Generatieresultaat, Jaarplan, Parameterrapport, Planningsrooster } from "./types";

/**
 * Pins E3-04's UI half (FR-5.4) through the real kalender, the real TanStack Query chain and the real nl.json
 * copy, with only `fetch` faked — so what is asserted is the request a teacher's clicks actually produce and the
 * Dutch a teacher actually reads.
 *
 * The load-bearing assertions are the three that encode a decision rather than a rendering:
 * 1. an untouched form sends **no body**, so a plain run is byte-for-byte the request it always was;
 * 2. a startthema row is labelled with **its period and dates**, because the server contract is positional and a
 *    bare list of names would hide what the position means;
 * 3. a vast moment with no answer to "mag er een thema bij?" is **not sent**, and the screen says so — the server
 *    rejects it, and `false` would be a control that silently does nothing.
 */

const KLAS_ID = "11111111-1111-1111-1111-111111111111";
const SCHOOLJAAR_ID = "22222222-2222-2222-2222-222222222222";

const rooster: Planningsrooster = {
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  start: "2026-09-01",
  eind: "2027-06-30",
  niveau: "Themaperiode",
  blokindeling: "themaperiode 5 wk, subthemaperiode 2 wk",
  blokken: [
    { ordinaal: 1, start: "2026-09-01", eind: "2026-11-01", ouderOrdinaal: null, aantalOpenDagen: 62 },
    { ordinaal: 2, start: "2026-11-09", eind: "2026-12-20", ouderOrdinaal: null, aantalOpenDagen: 42 },
  ],
  onderbrekingen: [{ naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-08" }],
};

const leegPlan: Jaarplan = {
  klasId: KLAS_ID,
  klasNaam: "L3 derde leerjaar",
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  blokindeling: rooster.blokindeling,
  plaatsingen: [],
};

const leegRapport: Parameterrapport = {
  onbekendeStartthemas: [],
  gehonoreerdeStartthemas: [],
  nietGehonoreerdeStartthemas: [],
  tegenstrijdigeStartthemas: [],
  geweigerdDoorVastMoment: [],
  toegepasteVasteMomenten: [],
  onplaatsbareVasteMomenten: [],
  heeftAandachtspunten: false,
};

function resultaat(parameters: Parameterrapport | null): Generatieresultaat {
  return {
    isGeslaagd: true,
    fout: null,
    jaarplan: leegPlan,
    aantalNieuw: 1,
    aantalBehouden: 0,
    aantalVervangen: 0,
    onbekendeThemas: [],
    onbekendeBlokken: [],
    duplicaten: [],
    afgewezen: [],
    spreiding: null,
    parameters,
  };
}

/** Captures the POST bodies so the assertions can be about the request, not only about the screen. */
function stubFetch(generatie: Generatieresultaat, themas = ["Herfst", "Water"]) {
  const posts: (string | undefined)[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === "POST" && url.includes("/generatie")) {
        posts.push(init.body === undefined ? undefined : String(init.body));
        return new Response(JSON.stringify(generatie), { status: 200 });
      }
      if (url.includes("/api/themas")) {
        return new Response(
          JSON.stringify(themas.map((naam, i) => ({ id: `t${i}`, naam }))),
          { status: 200 },
        );
      }
      if (url.includes("/rooster")) {
        return new Response(JSON.stringify(rooster), { status: 200 });
      }
      if (url.includes("/jaarplan")) {
        return new Response(JSON.stringify(leegPlan), { status: 200 });
      }

      throw new Error(`onverwachte fetch: ${url}`);
    }),
  );

  return posts;
}

function renderKalender() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <Jaarplankalender klasId={KLAS_ID} />
    </QueryClientProvider>,
  );
}

/** Opens the collapsed parameter form. */
async function openForm() {
  const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
  fireEvent.click(knop);
  return knop;
}

function genereer() {
  fireEvent.click(screen.getByRole("button", { name: t("kalender.genereer") }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Generatieparameters — the form (E3-04, FR-5.4)", () => {
  it("sends no body at all when the teacher sets nothing", async () => {
    const posts = stubFetch(resultaat(null));
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });

    genereer();

    await waitFor(() => expect(posts).toHaveLength(1));
    // Not "{}" and not an empty parameters object: a plain run must be the request it always was.
    expect(posts[0]).toBeUndefined();
  });

  it("starts collapsed and says whether anything is set", async () => {
    stubFetch(resultaat(null));
    renderKalender();

    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(knop).toHaveTextContent(t("parameters.samenvattingLeeg"));

    // The startthema rows are not merely hidden, they are absent until opened.
    expect(screen.queryByText(t("parameters.startthemasTitel"))).toBeNull();
  });

  it("counts the summary in grammatical Dutch for one, not \"1 startthema's\"", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await openForm();

    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });
    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(1));
    fireEvent.change(within(startthemas).getAllByRole("combobox")[0], { target: { value: "Water" } });

    // Asserted on the parenthesised SUMMARY, not the whole button: the trigger label itself now names its
    // content ("startthema's en vaste momenten") for discoverability, so a button-wide match would pass or fail
    // on the label rather than on the count.
    const knop = screen.getByRole("button", { name: new RegExp(t("parameters.titel")) });
    const samenvatting = () => /\(([^)]*)\)/.exec(knop.textContent ?? "")?.[1] ?? "";

    await waitFor(() => expect(samenvatting()).toBe("1 startthema"));
    expect(samenvatting()).not.toContain("startthema's");
    // Zero parts are omitted rather than printed as "0 vaste momenten".
    expect(samenvatting()).not.toContain("moment");
  });

  it("labels each startthema row with the period it targets, because the contract is positional", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await openForm();

    // Scoped to the form: the board below also renders "Periode 1" as its own column heading.
    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });

    // The row names the period it targets, with its dates in Dutch day+month — never the ISO the server sent.
    // That labelling IS the positional contract: a bare list of thema names would leave it invisible.
    expect(
      await within(startthemas).findByText(t("parameters.periodeLabel", { ordinaal: 1 })),
    ).toBeInTheDocument();
    expect(within(startthemas).getByText("1 sep – 1 nov")).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-01/)).toBeNull();

    // And the next period names itself once it becomes reachable, rather than all seven being rendered at once.
    fireEvent.change(within(startthemas).getAllByRole("combobox")[0], { target: { value: "Herfst" } });
    expect(
      await within(startthemas).findByText(t("parameters.periodeLabel", { ordinaal: 2 })),
    ).toBeInTheDocument();
    expect(within(startthemas).getByText("9 nov – 20 dec")).toBeInTheDocument();
  });

  it("sends the chosen startthema for the first period", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    const selects = await screen.findAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "Water" } });
    genereer();

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!)).toEqual({
      gewensteStartthemas: ["Water"],
      vasteMomenten: [],
    });
  });

  it("grows one period at a time, so the list cannot acquire a gap", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    // Only ONE period row exists at first. Rendering all seven meant six disabled selects, which read as broken
    // rather than as not-yet-reachable, and a growing list teaches the top-to-bottom rule by itself.
    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });
    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(1));

    fireEvent.change(within(startthemas).getAllByRole("combobox")[0], {
      target: { value: "Herfst" },
    });

    // Choosing one reveals the next.
    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(2));
    fireEvent.change(within(startthemas).getAllByRole("combobox")[1], {
      target: { value: "Water" },
    });

    genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).gewensteStartthemas).toEqual(["Herfst", "Water"]);
  });

  it("clearing a period clears the later ones, instead of dropping them only from the request", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });
    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(1));

    fireEvent.change(within(startthemas).getAllByRole("combobox")[0], { target: { value: "Herfst" } });
    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(2));
    fireEvent.change(within(startthemas).getAllByRole("combobox")[1], { target: { value: "Water" } });

    // Clear period 1. Period 2's choice must visibly go too: the server reads position as the target block, so
    // keeping it on screen while truncating the request would display a preference that is not being sent.
    fireEvent.change(within(startthemas).getAllByRole("combobox")[0], { target: { value: "" } });

    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(1));
    genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toBeUndefined();
  });

  it("does not send a vast moment until the blocking question is answered, and says so on screen", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));
    fireEvent.change(screen.getByLabelText(t("parameters.momentNaam")), {
      target: { value: "Schoolfeest" },
    });
    fireEvent.change(screen.getByLabelText(t("parameters.momentDatum")), {
      target: { value: "2026-09-15" },
    });

    // Named and dated but unanswered: the screen must not let this look like an instruction that was taken.
    expect(screen.getByText(new RegExp(t("parameters.momentOnbeslist")))).toBeInTheDocument();

    genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toBeUndefined();

    // Answering it makes it a real instruction.
    fireEvent.click(screen.getByRole("radio", { name: t("parameters.momentGeenThema") }));
    expect(screen.queryByText(new RegExp(t("parameters.momentOnbeslist")))).toBeNull();

    genereer();
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(JSON.parse(posts[1]!).vasteMomenten).toEqual([
      { naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true },
    ]);
  });

  // The defect this pins: the summary counted any named+dated moment, ignoring the blocking question, so a
  // teacher who left it unanswered, COLLAPSED the panel and generated saw "(1 vast moment)" while the run sent
  // nothing and the report said nothing. The warning that explains it lives inside the panel, which is closed by
  // default — so the one surface that could have told them asserted the opposite.
  it("does not claim an unfinished moment is set, and names it as unfinished while collapsed", async () => {
    const posts = stubFetch(resultaat(null));
    renderKalender();
    const knop = await openForm();
    const samenvatting = () => /\(([^)]*)\)/.exec(knop.textContent ?? "")?.[1] ?? "";

    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));
    fireEvent.change(screen.getByLabelText(t("parameters.momentNaam")), {
      target: { value: "Schoolfeest" },
    });
    fireEvent.change(screen.getByLabelText(t("parameters.momentDatum")), {
      target: { value: "2026-09-15" },
    });

    // Collapse it, which is how the defect hid.
    fireEvent.click(knop);
    expect(knop).toHaveAttribute("aria-expanded", "false");

    await waitFor(() => expect(samenvatting()).toBe("1 nog onvolledig"));
    // Emphatically NOT "1 vast moment": nothing will be sent.
    expect(samenvatting()).not.toContain("vast moment");

    fireEvent.click(screen.getByRole("button", { name: t("kalender.genereer") }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toBeUndefined();
  });

  it("offers no pre-selected answer to the blocking question", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await openForm();

    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));

    // Neither radio is checked: the server rejects a missing value, and defaulting to "mag wel" would produce a
    // run identical to one with no parameters at all.
    expect(screen.getByRole("radio", { name: t("parameters.momentMagThema") })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: t("parameters.momentGeenThema") })).not.toBeChecked();
  });

  it("says so when the school has no thema's yet, instead of an empty picker", async () => {
    stubFetch(resultaat(null), []);
    renderKalender();
    await openForm();

    expect(await screen.findByText(t("parameters.geenThemas"))).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("Generatieparameters — the report (E3-04, FR-5.4)", () => {
  it("names a refused thema in Dutch, keeps the AI motivation, and shows no ISO date", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        geweigerdDoorVastMoment: [
          {
            themaNaam: "Herfst",
            blokStart: "2026-09-01",
            momentNaam: "Schoolfeest",
            aiMotivatie: "past bij het begin van het schooljaar",
          },
        ],
        heeftAandachtspunten: true,
      }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    genereer();

    const regel = await screen.findByText(
      t("parameters.rapportGeweigerdRegel", {
        thema: "Herfst",
        datum: "1 sep",
        moment: "Schoolfeest",
      }),
    );
    expect(regel).toBeInTheDocument();

    // The proposal survives its refusal: the teacher can still read what the AI suggested.
    expect(
      screen.getByText(new RegExp("past bij het begin van het schooljaar")),
    ).toBeInTheDocument();

    // And it says what to do about it, because the thema is now planned nowhere — in the singular, since one
    // refusal is the common case and the heading beside it is already singular.
    expect(screen.getByText(t("parameters.rapportGeweigerdWatNuEnkelvoud"))).toBeInTheDocument();
    expect(screen.queryByText(t("parameters.rapportGeweigerdWatNu"))).toBeNull();

    // Never the server's ISO date.
    expect(screen.queryByText(/2026-09-01/)).toBeNull();
  });

  it("tells a teacher's own conflict apart from the model declining", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        tegenstrijdigeStartthemas: ["Water"],
        heeftAandachtspunten: true,
      }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    genereer();

    // The conflict copy tells them to change one of their two settings...
    expect(
      await screen.findByText(
        new RegExp(t("parameters.rapportTegenstrijdigEnkelvoud", { themas: "Water" })),
      ),
    ).toBeInTheDocument();

    // ...and must NOT claim the AI ignored them, which would send them to re-run instead.
    expect(
      screen.queryByText(
        new RegExp(t("parameters.rapportNietGehonoreerdEnkelvoud", { themas: "Water" })),
      ),
    ).toBeNull();
  });

  it("renders nothing when the run used no parameters", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    genereer();

    await waitFor(() =>
      expect(screen.getByText(new RegExp(t("kalender.genereerGeluktEnkelvoud", { aantal: 1 })))).toBeInTheDocument(),
    );
    expect(screen.queryByText(t("parameters.rapportTitel"))).toBeNull();
  });

  // The shape the server ACTUALLY sends for a successful run with no parameters is ParameterRapport.Geen - an
  // object of empty lists - not null. Both must render nothing, and until now every "no parameters" test used the
  // fictional null.
  it("renders nothing for the empty report the server really sends", async () => {
    stubFetch(resultaat(leegRapport));
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    genereer();

    await waitFor(() =>
      expect(
        screen.getByText(new RegExp(t("kalender.genereerGeluktEnkelvoud", { aantal: 1 }))),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(t("parameters.rapportTitel"))).toBeNull();
  });

  it("names a single unknown thema in the singular", async () => {
    stubFetch(
      resultaat({ ...leegRapport, onbekendeStartthemas: ["Ruimtevaart"], heeftAandachtspunten: true }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    genereer();

    // This line was the one report entry with no singular sibling, so one unknown thema read
    // "Deze thema's kent de school niet" - the fourth instance of a plural bug this project keeps shipping.
    expect(
      await screen.findByText(
        new RegExp(t("parameters.rapportOnbekendEnkelvoud", { themas: "Ruimtevaart" })),
      ),
    ).toBeInTheDocument();
  });

  it("has no axe violations with the form open and a report showing", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        nietGehonoreerdeStartthemas: ["Water"],
        toegepasteVasteMomenten: [
          { naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true, blokStart: "2026-09-01" },
        ],
        heeftAandachtspunten: true,
      }),
    );
    const { container } = renderKalender();
    await openForm();
    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));
    genereer();
    await screen.findByText(t("parameters.rapportTitel"));

    // Structure only: jsdom cannot evaluate colour, so this says nothing about contrast (the E3-06 lesson).
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * Guards the owner's no-em-dash instruction across the WHOLE catalogue, not just this feature.
 *
 * The first version read `(t as unknown as { catalogus?: unknown }).catalogus ?? {}`, which always resolved to
 * `{}` — so `expect("{}").not.toContain("—")` could never fail — and then queried a `document.body` that
 * `afterEach` had already emptied, which could never fail either. Real coverage was three hard-listed keys out of
 * roughly forty. A test that reads like a catalogue-wide guard and cannot fail is worse than no test, which is
 * this repo's own recorded lesson about a test that pinned wrong copy.
 */
it("uses no em dashes anywhere in the Dutch catalogue", () => {
  expect(JSON.stringify(nl)).not.toContain("—");
});
