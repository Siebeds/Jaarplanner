import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t, tAantal } from "../../i18n";
import { Doeldetail } from "./Doeldetail";
import {
  DETAIL_CONCORDANTIE_ZONDER_RIJ,
  DETAIL_KAAL,
  DETAIL_VERVALLEN,
  DETAIL_VOLLEDIG,
  maakDoelenFetchFake,
} from "./testdata";
import type { DoelDetail } from "./types";

/**
 * Pins the detail pane's own behaviour (E1-16 clause 3): every imported field, the absent-field handling, the
 * three concordance states and the school-content links with their status.
 *
 * Rendered on a `MemoryRouter` here rather than through the real `App`, because these are assertions about one
 * component's content: the routing, the deep link and the Back button are covered in `DoelenPagina.test.tsx`
 * against the real router, where they belong.
 */

function renderDetail(code: string) {
  const fake = maakDoelenFetchFake();
  vi.stubGlobal("fetch", vi.fn(fake.fetchFake));

  return monteer(code);
}

/** Renders one specific detail payload, for a shape the shared fixtures do not carry. */
function renderDetailMet(doel: DoelDetail) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(doel), { status: 200 })),
  );

  return monteer(doel.code);
}

function monteer(code: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/doelen/${code}`]}>
        <Routes>
          <Route path="/doelen/:code" element={<Doeldetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Doeldetail — every imported field", () => {
  it("shows the code, the doelsoort with its full Dutch label, and the jaar/fase", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);

    expect(await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code })).toBeInTheDocument();
    // The abbreviation alone is not enough on a detail: "P" means nothing to a teacher who has not
    // memorised the six doelsoorten, so the full label is spelled out next to the badge (Art. XII).
    expect(screen.getByText(t("doelsoortAfkorting.md"))).toBeInTheDocument();
    expect(screen.getByText(t("doelsoort.md"))).toBeInTheDocument();
    // Matched on the labelled form, not on a bare /K3/: the code "NAT-K3-01" contains it too.
    expect(
      screen.getByText(`${t("doelen.jaarFaseLabel")}: ${DETAIL_VOLLEDIG.jaarFase}`),
    ).toBeInTheDocument();
  });

  /**
   * The taxonomy line is the ordeningskader and nothing else: `discipline · domein · subdomein`.
   *
   * `cluster` used to be appended to it, which rendered it as a fourth taxonomy level (antagonist finding 7).
   * Art. VII.0's first rule is that Op.stap exposes two distinct structures and they must not be conflated:
   * cluster lives in the per-discipline goal Excel, not in the ordeningskader. It is a labelled field of its own
   * now, which is also how a reader can tell that a doel without one is not missing a level.
   */
  it("shows only the three ordeningskader levels on the place line", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.getByText("Nederlands en communicatie · Natuur · Levend")).toBeInTheDocument();
    expect(
      screen.queryByText("Nederlands en communicatie · Natuur · Levend · Planten"),
    ).toBeNull();
  });

  it("shows cluster as its own labelled field, not as a taxonomy level", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.getByText(t("doelen.clusterLabel"))).toBeInTheDocument();
    expect(screen.getByText("Planten")).toBeInTheDocument();
  });

  it("shows tekst, voorbeelden, toelichting and woordenschat, each labelled", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.getByText(DETAIL_VOLLEDIG.tekst)).toBeInTheDocument();
    expect(screen.getByText(t("doelen.voorbeeldenLabel"))).toBeInTheDocument();
    expect(screen.getByText("een wandeling in het park")).toBeInTheDocument();
    expect(screen.getByText(t("doelen.toelichtingLabel"))).toBeInTheDocument();
    expect(screen.getByText("Observeren gaat voor benoemen.")).toBeInTheDocument();
    expect(screen.getByText(t("doelen.woordenschatLabel"))).toBeInTheDocument();
    expect(screen.getByText("blad, stam, wortel")).toBeInTheDocument();
    // Both are illustratief/richtinggevend, and the detail says so rather than presenting them as required.
    expect(screen.getByText(t("doelen.voorbeeldenUitleg"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.woordenschatUitleg"))).toBeInTheDocument();
  });
});

describe("Doeldetail — absent fields are absent, not blank", () => {
  it("omits an optional section entirely when Op.stap left the column empty", async () => {
    renderDetail(DETAIL_KAAL.code);
    await screen.findByRole("heading", { name: DETAIL_KAAL.code });

    // A heading with nothing under it tells a teacher the tool lost something, so the heading is not there.
    expect(screen.queryByText(t("doelen.voorbeeldenLabel"))).toBeNull();
    expect(screen.queryByText(t("doelen.toelichtingLabel"))).toBeNull();
    expect(screen.queryByText(t("doelen.woordenschatLabel"))).toBeNull();
  });

  /**
   * A doel with no cluster shows no cluster section at all.
   *
   * This assertion used to be vacuous: it checked that `doelen.clusterLabel` was absent while the app never
   * rendered that key in either case, so it read as coverage of the nullable-cluster branch and proved nothing
   * (antagonist finding 9). It is meaningful now that the label is actually rendered when a cluster exists,
   * which the sibling test above pins.
   */
  it("omits the cluster section entirely when Op.stap left the column empty", async () => {
    renderDetail(DETAIL_KAAL.code);
    await screen.findByRole("heading", { name: DETAIL_KAAL.code });

    expect(screen.getByText("Nederlands en communicatie · Natuur · Levend")).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.clusterLabel"))).toBeNull();
    // The full-field fixture DOES render it, so the negative above is a real distinction and not an absence
    // that holds for every doel.
    expect(DETAIL_VOLLEDIG.cluster).not.toBeNull();
  });
});

describe("Doeldetail — the minimumdoel concordance (clause 3, and E1-12's gap)", () => {
  it("says plainly that a doel is not concorded", async () => {
    renderDetail(DETAIL_KAAL.code);
    await screen.findByRole("heading", { name: DETAIL_KAAL.code });

    expect(screen.getByText(t("doelen.minimumdoelLabel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.minimumdoelGeen"))).toBeInTheDocument();
  });

  it("shows the decreed omschrijving when the minimumdoel row is loaded", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.getByText(t("doelen.minimumdoelRef", { ref: "K-12" }))).toBeInTheDocument();
    expect(
      screen.getByText("De kleuter verkent de natuur in de omgeving."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t("doelen.minimumdoelLeeftijd", { leeftijd: "K-", nr: "12" })),
    ).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.minimumdoelNietIngeladen"))).toBeNull();
  });

  it("keeps the ref and says the decreed text is not loaded, which is not the same as not concorded", async () => {
    // Not reachable in the database today (`MinimumdoelRef` is a Restrict FK, so this state fails to commit
    // with SQLSTATE 23503 — the E1-03/E1-04 blockage E1-12 unblocks), and pinned here because the read view
    // models the two fields separately. Saying "geen minimumdoel" here would be false; an empty section
    // would look like a bug. §3's "+ minimumdoelen" destination is deliberately not built, because no row
    // can exist to fill it (E3-06's rule).
    renderDetail(DETAIL_CONCORDANTIE_ZONDER_RIJ.code);
    await screen.findByRole("heading", { name: DETAIL_CONCORDANTIE_ZONDER_RIJ.code });

    expect(screen.getByText(t("doelen.minimumdoelRef", { ref: "4-07" }))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.minimumdoelNietIngeladen"))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.minimumdoelGeen"))).toBeNull();
  });
});

describe("Doeldetail — where this doel occurs (clause 3)", () => {
  it("lists every link layer with its thema, its onderdeel and its status", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.getByText(t("doelen.koppelingenLabel"))).toBeInTheDocument();
    // Through tAantal, like every other count on this screen.
    expect(
      screen.getByText(
        tAantal(4, "doelen.koppelingenAantalEnkelvoud", "doelen.koppelingenAantal"),
      ),
    ).toBeInTheDocument();

    expect(screen.getByText(t("doelen.herkomstThemadoel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.herkomstDoelsuggestie"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.herkomstSubdoel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.herkomstActiviteit"))).toBeInTheDocument();
    expect(screen.getByText("Bladeren")).toBeInTheDocument();
    expect(screen.getByText("Bladeren zoeken")).toBeInTheDocument();

    // Every status, including the ones coverage does not count. The question this screen answers is "where does
    // this doel appear and what was decided?", which is wider than Art. V's aanvaard/manueel.
    expect(screen.getByText(t("suggestieStatus.manueel"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.voorgesteld"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.aanvaard"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.geweigerd"))).toBeInTheDocument();
  });

  /**
   * The section asks a neutral question and does not call an open or rejected suggestion "usage".
   *
   * It was headed "Gebruikt in thema's" over a list that includes `Voorgesteld` and `Geweigerd` links, which
   * counts an AI suggestion nobody has decided on, and one a teacher explicitly *rejected*, as usage. That
   * nudges toward a coverage conclusion Art. V.1 does not support: only `aanvaard` and `manueel` make a
   * leerplandoel gedekt (antagonist finding 8).
   */
  it("does not present an open or rejected suggestion as usage", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.getByText(t("doelen.koppelingenLabel"))).toBeInTheDocument();
    expect(screen.queryByText("Gebruikt in thema's")).toBeNull();
    // And the count line says outright which statuses count for dekking, so a reader cannot take the number
    // for a coverage figure.
    expect(t("doelen.koppelingenAantal", { aantal: 4 })).toContain(t("suggestieStatus.aanvaard"));
    expect(t("doelen.koppelingenAantal", { aantal: 4 })).toContain(t("suggestieStatus.manueel"));
  });

  /**
   * Each occurrence states its scope: a subdoel or activiteit names its klas, a themadoel or suggestion says
   * "hele school" (Art. IX.2, antagonist finding 3). Without it, one class's planning reads as a school-wide
   * fact, which is the misreading the whole `Koppelingzichtbaarheid` seam exists around.
   */
  it("names the klas on a class-scoped occurrence and says school-wide on the others", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(
      screen.getByText(t("doelen.koppelingKlas", { klas: "L3 derde leerjaar" })),
    ).toBeInTheDocument();
    expect(screen.getByText(t("doelen.koppelingKlas", { klas: "K3 groen" }))).toBeInTheDocument();
    // Two school-wide layers in the fixture, so the label appears twice.
    expect(screen.getAllByText(t("doelen.koppelingSchoolbreed"))).toHaveLength(2);
  });

  /**
   * A class-scoped link whose klas did not resolve says so, rather than falling through to "hele school".
   * The label is keyed on the herkomst for exactly this reason: the fallback must not invent a school-wide
   * claim, which is the error this whole finding is about.
   */
  it("says the klas is unknown rather than claiming a class-scoped link is school-wide", async () => {
    const zonderKlas: DoelDetail = {
      ...DETAIL_KAAL,
      koppelingen: [
        {
          herkomst: "Subdoel",
          themaNaam: "Herfst",
          onderdeel: "Bladeren",
          klasNaam: null,
          status: "Aanvaard",
        },
      ],
    };

    renderDetailMet(zonderKlas);
    await screen.findByRole("heading", { name: zonderKlas.code });

    expect(screen.getByText(t("doelen.koppelingKlasOnbekend"))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.koppelingSchoolbreed"))).toBeNull();
  });

  it("says so when no thema references the doel", async () => {
    renderDetail(DETAIL_KAAL.code);
    await screen.findByRole("heading", { name: DETAIL_KAAL.code });

    expect(screen.getByText(t("doelen.koppelingenGeen"))).toBeInTheDocument();
  });
});

describe("Doeldetail — the review flag", () => {
  it("explains that the doel disappeared from Op.stap while still in use", async () => {
    renderDetail(DETAIL_VERVALLEN.code);
    await screen.findByRole("heading", { name: DETAIL_VERVALLEN.code });

    expect(screen.getByText(t("doelen.vervallenTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.vervallenUitleg"))).toBeInTheDocument();
  });

  it("shows no review flag on a doel Op.stap still carries", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(screen.queryByText(t("doelen.vervallenTitel"))).toBeNull();
  });
});
