import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t } from "../../i18n";
import { DOELEN, FACETTEN, maakDoelenFetchFake } from "./testdata";
import type { FakeOpties } from "./testdata";
import type { DoelRegel } from "./types";

/**
 * Pins the Doelen register (E1-16, FR-2.4) against the **real** `App`, so the nested `/doelen/:code` route,
 * the URL as the source of truth (ADR-0021) and the real `nl.json` copy are all under test rather than a
 * `MemoryRouter` stand-in.
 *
 * The fetch fake in `testdata.ts` filters and pages **server-side**. That matters: a screen that fetched the
 * whole register and narrowed it in the browser would satisfy a fake that ignores the query string, and it is
 * exactly what this story forbids. So the filter tests assert both what is on screen and that the request
 * carried the filter.
 */

function renderApp(pad = "/doelen", opties: FakeOpties = {}) {
  const fake = maakDoelenFetchFake(opties);
  vi.stubGlobal("fetch", vi.fn(fake.fetchFake));

  window.history.pushState({}, "", pad);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  // StrictMode because `main.tsx` is: effects double-invoke in development, and this repo has already had a
  // bug that passed a gentler harness and failed in a browser.
  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );

  return fake;
}

/** The register list, awaited: it appears once the facets and the first page have resolved. */
function lijst() {
  return screen.findByRole("list", { name: t("doelen.lijstLabel") });
}

/** The last request the screen made to the register endpoint. */
function laatsteLijstUrl(urls: string[]) {
  return [...urls].reverse().find((url) => url.startsWith("/api/leerplandoelen?"));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Doelen register — the row list (clause 1)", () => {
  it("renders one row per doel with code, doelsoort, jaar/fase, taxonomy and text", async () => {
    renderApp();

    const rijen = within(await lijst()).getAllByRole("listitem");
    expect(rijen).toHaveLength(DOELEN.length);

    const eerste = within(await lijst()).getByRole("link", {
      name: t("doelen.openDoel", { code: "NAT-K3-01" }),
    });
    expect(eerste).toHaveTextContent("NAT-K3-01");
    expect(eerste).toHaveTextContent("K3");
    expect(eerste).toHaveTextContent("De kleuter observeert planten in de omgeving.");
    expect(eerste).toHaveTextContent(
      t("ongekoppeld.domeinKop", { domein: "Natuur", subdomein: "Levend" }),
    );
    // Colour is never the sole signal (Art. XII): the doelsoort edge is redundant with this abbreviation.
    expect(eerste).toHaveTextContent(t("doelsoortAfkorting.md"));
  });

  it("states read-only once, above the list, and never per row", async () => {
    renderApp();
    await lijst();

    expect(screen.getAllByText(t("doelen.leesAlleen"))).toHaveLength(1);
  });

  it("counts through tAantal, so a single result does not read as plural", async () => {
    // One row: the singular catalogue entry must win. "1 doelen" has shipped in this repo four times.
    renderApp("/doelen", { doelen: [DOELEN[0]] });
    await lijst();

    expect(screen.getByText(t("doelen.aantalGetoondEnkelvoud"))).toBeInTheDocument();
    expect(
      screen.queryByText(t("doelen.aantalGetoond", { geladen: 1, aantal: 1 })),
    ).not.toBeInTheDocument();
  });

  it("uses the plural form and reports how many of the total are on screen", async () => {
    renderApp();
    await lijst();

    expect(
      screen.getByText(
        t("doelen.aantalGetoond", { geladen: DOELEN.length, aantal: DOELEN.length }),
      ),
    ).toBeInTheDocument();
  });

  it("flags a doel that is no longer in Op.stap in visible text, not by colour or a tooltip", async () => {
    renderApp();

    const rij = within(await lijst()).getByRole("link", {
      name: t("doelen.openDoel", { code: "VERVALLEN-1" }),
    });
    expect(rij).toHaveTextContent(t("doelen.vervallenMarkering"));
    expect(rij).not.toHaveAttribute("title");
  });
});

describe("Doelen register — paging (clause 1, at volume)", () => {
  /** 120 rows, so the page size and the "meer laden" action both have real work to do. */
  function veelDoelen(): DoelRegel[] {
    return Array.from({ length: 120 }, (_, i) => ({
      code: `VOL-${String(i).padStart(4, "0")}`,
      doelsoort: "Gemeenschappelijk" as const,
      jaarFase: "L1",
      domein: "Volume",
      subdomein: `Deel ${i % 3}`,
      tekst: `Bulkdoel nummer ${i}.`,
      minimumdoelRef: null,
      nietMeerInOpstap: false,
    }));
  }

  it("asks the server for a bounded page, never for the whole register", async () => {
    const fake = renderApp("/doelen", { doelen: veelDoelen(), paginaGrootte: 50 });
    await lijst();

    const url = new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]);
    expect(url.get("aantal")).toBe("50");
    expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(50);
  });

  it("loads the next page on demand and keeps the rows already on screen", async () => {
    renderApp("/doelen", { doelen: veelDoelen(), paginaGrootte: 50 });
    await lijst();

    fireEvent.click(screen.getByRole("button", { name: t("doelen.meerLaden", { aantal: 50 }) }));

    await waitFor(async () =>
      expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(100),
    );
    // The first page is still there: "meer laden" appends, it does not replace.
    expect(screen.getByText("VOL-0000")).toBeInTheDocument();
    expect(screen.getByText("VOL-0099")).toBeInTheDocument();
  });

  it("stops offering more once the last row is on screen", async () => {
    renderApp("/doelen", { doelen: DOELEN, paginaGrootte: 50 });
    await lijst();

    expect(screen.queryByRole("button", { name: /laden/i })).toBeNull();
  });
});

describe("Doelen register — filters (clause 2)", () => {
  it("searches on code and on free text, through the server", async () => {
    const fake = renderApp();
    await lijst();

    fireEvent.change(screen.getByLabelText(t("doelen.zoekLabel")), {
      target: { value: "seizoenen" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("doelen.zoeken") }));

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("zoek")).toBe("seizoenen");
    });
    await waitFor(() =>
      expect(new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]).get("zoek")).toBe(
        "seizoenen",
      ),
    );
    await waitFor(async () =>
      expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(1),
    );
    expect(screen.getByText("NAT-K3-02")).toBeInTheDocument();
  });

  it("filters by discipline, and offers only the disciplines the data holds", async () => {
    const fake = renderApp();
    await lijst();

    const keuze = screen.getByLabelText(t("doelen.disciplineLabel"));
    // Built from the facets (Art. XIV: which disciplines are in scope is not decided), so a discipline with
    // no loaded goals is not offered at all.
    expect(within(keuze).getAllByRole("option")).toHaveLength(FACETTEN.disciplines.length + 1);
    expect(
      within(keuze).getByRole("option", {
        name: t("doelen.optieMetAantal", { naam: "Wiskunde", aantal: 1 }),
      }),
    ).toBeInTheDocument();

    fireEvent.change(keuze, { target: { value: "2" } });

    await waitFor(() =>
      expect(new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]).get("discipline")).toBe(
        "2",
      ),
    );
    await waitFor(async () =>
      expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(1),
    );
  });

  it("filters by doelsoort, using the Dutch label rather than the wire name", async () => {
    const fake = renderApp();
    await lijst();

    const keuze = screen.getByLabelText(t("doelen.doelsoortLabel"));
    expect(
      within(keuze).getByRole("option", {
        name: t("doelen.optieMetAantal", { naam: t("doelsoort.md"), aantal: 1 }),
      }),
    ).toBeInTheDocument();

    fireEvent.change(keuze, { target: { value: "Minimumdoel" } });

    await waitFor(() =>
      expect(new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]).get("doelsoort")).toBe(
        "Minimumdoel",
      ),
    );
    await waitFor(async () =>
      expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(1),
    );
  });

  it("filters by jaar/fase from the data, so the 1K/2K/3K question stays unanswered", async () => {
    const fake = renderApp();
    await lijst();

    const keuze = screen.getByLabelText(t("doelen.jaarFaseLabel"));
    // Exactly the codes the loaded rows carry, in the form they carry them. Nothing here decides whether
    // Op.stap writes K3 or 3K (Art. XIV).
    expect(within(keuze).getAllByRole("option")).toHaveLength(FACETTEN.jaarFasen.length + 1);

    fireEvent.change(keuze, { target: { value: "K3" } });

    await waitFor(() =>
      expect(new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]).get("jaarFase")).toBe(
        "K3",
      ),
    );
    await waitFor(async () =>
      expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(2),
    );
  });

  it("keeps subdomein disabled until a domein is chosen, and then offers only that domein's", async () => {
    renderApp();
    await lijst();

    const subdomein = screen.getByLabelText(t("doelen.subdomeinLabel"));
    // Art. VII.0: subdomein names are not globally unique, so an unqualified subdomein filter would mix
    // unrelated goals. "Bouwstenen" exists under both Muziek and Beeld in this fixture.
    expect(subdomein).toBeDisabled();
    expect(
      within(subdomein).getByRole("option", { name: t("doelen.eerstDomein") }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t("doelen.domeinLabel")), { target: { value: "Natuur" } });

    await waitFor(() => expect(subdomein).toBeEnabled());
    expect(within(subdomein).getAllByRole("option")).toHaveLength(3);
    expect(within(subdomein).getByRole("option", { name: /Levend \(2\)/ })).toBeInTheDocument();
    expect(within(subdomein).queryByRole("option", { name: /Bouwstenen/ })).toBeNull();
  });

  it("sends the domein alongside the subdomein, never the subdomein on its own", async () => {
    const fake = renderApp();
    await lijst();

    fireEvent.change(screen.getByLabelText(t("doelen.domeinLabel")), { target: { value: "Muziek" } });
    await waitFor(() => expect(screen.getByLabelText(t("doelen.subdomeinLabel"))).toBeEnabled());
    fireEvent.change(screen.getByLabelText(t("doelen.subdomeinLabel")), {
      target: { value: "Bouwstenen" },
    });

    await waitFor(() => {
      const url = new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]);
      expect(url.get("domein")).toBe("Muziek");
      expect(url.get("subdomein")).toBe("Bouwstenen");
    });
    await waitFor(async () =>
      expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(1),
    );
    expect(screen.getByText("MUZ-L2-01")).toBeInTheDocument();
  });

  it("drops a subdomein that arrives in a link without its domein", async () => {
    // A stale or hand-edited link. Sending the subdomein alone would silently mix Muziek's and Beeld's
    // identically-named subdomein (Art. VII.0), so it is not sent at all.
    const fake = renderApp("/doelen?subdomein=Bouwstenen");
    await lijst();

    const url = new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]);
    expect(url.get("subdomein")).toBeNull();
    expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(DOELEN.length);
  });

  it("restores a filtered view from the URL, so a filtered register is shareable", async () => {
    renderApp("/doelen?domein=Natuur&doelsoort=Minimumdoel");
    await lijst();

    expect(screen.getByLabelText(t("doelen.domeinLabel"))).toHaveValue("Natuur");
    expect(screen.getByLabelText(t("doelen.doelsoortLabel"))).toHaveValue("Minimumdoel");
    expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows each active filter as a removable chip, and removes just that one", async () => {
    renderApp("/doelen?domein=Natuur&jaarFase=K3");
    await lijst();

    const chip = t("doelen.chipDomein", { waarde: "Natuur" });
    expect(screen.getByText(chip)).toBeInTheDocument();
    expect(screen.getByText(t("doelen.chipJaarFase", { waarde: "K3" }))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("doelen.chipVerwijder", { waarde: chip }) }));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.has("domein")).toBe(false);
      expect(params.get("jaarFase")).toBe("K3");
    });
  });

  it("clears everything with one action", async () => {
    renderApp("/doelen?domein=Natuur&jaarFase=K3&zoek=planten");
    await lijst();

    fireEvent.click(screen.getByRole("button", { name: t("doelen.wisAlles") }));

    await waitFor(() => expect(window.location.search).toBe(""));
    expect(await lijst()).toBeInTheDocument();
  });

  it("shows no chips and no clear action when nothing is filtered", async () => {
    renderApp();
    await lijst();

    expect(screen.queryByRole("button", { name: t("doelen.wisAlles") })).toBeNull();
  });
});

describe("Doelen register — the three empty states (clause 1/2/3)", () => {
  it("says the curriculum is not loaded, and that loading it is beheerderswerk", async () => {
    renderApp("/doelen", {
      doelen: [],
      facetten: { ...FACETTEN, totaalAantalDoelen: 0 },
    });

    expect(await screen.findByText(t("doelen.geenCurriculumTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.geenCurriculumUitleg"))).toBeInTheDocument();

    // It must NOT be confused with the filtered-to-nothing state...
    expect(screen.queryByText(t("doelen.geenResultaatTitel"))).toBeNull();
    // ...and it offers no control, because the Op.stap import trigger is E1-15 and is not built. A button
    // that goes nowhere teaches a review the wrong thing (E3-06).
    expect(screen.queryByRole("button", { name: t("doelen.wisAlles") })).toBeNull();
  });

  it("says the filters exclude everything, and offers to clear them", async () => {
    renderApp("/doelen?zoek=bestaatniet");

    expect(await screen.findByText(t("doelen.geenResultaatTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.geenResultaatUitleg"))).toBeInTheDocument();
    // Not the same message as an unimported curriculum: this teacher set the filter themselves, and sending
    // them to the beheerder would be wrong. Collapsing the two is the defect (E1-07's audit).
    expect(screen.queryByText(t("doelen.geenCurriculumTitel"))).toBeNull();

    const wis = screen.getAllByRole("button", { name: t("doelen.wisAlles") });
    fireEvent.click(wis[wis.length - 1]);

    expect(await lijst()).toBeInTheDocument();
  });

  it("says a doel does not exist when the URL names an unknown code", async () => {
    renderApp("/doelen/BESTAAT-NIET-1");

    expect(await screen.findByText(t("doelen.onbekendTitel"))).toBeInTheDocument();
    expect(
      screen.getByText(t("doelen.onbekendUitleg", { code: "BESTAAT-NIET-1" })),
    ).toBeInTheDocument();
    // A third distinct state: neither of the list's two messages appears.
    expect(screen.queryByText(t("doelen.geenCurriculumTitel"))).toBeNull();
    expect(screen.queryByText(t("doelen.geenResultaatTitel"))).toBeNull();
  });
});

describe("Doelen register — opening one doel (clause 3)", () => {
  it("opens the detail on its own deep-linkable route", async () => {
    renderApp();

    fireEvent.click(
      within(await lijst()).getByRole("link", { name: t("doelen.openDoel", { code: "NAT-K3-01" }) }),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/doelen/NAT-K3-01"));
    expect(
      await screen.findByRole("region", { name: t("doelen.detailLabel") }),
    ).toBeInTheDocument();
  });

  it("honours the browser Back button after opening a doel", async () => {
    renderApp();

    fireEvent.click(
      within(await lijst()).getByRole("link", { name: t("doelen.openDoel", { code: "NAT-K3-01" }) }),
    );
    await waitFor(() => expect(window.location.pathname).toBe("/doelen/NAT-K3-01"));

    window.history.back();

    await waitFor(() => expect(window.location.pathname).toBe("/doelen"));
  });

  it("keeps the filters in the URL when a doel is opened, so the link shares the same view", async () => {
    renderApp("/doelen?domein=Natuur");
    await lijst();

    fireEvent.click(
      within(await lijst()).getByRole("link", { name: t("doelen.openDoel", { code: "NAT-K3-01" }) }),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/doelen/NAT-K3-01"));
    expect(new URLSearchParams(window.location.search).get("domein")).toBe("Natuur");
  });

  it("prompts for a choice instead of showing an empty pane", async () => {
    renderApp();
    await lijst();

    expect(screen.getByText(t("doelen.kiesDoel"))).toBeInTheDocument();
  });
});

describe("Doelen register — read-only (clause 4)", () => {
  /**
   * The screen offers **no** mutating control (Art. III.1). Asserted structurally rather than by naming the
   * buttons that are absent, because the failure mode is a *new* control being added, not a known one
   * reappearing.
   *
   * The controls that legitimately exist are all read-side: the search field and its submit, the five
   * filter selects, the chips that remove a filter, "wis alle filters", "meer laden", and the links into
   * the read-only detail. Every one of them changes what is *shown*; none changes what is *stored*.
   */
  it("offers no control that could change a doel", async () => {
    renderApp("/doelen/NAT-K3-01");
    // Both halves of the screen must be up before the controls are counted: the filters render once the
    // facets resolve, and awaiting only the detail let this assertion run against a screen with no filters
    // on it, which is a weaker check than it looks.
    await screen.findByRole("region", { name: t("doelen.detailLabel") });
    await screen.findByLabelText(t("doelen.zoekLabel"));

    const hoofdinhoud = document.getElementById("hoofdinhoud")!;

    // No form field that could carry an edited value: no text input other than the search box, no textarea,
    // no checkbox, no radio.
    const tekstvelden = within(hoofdinhoud).queryAllByRole("textbox");
    expect(tekstvelden).toHaveLength(0);
    const zoekvelden = within(hoofdinhoud).queryAllByRole("searchbox");
    expect(zoekvelden).toHaveLength(1);
    expect(zoekvelden[0]).toHaveAccessibleName(t("doelen.zoekLabel"));
    expect(within(hoofdinhoud).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(hoofdinhoud).queryAllByRole("radio")).toHaveLength(0);
    expect(hoofdinhoud.querySelectorAll("textarea")).toHaveLength(0);
    // `contentEditable` would be an edit affordance no role query would catch.
    expect(hoofdinhoud.querySelectorAll("[contenteditable]")).toHaveLength(0);

    // Every button on the screen is one of the read-side actions, by accessible name.
    const toegestaan = new Set([
      t("doelen.zoeken"),
      t("doelen.wisAlles"),
      t("doelen.terugNaarLijst"),
    ]);
    for (const knop of within(hoofdinhoud).queryAllByRole("button")) {
      const naam = knop.getAttribute("aria-label") ?? knop.textContent?.trim() ?? "";
      const isFilterChip = naam.startsWith(t("doelen.chipVerwijder", { waarde: "" }).slice(0, 8));
      const isMeerLaden = naam.startsWith("Volgende") || naam === t("doelen.meerLadenBezig");
      expect(
        toegestaan.has(naam) || isFilterChip || isMeerLaden,
        `unexpected control on a read-only screen: "${naam}"`,
      ).toBe(true);
    }

    // And no form posts anywhere: the only form is the search, which is handled in the client.
    for (const formulier of hoofdinhoud.querySelectorAll("form")) {
      expect(formulier.getAttribute("action")).toBeNull();
      expect(formulier.getAttribute("method")).toBeNull();
    }
  });

  it("passes an axe structure check on the register and the detail", async () => {
    // Structure only. jsdom cannot evaluate colour, so a green run here says nothing about contrast — the
    // lesson from the two WCAG failures this repo shipped behind a green axe run. The palette is measured in
    // a real browser; see the worklog.
    renderApp("/doelen/NAT-K3-01");
    await screen.findByRole("region", { name: t("doelen.detailLabel") });

    expect(await axe(document.getElementById("hoofdinhoud")!)).toHaveNoViolations();
  });
});

describe("Doelen register — the nav destination", () => {
  it("no longer marks Doelen as unavailable, because a real screen answers it", async () => {
    renderApp();
    await lijst();

    const nav = screen.getByRole("navigation", { name: t("navigatie.hoofdnavigatie") });
    expect(
      within(nav).getByRole("link", { name: t("navigatie.doelen") }),
    ).toHaveAttribute("aria-current", "page");
  });
});

beforeEach(() => {
  // Each test installs its own fake through `renderApp`; this only guarantees a clean slate if one forgets.
  vi.unstubAllGlobals();
});
