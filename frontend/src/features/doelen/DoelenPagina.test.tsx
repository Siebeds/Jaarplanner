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

/** A token no user-facing copy contains, so a filled placeholder can be located unambiguously. */
const GAT = "@@GAT@@";

/**
 * Turns a catalogue template into an **anchored** regex, so a name is matched as a whole rather than by a
 * prefix. Used by the read-only control walk: a `startsWith` bucket is exactly how a stray control slips past
 * an allowlist, and it is how the bypassed `tAantal` on the paging button went unnoticed.
 */
function uitCatalogus(gevuld: string): RegExp {
  const delen = gevuld.split(GAT).map((deel) => deel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${delen.join(".+")}$`);
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
      name: /NAT-K3-01/,
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
      name: /VERVALLEN-1/,
    });
    expect(rij).toHaveTextContent(t("doelen.vervallenMarkering"));
    expect(rij).not.toHaveAttribute("title");
  });

  /**
   * The row's ACCESSIBLE NAME carries every signal a sighted reader gets.
   *
   * The row used to carry `aria-label="Leerplandoel X openen"`, and an `aria-label` on a link overrides the
   * name computed from its subtree: a screen-reader user therefore heard the code and nothing else, so the
   * Art. XII colour-plus-label redundancy was visual only, and the `nakijken` review flag was inaudible
   * (antagonist finding 6). Asserted on the accessible name rather than with `toHaveTextContent`, which cannot
   * see the difference and passed throughout.
   */
  it("puts the doelsoort, jaar/fase, text and review flag in the row's accessible name", async () => {
    renderApp();

    const gewoon = within(await lijst()).getByRole("link", { name: /NAT-K3-01/ });
    // The badge exposes the full Dutch doelsoort label as its accessible name, so that is what a screen
    // reader hears rather than the bare abbreviation.
    expect(gewoon).toHaveAccessibleName(expect.stringContaining(t("doelsoort.md")) as unknown as string);
    expect(gewoon).toHaveAccessibleName(expect.stringContaining("K3") as unknown as string);
    expect(gewoon).toHaveAccessibleName(
      expect.stringContaining("De kleuter observeert planten") as unknown as string,
    );

    const vervallen = within(await lijst()).getByRole("link", { name: /VERVALLEN-1/ });
    expect(vervallen).toHaveAccessibleName(
      expect.stringContaining(t("doelen.vervallenMarkering")) as unknown as string,
    );
  });
});

describe("Doelen register — paging (clause 1, at volume)", () => {
  /** `hoeveel` bulk rows, so the page size and the "meer laden" action have real work to do. */
  function veelDoelen(hoeveel = 120): DoelRegel[] {
    return Array.from({ length: hoeveel }, (_, i) => ({
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

  /**
   * The 51-row case: exactly one row left to load, so the paging button's count is 1.
   *
   * This is the test-runner's blocking finding, and the case the suite missed because every paging test used
   * `{ aantal: 50 }`. The button rendered `doelen.meerLaden` straight from the catalogue, giving **"Volgende 1
   * doelen laden"** — the fifth time this exact plural bug has shipped in this repo, twice inside a commit that
   * announced fixing it. `tAantal` exists so a new call site cannot reintroduce it; this one had bypassed it.
   */
  it("uses a singular sentence when exactly one doel is left to load", async () => {
    renderApp("/doelen", { doelen: veelDoelen(51), paginaGrootte: 50 });
    await lijst();

    expect(
      screen.getByRole("button", { name: t("doelen.meerLadenEnkelvoud") }),
    ).toBeInTheDocument();
    // And the ungrammatical form is nowhere on the screen.
    expect(screen.queryByText(t("doelen.meerLaden", { aantal: 1 }))).toBeNull();
  });

  it("uses the plural sentence when more than one doel is left", async () => {
    renderApp("/doelen", { doelen: veelDoelen(53), paginaGrootte: 50 });
    await lijst();

    expect(
      screen.getByRole("button", { name: t("doelen.meerLaden", { aantal: 3 }) }),
    ).toBeInTheDocument();
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

  it("accepts the official Op.stap short code in a hand-written link, not just the wire name", async () => {
    // Found by opening the app: `?doelsoort=MD` was silently dropped, so the register showed everything
    // while the URL claimed a filter. "MD" is what a teacher reads in Op.stap (Art. VII.1) and the API
    // accepts it, so the UI has no business refusing it.
    const fake = renderApp("/doelen?doelsoort=MD");
    await lijst();

    expect(screen.getByLabelText(t("doelen.doelsoortLabel"))).toHaveValue("Minimumdoel");
    expect(
      screen.getByText(t("doelen.chipDoelsoort", { waarde: t("doelsoort.md") })),
    ).toBeInTheDocument();
    // Normalised to one spelling on the wire, so the server is never asked twice in two dialects.
    expect(new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]).get("doelsoort")).toBe(
      "Minimumdoel",
    );
  });

  it("ignores a doelsoort that is neither spelling, rather than sending it on", async () => {
    const fake = renderApp("/doelen?doelsoort=bestaatniet");
    await lijst();

    expect(new URLSearchParams(laatsteLijstUrl(fake.urls)!.split("?")[1]).get("doelsoort")).toBeNull();
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

  /**
   * Option counts follow the active filter, so no control states a positive number and then delivers nothing.
   *
   * With Discipline = Wiskunde chosen, the only Wiskunde doel in the fixture is VERVALLEN-1 (domein Natuur /
   * Niet-levend), so every other domein must read 0 while still being offered. That is the ruling on antagonist
   * finding 12: scope the counts, keep the options, render a zero as "(0)".
   */
  it("scopes the option counts to the active filter and sends the filter to the server", async () => {
    const fake = renderApp(`/doelen?discipline=2`);
    await lijst();

    const domein = screen.getByLabelText(t("doelen.domeinLabel"));
    expect(
      within(domein).getByRole("option", {
        name: t("doelen.optieMetAantal", { naam: "Muziek", aantal: 0 }),
      }),
    ).toBeInTheDocument();
    expect(
      within(domein).getByRole("option", {
        name: t("doelen.optieMetAantal", { naam: "Natuur", aantal: 1 }),
      }),
    ).toBeInTheDocument();

    // The counts come from the server, not from arithmetic in the browser.
    const facettenUrl = [...fake.urls].reverse().find((url) => url.includes("/facetten"));
    expect(new URLSearchParams(facettenUrl!.split("?")[1]).get("discipline")).toBe("2");
  });

  it("keeps a zero-count option selectable rather than hiding it", async () => {
    // Whether a zero-count option should disappear entirely is an open directie question; today it stays, so a
    // teacher can still choose it and see the honest empty result rather than wondering where it went.
    renderApp(`/doelen?discipline=2`);
    await lijst();

    const domein = screen.getByLabelText(t("doelen.domeinLabel"));
    expect(within(domein).getAllByRole("option")).toHaveLength(FACETTEN.domeinen.length + 1);
  });
});

describe("Doelen register — the four empty states (clause 1/2/3, plus the unknown one)", () => {
  /**
   * **The fourth state: we have not asked yet.**
   *
   * `heeftCurriculum` was `(facetten.data?.totaalAantalDoelen ?? 0) > 0`, checked *before* the loading branch,
   * so on every cold visit the register's first paint said "Er zijn nog geen doelen van Op.stap ingeladen ...
   * vraag het aan wie de tool beheert" (antagonist finding 1). Every existing test walked past it, because
   * `await findByText` resolves after the query settles; this one asserts on the FIRST render, before any await.
   */
  it("never claims the curriculum is missing before the question has been answered", () => {
    renderApp("/doelen", { doelen: [], facetten: { ...FACETTEN, totaalAantalDoelen: 0 } });

    // Synchronous: nothing has resolved yet. The honest answer at this instant is "laden", not a claim about
    // what the school has ever imported.
    expect(screen.queryByText(t("doelen.geenCurriculumTitel"))).toBeNull();
    expect(screen.queryByText(t("doelen.geenCurriculumUitleg"))).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(t("doelen.laden"));
  });

  /**
   * A facets failure must not turn into "nothing is imported" either, which is what it did permanently: the
   * boolean read false for a failed query exactly as it did for an empty one, so the register showed the
   * beheerder message next to the error alert for as long as the page stayed open.
   */
  it("reports a facets failure as a failure, not as an unimported curriculum", async () => {
    const fake = maakDoelenFetchFake();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname === "/api/leerplandoelen/facetten") {
          return new Response("kapot", { status: 500 });
        }
        return fake.fetchFake(input);
      }),
    );

    window.history.pushState({}, "", "/doelen");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );

    // The fault is reported ONCE, by the panel, where the missing controls are. It deliberately does not
    // render `doelen.fout` ("De doelen konden niet geladen worden") here: the doelen loaded fine and are on
    // screen, so that sentence would be false, and it used to sit one element above the accurate one.
    expect(await screen.findByText(t("doelen.keuzelijstenOnbeschikbaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.fout"))).toBeNull();
    expect(screen.queryByText(t("doelen.geenCurriculumTitel"))).toBeNull();
    // And the rows that DID load are still shown: a failed facets request is no reason to hide the register.
    expect(within(await lijst()).getAllByRole("listitem")).toHaveLength(DOELEN.length);
  });

  /**
   * **The combination that needs the three-valued type, not just the branch order.**
   *
   * Facets fail *and* the filtered list is empty. Under the old boolean, `(undefined ?? 0) > 0` is false, so the
   * register concluded "leeg" from a request that had **errored** and told the teacher the school had never
   * imported Op.stap. The ordering fix alone does not catch this: the list query has resolved, so nothing is
   * pending, and the count really is zero. Only distinguishing "we do not know" from "we know it is zero" does.
   *
   * Written after checking: with the ordering fixed but the boolean restored, every other test in this file
   * still passed. A fix whose test survives reverting it is not pinned.
   */
  it("does not conclude the curriculum is empty from a facets request that failed", async () => {
    const fake = maakDoelenFetchFake();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname === "/api/leerplandoelen/facetten") {
          return new Response("kapot", { status: 500 });
        }
        return fake.fetchFake(input);
      }),
    );

    // A search term nothing matches, so the list legitimately resolves to zero rows.
    window.history.pushState({}, "", "/doelen?zoek=bestaatabsoluutniet");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );

    // The neutral message, because the register genuinely cannot tell which empty state it is in.
    expect(await screen.findByText(t("doelen.geenResultaatTitel"))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.geenCurriculumTitel"))).toBeNull();
    expect(screen.queryByText(t("doelen.geenCurriculumUitleg"))).toBeNull();
  });

  /**
   * **A filtered register must never render without a visible filter** (antagonist, round 2).
   *
   * The realistic case is a shared link like `/doelen?domein=Natuur` on a moment the facets request fails. The
   * filter panel used to render only `if (facetten.data)`, so the teacher saw rows, an error alert, and no chip,
   * no "wis alle filters" and a count line reading "N van N doelen getoond" for a view that was silently
   * narrowed. The only escape was the URL bar. The list's own clear action does not help: it appears solely in
   * the zero-result branch, and this view has results.
   */
  it("keeps the active filters visible and clearable when the option lists fail to load", async () => {
    const fake = maakDoelenFetchFake();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname === "/api/leerplandoelen/facetten") {
          return new Response("kapot", { status: 500 });
        }
        return fake.fetchFake(input);
      }),
    );

    window.history.pushState({}, "", "/doelen?domein=Natuur");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );

    // The chip names the filter that is narrowing the view...
    expect(await screen.findByText(t("doelen.chipDomein", { waarde: "Natuur" }))).toBeInTheDocument();
    // ...and the screen never claims the doelen failed to load while it is showing them.
    expect(screen.queryByText(t("doelen.fout"))).toBeNull();
    // ...there is a way out that is not the URL bar...
    expect(screen.getByRole("button", { name: t("doelen.wisAlles") })).toBeInTheDocument();
    // ...the missing half says it is missing, rather than leaving a teacher to wonder...
    expect(screen.getByText(t("doelen.keuzelijstenOnbeschikbaar"))).toBeInTheDocument();
    // ...searching still works, since it needs no facets at all...
    expect(screen.getByLabelText(t("doelen.zoekLabel"))).toBeInTheDocument();
    // ...and the selects, which genuinely cannot be populated, are gone rather than empty.
    expect(screen.queryByLabelText(t("doelen.disciplineLabel"))).toBeNull();
  });

  /**
   * The chip must name the discipline, not its number. The select offers "Nederlands en communicatie (50)"
   * while the chip read "Discipline: 1", and its remove-label read `Filter "Discipline: 1" verwijderen`. For a
   * teacher, "9.2" identifies nothing, and the name was already in the facets.
   */
  it("names the discipline in its chip rather than showing its number", async () => {
    renderApp("/doelen?discipline=1");

    const naam = FACETTEN.disciplines.find((d) => d.nummer === "1")!.naam!;
    expect(await screen.findByText(t("doelen.chipDiscipline", { waarde: naam }))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.chipDiscipline", { waarde: "1" }))).toBeNull();
    expect(
      screen.getByRole("button", {
        name: t("doelen.chipVerwijder", { waarde: t("doelen.chipDiscipline", { waarde: naam }) }),
      }),
    ).toBeInTheDocument();
  });

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
      within(await lijst()).getByRole("link", { name: /NAT-K3-01/ }),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/doelen/NAT-K3-01"));
    expect(
      await screen.findByRole("region", { name: t("doelen.detailLabel") }),
    ).toBeInTheDocument();
  });

  it("honours the browser Back button after opening a doel", async () => {
    renderApp();

    fireEvent.click(
      within(await lijst()).getByRole("link", { name: /NAT-K3-01/ }),
    );
    await waitFor(() => expect(window.location.pathname).toBe("/doelen/NAT-K3-01"));

    window.history.back();

    await waitFor(() => expect(window.location.pathname).toBe("/doelen"));
  });

  it("keeps the filters in the URL when a doel is opened, so the link shares the same view", async () => {
    renderApp("/doelen?domein=Natuur");
    await lijst();

    fireEvent.click(
      within(await lijst()).getByRole("link", { name: /NAT-K3-01/ }),
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
    //
    // The allowlist is built from the CATALOGUE, matched whole. It used to accept anything whose name began
    // with "Volgende", which the test-runner rightly called out as too loose: an unrelated control starting
    // with that word would have slipped through, and it also let the plural bug hide behind the bucket
    // (`meerLaden` was rendered without `tAantal` and this loop waved it past).
    const toegestaan = new Set([
      t("doelen.zoeken"),
      t("doelen.wisAlles"),
      t("doelen.terugNaarLijst"),
      t("doelen.meerLadenBezig"),
      t("doelen.meerLadenEnkelvoud"),
    ]);
    const patronen = [
      uitCatalogus(t("doelen.meerLaden", { aantal: GAT })),
      uitCatalogus(t("doelen.chipVerwijder", { waarde: GAT })),
    ];

    for (const knop of within(hoofdinhoud).queryAllByRole("button")) {
      const naam = knop.getAttribute("aria-label") ?? knop.textContent?.trim() ?? "";
      expect(
        toegestaan.has(naam) || patronen.some((patroon) => patroon.test(naam)),
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
    // BOTH regions awaited, like the read-only walk above. Awaiting only the detail ran axe over a screen whose
    // filters had not rendered, so the five selects and the search form this test claims to cover were simply
    // not there (antagonist finding 11) — and the un-awaited render was also one of the act() warnings.
    await screen.findByRole("region", { name: t("doelen.detailLabel") });
    await screen.findByLabelText(t("doelen.zoekLabel"));
    await lijst();

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
