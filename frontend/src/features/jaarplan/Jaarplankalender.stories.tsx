import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";

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
    { ordinaal: 1, start: "2026-09-01", eind: "2026-10-01", ouderOrdinaal: null, aantalOpenDagen: 31 },
    { ordinaal: 2, start: "2026-10-02", eind: "2026-11-01", ouderOrdinaal: null, aantalOpenDagen: 31 },
    { ordinaal: 3, start: "2026-11-09", eind: "2026-12-20", ouderOrdinaal: null, aantalOpenDagen: 42 },
    { ordinaal: 4, start: "2027-01-04", eind: "2027-02-14", ouderOrdinaal: null, aantalOpenDagen: 42 },
    { ordinaal: 5, start: "2027-02-22", eind: "2027-04-04", ouderOrdinaal: null, aantalOpenDagen: 42 },
    { ordinaal: 6, start: "2027-04-19", eind: "2027-05-25", ouderOrdinaal: null, aantalOpenDagen: 34 },
    { ordinaal: 7, start: "2027-05-26", eind: "2027-06-30", ouderOrdinaal: null, aantalOpenDagen: 36 },
  ],
  onderbrekingen: [
    { naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-08" },
    { naam: "Kerstvakantie", start: "2026-12-21", eind: "2027-01-03" },
    { naam: "Krokusvakantie", start: "2027-02-15", eind: "2027-02-21" },
    { naam: "Paasvakantie", start: "2027-04-05", eind: "2027-04-18" },
  ],
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

  // Periode 3 holds three thema's, so the "te vol" knelpunt is visible (FR-6.4) — and with it the note
  // saying the threshold is still an open review question (E3-10 question C).
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

function jaarplan(eigen: Themaplaatsing[]): Jaarplan {
  return {
    klasId: "11111111-1111-1111-1111-111111111111",
    klasNaam: "L3 derde leerjaar",
    schooljaarId: SCHOOLJAAR_ID,
    schooljaarNaam: "2026-2027",
    blokindeling: rooster.blokindeling,
    plaatsingen: eigen,
  };
}

/**
 * Serves the two GETs the kalender makes, from the fixture. Stubbing `fetch` keeps the component, its
 * TanStack Query chain and its nl.json copy completely untouched — the story shows the real screen, not a
 * hand-drawn imitation of it.
 */
function metGestubdeApi(plan: Jaarplan) {
  return function Decorator(Story: () => JSX.Element) {
    window.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/rooster") ? rooster : plan;

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof window.fetch;

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-slate-50 p-6">
          <Story />
        </div>
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
