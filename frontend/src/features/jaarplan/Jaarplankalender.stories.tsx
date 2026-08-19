import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";

import { Jaarplankalender } from "./Jaarplankalender";
import type { Jaarplan, Planningsrooster, Themaplaatsing } from "./types";

/**
 * Storybook entry for the kalender (E3-06).
 *
 * **Why this exists.** E3-06's output is the artifact directie and teachers assess by clicking through it,
 * but the real screen needs a running API and a Postgres database. Storybook renders the **real component**
 * against fixture data with no backend, so the ribbon can be shown, reviewed and screenshotted on any
 * machine — including one with no Docker. It is a review aid, not a substitute: `pnpm dev` against the
 * seeded database remains the thing that proves the screen actually works end to end.
 *
 * The fixture is the genuine Belgian 2026-2027 calendar, which is what makes the ribbon's central claim
 * visible: seven periods of unequal width, four vakanties as literal gaps, and periode 6 and 7 slightly
 * narrowed by Hemelvaart and Pinkstermaandag falling inside them.
 */

const SCHOOLJAAR_ID = "22222222-2222-2222-2222-222222222222";

/**
 * The derived grid for 2026-2027, **copied from what the real API returns** for the seeded demo year
 * (`GET /api/schooljaren/{id}/rooster`, verified 2026-07-29) rather than estimated. Periode 6 is 34 open
 * days, not 37: both Hemelvaart (2 days) and Pinkstermaandag fall inside it, so it renders visibly narrower
 * than its calendar span — exactly the effect the design exists to show. An earlier revision of this fixture
 * guessed 33/35 for periodes 6 and 7 and put Pinkstermaandag in the wrong period; a fixture claiming to be
 * the genuine calendar has to actually be it, or the story quietly misrepresents the product.
 */
const rooster: Planningsrooster = {
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  start: "2026-09-01",
  eind: "2027-06-30",
  niveau: "Themaperiode",
  blokindeling: "themaperiode 5 wk, subthemaperiode 2 wk",
  blokken: [
    { ordinaal: 1, start: "2026-09-01", eind: "2026-10-01", ouderOrdinaal: null, aantalOpenDagen: 31, aantalOpenWeekdagen: 22 },
    { ordinaal: 2, start: "2026-10-02", eind: "2026-11-01", ouderOrdinaal: null, aantalOpenDagen: 31, aantalOpenWeekdagen: 22 },
    { ordinaal: 3, start: "2026-11-09", eind: "2026-12-20", ouderOrdinaal: null, aantalOpenDagen: 42, aantalOpenWeekdagen: 30 },
    { ordinaal: 4, start: "2027-01-04", eind: "2027-02-14", ouderOrdinaal: null, aantalOpenDagen: 42, aantalOpenWeekdagen: 30 },
    { ordinaal: 5, start: "2027-02-22", eind: "2027-04-04", ouderOrdinaal: null, aantalOpenDagen: 42, aantalOpenWeekdagen: 30 },
    { ordinaal: 6, start: "2027-04-19", eind: "2027-05-25", ouderOrdinaal: null, aantalOpenDagen: 34, aantalOpenWeekdagen: 24 },
    { ordinaal: 7, start: "2027-05-26", eind: "2027-06-30", ouderOrdinaal: null, aantalOpenDagen: 36, aantalOpenWeekdagen: 26 },
  ],
  onderbrekingen: [
    { naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-08" },
    { naam: "Kerstvakantie", start: "2026-12-21", eind: "2027-01-03" },
    { naam: "Krokusvakantie", start: "2027-02-15", eind: "2027-02-21" },
    { naam: "Paasvakantie", start: "2027-04-05", eind: "2027-04-18" },
  ],
};

/**
 * The same year at the **fine** tier (E3-08), so the zoom control in the story is not a control that lies.
 *
 * Also copied from the real API (`?niveau=Subthemaperiode`, verified 2026-07-31) rather than derived here: writing a
 * subdivision by hand in a fixture would put a second implementation of the ADR-0020 nesting rules in the repo, and
 * the story's whole claim is that it shows what the product shows. Note the property the fine view rests on, visible
 * in the data: **each parent's first sub-block starts on the parent's own start date** (1 sep, 2 okt, 9 nov, 4 jan,
 * 22 feb, 19 apr, 26 mei), which is why a placement keyed on a themaperiode still resolves here.
 */
const fijnRooster: Planningsrooster = {
  ...rooster,
  niveau: "Subthemaperiode",
  blokken: [
    { ordinaal: 1, start: "2026-09-01", eind: "2026-09-16", ouderOrdinaal: 1, aantalOpenDagen: 16, aantalOpenWeekdagen: 11 },
    { ordinaal: 2, start: "2026-09-17", eind: "2026-10-01", ouderOrdinaal: 1, aantalOpenDagen: 15, aantalOpenWeekdagen: 11 },
    { ordinaal: 3, start: "2026-10-02", eind: "2026-10-17", ouderOrdinaal: 2, aantalOpenDagen: 16, aantalOpenWeekdagen: 11 },
    { ordinaal: 4, start: "2026-10-18", eind: "2026-11-01", ouderOrdinaal: 2, aantalOpenDagen: 15, aantalOpenWeekdagen: 11 },
    { ordinaal: 5, start: "2026-11-09", eind: "2026-11-22", ouderOrdinaal: 3, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 6, start: "2026-11-23", eind: "2026-12-06", ouderOrdinaal: 3, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 7, start: "2026-12-07", eind: "2026-12-20", ouderOrdinaal: 3, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 8, start: "2027-01-04", eind: "2027-01-17", ouderOrdinaal: 4, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 9, start: "2027-01-18", eind: "2027-01-31", ouderOrdinaal: 4, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 10, start: "2027-02-01", eind: "2027-02-14", ouderOrdinaal: 4, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 11, start: "2027-02-22", eind: "2027-03-07", ouderOrdinaal: 5, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 12, start: "2027-03-08", eind: "2027-03-21", ouderOrdinaal: 5, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 13, start: "2027-03-22", eind: "2027-04-04", ouderOrdinaal: 5, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    { ordinaal: 14, start: "2027-04-19", eind: "2027-05-01", ouderOrdinaal: 6, aantalOpenDagen: 13, aantalOpenWeekdagen: 9 },
    { ordinaal: 15, start: "2027-05-02", eind: "2027-05-13", ouderOrdinaal: 6, aantalOpenDagen: 10, aantalOpenWeekdagen: 7 },
    { ordinaal: 16, start: "2027-05-14", eind: "2027-05-25", ouderOrdinaal: 6, aantalOpenDagen: 11, aantalOpenWeekdagen: 8 },
    { ordinaal: 17, start: "2027-05-26", eind: "2027-06-06", ouderOrdinaal: 7, aantalOpenDagen: 12, aantalOpenWeekdagen: 9 },
    { ordinaal: 18, start: "2027-06-07", eind: "2027-06-18", ouderOrdinaal: 7, aantalOpenDagen: 12, aantalOpenWeekdagen: 9 },
    { ordinaal: 19, start: "2027-06-19", eind: "2027-06-30", ouderOrdinaal: 7, aantalOpenDagen: 12, aantalOpenWeekdagen: 9 },
  ],
};

/**
 * The coverage answer behind E3-09's knelpunt line, as `GET /api/klassen/{id}/dekking` shapes it.
 *
 * **An L3 class deliberately, so the story shows the ordinary case:** one jaar/fase, therefore no kleuterjaar chooser
 * (that control renders only when there is more than one code to choose between). The figures say 3 of 14 covered, so
 * the knelpunt line reads "11 leerplandoelen zijn nog niet gedekt" — a review artifact in which the signal this story
 * added is actually visible, rather than one in which it is silently absent.
 *
 * `doelen` is empty on purpose: the kalender reads only the two counts, and pasting fourteen goal records into a
 * fixture would be fourteen more things to keep true.
 */
const dekking = {
  klasId: "11111111-1111-1111-1111-111111111111",
  klasNaam: "L3 derde leerjaar",
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  bereik: "EigenJaarFase",
  gemetenJaarFasen: ["L3"],
  beschikbareJaarFasen: ["L3"],
  isTerugvalNaarHeelCurriculum: false,
  aantalBuitenBereik: 0,
  isBetrouwbaar: true,
  aantalOnopgelosteVervallenPlaatsingen: 0,
  aantalGedekt: 3,
  aantalLeerplandoelen: 14,
  doelen: [],
};

let volgendeId = 0;

function plaatsing(
  themaNaam: string,
  blokStart: string,
  overrides: Partial<Themaplaatsing> = {},
): Themaplaatsing {
  volgendeId += 1;

  return {
    id: `p${volgendeId}`,
    themaId: `t${volgendeId}`,
    themaNaam,
    blokNiveau: "Themaperiode",
    blokStart,
    blokEind: null,
    blokOrdinaal: null,
    isVervallen: false,
    status: "Voorgesteld",
    aiMotivatie: null,
    vergrendeld: false,
    doelcodes: [],
    duurWeken: 5,
    ...overrides,
  };
}

/** Codes are illustrative; only the count reaches the card. */
const doelen = (aantal: number) => Array.from({ length: aantal }, (_, i) => `DEMO-L3-${i + 1}`);

const plaatsingen: Themaplaatsing[] = [
  plaatsing("Ik en mijn klas", "2026-09-01", {
    doelcodes: doelen(11),
    aiMotivatie: "past bij het begin van het schooljaar en de groepsvorming",
  }),
  plaatsing("Herfst en oogst", "2026-10-02", {
    doelcodes: doelen(8),
    aiMotivatie: "sluit aan bij het seizoen in deze periode",
  }),

  // Periode 3 holds three thema's, so the "te vol" knelpunt is visible (FR-6.4). It fires on the weeks those
  // thema's need against the weeks the period offers (owner ruling 2026-07-31, E3-09), not on their number: three
  // 5-week thema's is 15 weeks in a period of at most 6, which is over by any reading. The story used to note that
  // the threshold was an open review question; it is now decided, so the note is gone rather than left to mislead
  // whoever opens this next.
  plaatsing("Licht en donker", "2026-11-09", {
    doelcodes: doelen(11),
    aiMotivatie: "de donkere maanden maken dit thema concreet waarneembaar",
  }),
  plaatsing("Feesten in december", "2026-11-09", {
    doelcodes: doelen(3),
    status: "Aanvaard",
    vergrendeld: true,
  }),
  plaatsing("Sinterklaas", "2026-11-09", { doelcodes: doelen(4), status: "Manueel" }),

  // Periode 4 is deliberately empty: "where is there still room" is a question the ribbon must answer.
  plaatsing("Lente en groei", "2027-02-22", {
    doelcodes: doelen(11),
    aiMotivatie: "het seizoen levert direct waarneembaar materiaal op",
  }),
  plaatsing("Verkeer", "2027-04-19", {
    doelcodes: doelen(7),
    aiMotivatie: "sluit aan bij de fietsexamens later in het jaar",
  }),
  plaatsing("Zomer en vakantie", "2027-05-26", { doelcodes: doelen(6) }),
];

/**
 * The per-block load the server ships with the plan (E3-09), derived here from the placements themselves.
 *
 * Derived rather than hand-written for the same reason the test fixture derives it: a story is the picture people
 * trust, and a hand-kept list would drift from `plaatsingen` the first time one is added, showing a te-vol flag on a
 * period whose cards do not account for it. `beschikbareWeken` rounds open days up, as the server does.
 */
function belasting(eigen: Themaplaatsing[]): Jaarplan["blokken"] {
  return rooster.blokken.map((blok) => {
    const inBlok = eigen.filter(
      (plaatsing) => plaatsing.blokStart === blok.start && plaatsing.status !== "Geweigerd",
    );
    const benodigdeWeken = inBlok.reduce((som, plaatsing) => som + plaatsing.duurWeken, 0);
    const beschikbareWeken = Math.ceil(blok.aantalOpenDagen / 7);

    return {
      ordinaal: blok.ordinaal,
      start: blok.start,
      aantalThemas: inBlok.length,
      aantalDoelen: new Set(inBlok.flatMap((plaatsing) => plaatsing.doelcodes)).size,
      benodigdeWeken,
      beschikbareWeken,
      isOverbelast: benodigdeWeken > beschikbareWeken,
    };
  });
}

function jaarplan(eigen: Themaplaatsing[]): Jaarplan {
  return {
    klasId: "11111111-1111-1111-1111-111111111111",
    klasNaam: "L3 derde leerjaar",
    schooljaarId: SCHOOLJAAR_ID,
    schooljaarNaam: "2026-2027",
    blokindeling: rooster.blokindeling,
    // E4-05: no period is blocked in these fixtures; the blocked-period cases build their own.
    geblokkeerdePeriodes: [],
    plaatsingen: eigen,
    blokken: belasting(eigen),
  };
}

/**
 * Serves the GETs the kalender makes, from the fixture. Stubbing `fetch` keeps the component, its
 * TanStack Query chain and its nl.json copy completely untouched — the story shows the real screen, not a
 * hand-drawn imitation of it.
 *
 * The parameter form's kept settings (E3-04) are served empty: the story is about the ribbon, and a story that
 * showed saved settings would need its own fixture. Routed before the plan, whose URL theirs extends.
 */
function metGestubdeApi(plan: Jaarplan) {
  return function Decorator(Story: () => JSX.Element) {
    window.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/rooster")
        ? // The tier the request asks for, so the zoom control (E3-08) works in the story too. Answering the coarse
          // grid whatever was asked would put a control in a review artifact that changes its own label and nothing
          // else, which is the defect this project banned after E3-06.
          url.includes("niveau=Subthemaperiode")
          ? fijnRooster
          : rooster
        : url.includes("/jaarplan/parameters")
          ? { gewensteStartthemas: [], vasteMomenten: [] }
          : // E3-09's coverage read. **Routed explicitly, and the fall-through below is why it has to be** (antagonist
            // round 2, MAJOR): this chain used to end in `: plan`, so a `/dekking` request was answered with the
            // *Jaarplan* fixture. `api.ts` casts rather than validates, so `dekking.data.beschikbareJaarFasen` was
            // `undefined` and the kalender crashed on `.length` — all three stories rendered nothing but a TypeError,
            // in the file this story's own record cites as "the picture people trust". A chain whose default answers
            // every unrecognised URL with a plausible-looking object cannot fail loudly, so it failed silently until
            // someone opened Storybook.
            url.includes("/dekking")
            ? dekking
            : plan;

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof window.fetch;

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return (
      <QueryClientProvider client={queryClient}>
        {/* A router, because `OngeplandeDoelen` links to `/dekking` (E3-09). The test harnesses were given one when the
            link landed; this decorator was not, so react-router's `Link` threw here even after the fetch stub was
            fixed. Two independent breaks behind one symptom. */}
        <MemoryRouter>
          <div className="min-h-screen bg-slate-50 p-6">
            <Story />
          </div>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: "Jaarplan/Jaarplankalender",
  component: Jaarplankalender,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Jaarplankalender>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The review case: a full year, a crowded periode 3, an empty periode 4, a locked accepted thema. */
export const VolledigJaarplan: Story = {
  args: { klasId: "11111111-1111-1111-1111-111111111111" },
  decorators: [metGestubdeApi(jaarplan(plaatsingen))],
};

/**
 * After the school edits a vakantie: "Feesten in december" now points at a date that is no longer a
 * period boundary. It is flagged, named, and **not** silently moved — and its card reports no coverage
 * figure, because a thema in no period demonstrably covers nothing (directie 2026-07-28, Art. V.1/V.2).
 */
export const MetVervallenPlaatsing: Story = {
  args: { klasId: "11111111-1111-1111-1111-111111111111" },
  decorators: [
    metGestubdeApi(
      jaarplan([
        ...plaatsingen.filter((p) => p.themaNaam !== "Feesten in december"),
        plaatsing("Feesten in december", "2026-12-07", {
          doelcodes: doelen(3),
          status: "Aanvaard",
          vergrendeld: true,
          isVervallen: true,
        }),
      ]),
    ),
  ],
};

/** A class that has not been generated for yet: every period empty, nothing invented to fill them. */
export const NogNietGegenereerd: Story = {
  args: { klasId: "11111111-1111-1111-1111-111111111111" },
  decorators: [metGestubdeApi(jaarplan([]))],
};
