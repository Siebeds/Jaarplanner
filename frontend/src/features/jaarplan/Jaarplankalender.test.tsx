import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Jaarplankalender } from "./Jaarplankalender";
import type { Jaarplan, Planningsrooster } from "./types";

/**
 * Pins E3-06's acceptance criterion — "a generated plan renders per block" (FR-6.1) — and the two
 * properties the ribbon must not get wrong: an **empty** period still appears, and a **stale**
 * placement is shown rather than silently dropped.
 *
 * The API is faked at the fetch boundary, so this drives the real components, the real TanStack Query
 * chain (rooster is fetched using the schooljaarId the jaarplan returns) and the real nl.json copy.
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

function maakJaarplan(plaatsingen: Jaarplan["plaatsingen"]): Jaarplan {
  return {
    klasId: KLAS_ID,
    klasNaam: "L3 — derde leerjaar",
    schooljaarId: SCHOOLJAAR_ID,
    schooljaarNaam: "2026-2027",
    blokindeling: rooster.blokindeling,
    plaatsingen,
  };
}

/** A placement in the first block, overridable per field. */
function maakPlaatsing(
  overrides: Partial<Jaarplan["plaatsingen"][number]> & { id: string },
): Jaarplan["plaatsingen"][number] {
  return {
    themaId: `t-${overrides.id}`,
    themaNaam: "Thema",
    blokNiveau: "Themaperiode",
    blokStart: "2026-09-01",
    blokEind: "2026-11-01",
    blokOrdinaal: 1,
    isVervallen: false,
    status: "Voorgesteld",
    aiMotivatie: "past hier volgens de AI",
    vergrendeld: false,
    doelcodes: [],
    ...overrides,
  };
}

/** Routes the two GETs the kalender makes; everything else is a test bug, so it 404s loudly. */
function stubFetch(jaarplan: Jaarplan) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/jaarplan")) {
        return new Response(JSON.stringify(jaarplan), { status: 200 });
      }
      if (url.includes("/rooster")) {
        return new Response(JSON.stringify(rooster), { status: 200 });
      }

      return new Response("unexpected request", { status: 404 });
    }),
  );
}

function renderKalender() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <Jaarplankalender klasId={KLAS_ID} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Jaarplankalender", () => {
  it("renders the generated plan per block, with the vakantie as a gap between them", async () => {
    stubFetch(
      maakJaarplan([
        {
          id: "p1",
          themaId: "t1",
          themaNaam: "Ik en mijn klas",
          blokNiveau: "Themaperiode",
          blokStart: "2026-09-01",
          blokEind: "2026-11-01",
          blokOrdinaal: 1,
          isVervallen: false,
          status: "Voorgesteld",
          aiMotivatie: "past bij het begin van het schooljaar",
          vergrendeld: false,
          doelcodes: ["NAT-L3-01", "NL-L3-04"],
        },
      ]),
    );
    renderKalender();

    expect(await screen.findByText("Ik en mijn klas")).toBeInTheDocument();

    // Both periods render — including period 2, which holds nothing.
    expect(screen.getByText("Periode 1")).toBeInTheDocument();
    expect(screen.getByText("Periode 2")).toBeInTheDocument();
    expect(screen.getByText("Nog niets gepland")).toBeInTheDocument();

    // The vakantie is drawn between them.
    expect(screen.getByText("Herfstvakantie")).toBeInTheDocument();

    // Proportional width comes from teaching days, shown as weeks: 62/7 = 8,9 and 42/7 = 6,0.
    expect(screen.getByText("8,9 weken")).toBeInTheDocument();
    expect(screen.getByText("6,0 weken")).toBeInTheDocument();

    // The count says GEKOPPELD, not "gedekt": doelcodes are links, and Art. V.1 makes a doel gedekt only
    // once its thema is placed. Asserting the exact word is the point — "gedekt" here would be a false
    // coverage claim in the product whose purpose is provable coverage.
    expect(screen.getByText("2 doelen gekoppeld")).toBeInTheDocument();
    expect(screen.queryByText(/gedekt/)).toBeNull();

    expect(screen.getByText(/past bij het begin van het schooljaar/)).toBeInTheDocument();
  });

  it("shows a stale placement in a non-dismissible notice instead of dropping it", async () => {
    stubFetch(
      maakJaarplan([
        {
          id: "p2",
          themaId: "t2",
          themaNaam: "Feesten in december",
          blokNiveau: "Themaperiode",
          // A date that is no longer the start of any derived block.
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Aanvaard",
          aiMotivatie: null,
          vergrendeld: true,
          doelcodes: ["MUZ-L3-02"],
        },
      ]),
    );
    renderKalender();

    const melding = await screen.findByRole("alert");

    // The thema is named, not merely counted — a teacher must see which plan item needs attention.
    expect(melding).toHaveTextContent("Feesten in december");
    expect(melding).toHaveTextContent("Te herzien");

    // And there is no way to dismiss it (directie 2026-07-28: "fix later" is not an option offered).
    // Checked for links as well as buttons: with no buttons anywhere in the feature, asserting only
    // `queryByRole("button")` would pass vacuously and would not catch a dismiss control added as an <a>.
    expect(within(melding).queryByRole("button")).toBeNull();
    expect(within(melding).queryByRole("link")).toBeNull();

    // It must NOT claim a coverage figure: this thema sits in no period, so under Art. V.1 nothing it
    // links to is gedekt — and the notice itself says the plan's dekking is untrustworthy while this holds.
    expect(melding).toHaveTextContent("Dekking onbekend");
    expect(melding).not.toHaveTextContent("1 doel gekoppeld");
  });

  it("has no axe violations on a POPULATED plan", async () => {
    // Populated deliberately. An earlier revision ran axe over `maakJaarplan([])` — an empty ribbon with
    // no card, no badge, no lock and no alert, i.e. none of the components most likely to carry a
    // violation. This renders a te-vol period, a locked accepted card, a motivation and the stale alert.
    stubFetch(
      maakJaarplan([
        maakPlaatsing({ id: "a", themaNaam: "Water", doelcodes: ["A-1", "A-2"] }),
        maakPlaatsing({ id: "b", themaNaam: "Wonen", status: "Aanvaard", vergrendeld: true }),
        maakPlaatsing({ id: "c", themaNaam: "Gezond eten", status: "Manueel" }),
        maakPlaatsing({
          id: "d",
          themaNaam: "Feesten in december",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
        }),
      ]),
    );
    const { container } = renderKalender();

    await screen.findByText("Water");
    // Premises for this test's reach: the te-vol flag and the stale alert are actually on screen.
    expect(screen.getByText(/Te vol/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
