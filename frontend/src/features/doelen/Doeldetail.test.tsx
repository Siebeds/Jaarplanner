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

  it("shows discipline, domein, subdomein and cluster as the place in Op.stap", async () => {
    renderDetail(DETAIL_VOLLEDIG.code);
    await screen.findByRole("heading", { name: DETAIL_VOLLEDIG.code });

    expect(
      screen.getByText("Nederlands en communicatie · Natuur · Levend · Planten"),
    ).toBeInTheDocument();
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

  it("omits cluster from the taxonomy line rather than rendering an empty value", async () => {
    renderDetail(DETAIL_KAAL.code);
    await screen.findByRole("heading", { name: DETAIL_KAAL.code });

    // Cluster is nullable and belongs to the goal Excel, not the ordeningskader (Art. VII.0): a trailing
    // separator would be a claim about the curriculum that Op.stap does not make.
    expect(screen.getByText("Nederlands en communicatie · Natuur · Levend")).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.clusterLabel"))).toBeNull();
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

describe("Doeldetail — the thema's that use this doel (clause 3)", () => {
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

    // Every status, including the ones coverage does not count. The question this screen answers is "where is
    // this doel used and what was decided?", which is wider than Art. V's aanvaard/manueel.
    expect(screen.getByText(t("suggestieStatus.manueel"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.voorgesteld"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.aanvaard"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.geweigerd"))).toBeInTheDocument();
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
