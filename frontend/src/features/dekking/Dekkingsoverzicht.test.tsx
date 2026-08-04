import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t, tAantal } from "../../i18n";
import { KLAS_ID, SCHOOLJAAR_ID, dekking, doel, maakDekkingFetchFake } from "./testdata";
import type { FakeOpties } from "./testdata";

/**
 * Pins the dekkingsoverzicht (E5-02, FR-9.1) against the **real** `App`, so the route, the URL as the source of truth
 * (ADR-0021) and the real `nl.json` copy are under test rather than a `MemoryRouter` stand-in.
 *
 * **Two things these tests are written to catch, because they are what would actually go wrong.** First, a figure
 * appearing in a state where the server refused to provide one: the assertions therefore check for the *absence* of a
 * coverage total, not merely the presence of the explanation, since a screen can show both. Second, a scope that only
 * exists in the browser: the fake answers `?bereik=` server-side and **refuses** an unknown or absent one, so a screen
 * that failed to state its denominator fails here instead of rendering something plausible.
 */

function renderApp(pad: string, opties: FakeOpties) {
  const fake = maakDekkingFetchFake(opties);
  vi.stubGlobal("fetch", vi.fn(fake.fetchFake));

  window.history.pushState({}, "", pad);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );

  return fake;
}

/** The overview for the seeded class, at the default scope. */
const MET_KLAS = `/dekking?schooljaar=${SCHOOLJAAR_ID}&klas=${KLAS_ID}`;

/** The summary region: the one place on this screen where a coverage total may appear. */
function samenvatting() {
  return screen.getByRole("region", { name: t("dekking.titel") });
}

/**
 * Any rendering of the coverage total, matched by the distinctive tail of both catalogue forms
 * ("… doelen gedekt" / "… doel gedekt").
 *
 * A test for the withheld state cannot simply assert "no digits on screen": the withheld copy legitimately carries the
 * count of unresolved placements, and every group still shows its own "1 van 2 gedekt" tally. What must be absent is
 * specifically a **total**, so the assertion matches the shape of one rather than the presence of numerals.
 */
const TOTAALVORM = /\bdoelen? gedekt\b/;

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Dekkingsoverzicht — de lijst (FR-9.1)", () => {
  it("shows each doel as covered or not, and names the thema that covers it", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    // The covered row carries the word as well as the hue (Art. XII, WCAG 2.2 AA), and the evidence beside it: a
    // screen that claims coverage has to say through what (Art. V).
    expect(await screen.findByText("NAT-K3-01")).toBeInTheDocument();
    expect(screen.getByText(t("dekking.gedekt"))).toBeInTheDocument();
    expect(screen.getByText(t("dekking.dekkendeThemas", { themas: "Herfst" }))).toBeInTheDocument();

    // And the uncovered one says so in words too.
    expect(screen.getByText("NAT-K3-02")).toBeInTheDocument();
    expect(screen.getByText(t("dekking.nietGedekt"))).toBeInTheDocument();
  });

  it("names every thema that covers one doel, not just the first", async () => {
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst", "Winter"] })],
        }),
      },
    });

    expect(
      await screen.findByText(t("dekking.dekkendeThemas", { themas: "Herfst, Winter" })),
    ).toBeInTheDocument();
  });

  it("groups the doelen per subdomein with a tally that matches its own rows", async () => {
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [
            doel({
              code: "A-01",
              subdomein: "Levende natuur",
              isGedekt: true,
              dekkendeThemas: ["Herfst"],
            }),
            doel({ code: "A-02", subdomein: "Levende natuur" }),
            doel({ code: "B-01", subdomein: "Niet-levende natuur" }),
          ],
        }),
      },
    });

    expect(
      await screen.findByText(
        t("ongekoppeld.domeinKop", { domein: "Natuur", subdomein: "Levende natuur" }),
      ),
    ).toBeInTheDocument();

    // "1 van 2 gedekt" for the first group, and the second reaches the SINGULAR form: the plural bug has shipped five
    // times in this repo, so a new count string gets its singular exercised rather than assumed.
    expect(
      screen.getByText(
        tAantal(2, "dekking.groepTellingEnkelvoud", "dekking.groepTelling", { gedekt: 1 }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        tAantal(1, "dekking.groepTellingEnkelvoud", "dekking.groepTelling", { gedekt: 0 }),
      ),
    ).toBeInTheDocument();
  });

  it("states what gedekt means, and that this is not the minimumdoel level, once at the top", async () => {
    // Both lines are load-bearing rather than decorative: the first is the definition every figure rests on, and the
    // second is what stops a directie reading this screen as the inspectie-proof it is not yet (E5-04, blocked on
    // E1-12).
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    expect(await screen.findByText(t("dekking.watGedekt"))).toBeInTheDocument();
    expect(screen.getByText(t("dekking.alleenLeerplandoelen"))).toBeInTheDocument();
  });
});

describe("Dekkingsoverzicht — het cijfer mag ontbreken (directie 2026-07-28)", () => {
  it("reports the figure when nothing is unresolved", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    expect(
      await screen.findByText(
        tAantal(2, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 1 }),
      ),
    ).toBeInTheDocument();
  });

  it("uses the singular when exactly one doel is in scope", async () => {
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst"] })],
        }),
      },
    });

    expect(
      await screen.findByText(
        tAantal(1, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 1 }),
      ),
    ).toBeInTheDocument();
  });

  it("shows no coverage total at all while a stale placement is unresolved", async () => {
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          isBetrouwbaar: false,
          aantalGedekt: null,
          aantalOnopgelosteVervallenPlaatsingen: 2,
        }),
      },
    });

    expect(await screen.findByText(t("dekking.cijferIngehouden"))).toBeInTheDocument();
    expect(
      screen.getByText(
        tAantal(2, "dekking.ingehoudenUitlegEnkelvoud", "dekking.ingehoudenUitleg"),
      ),
    ).toBeInTheDocument();

    // THE ASSERTION THAT MATTERS, and it is deliberately not "the explanation is present": a screen can show the
    // explanation and a figure at once, which is the state the ruling forbids. Matched on the shape of a total rather
    // than on numerals, because the withheld copy and the group tallies contain digits of their own.
    expect(within(samenvatting()).queryByText(TOTAALVORM)).not.toBeInTheDocument();
  });

  it("explains why the kalender may name more stale placements than this figure counts", async () => {
    // The reconciliation E5-01 assigned to this story. The kalender's notice counts EVERY stale placement, including
    // rejected ones; this figure counts only the unresolved. Without this sentence a teacher reading two different
    // numbers for one apparent thing concludes the tool is broken (owner ruling 2026-08-03).
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          isBetrouwbaar: false,
          aantalGedekt: null,
          aantalOnopgelosteVervallenPlaatsingen: 1,
        }),
      },
    });

    expect(await screen.findByText(t("dekking.ingehoudenGeweigerd"))).toBeInTheDocument();

    // The action lives on the screen that can perform it, as a link rather than a control that does nothing here (the
    // E3-06 rule), and it carries the klas selection along (ADR-0021).
    const link = screen.getByRole("link", { name: t("dekking.naarJaarplan") });
    expect(link).toHaveAttribute("href", expect.stringContaining("/jaarplan"));
    expect(link).toHaveAttribute("href", expect.stringContaining(`klas=${KLAS_ID}`));
  });

  it("says nothing is measurable rather than showing a full 0 of 0", async () => {
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [],
          aantalGedekt: 0,
          aantalLeerplandoelen: 0,
          aantalBuitenBereik: 7,
        }),
      },
    });

    expect(await screen.findByText(t("dekking.nietMeetbaar"))).toBeInTheDocument();
    expect(
      screen.getByText(
        tAantal(7, "dekking.nietMeetbaarUitlegEnkelvoud", "dekking.nietMeetbaarUitleg"),
      ),
    ).toBeInTheDocument();

    // "0 van 0 doelen gedekt" is true, satisfies `gedekt === totaal`, and reads as success. It must not be here.
    expect(within(samenvatting()).queryByText(TOTAALVORM)).not.toBeInTheDocument();
  });

  it("offers Inladen only when the school has loaded no doelen at all", async () => {
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [],
          aantalGedekt: 0,
          aantalLeerplandoelen: 0,
          aantalBuitenBereik: 0,
        }),
      },
    });

    expect(await screen.findByText(t("dekking.nietMeetbaarLeeg"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("dekking.naarImport") })).toBeInTheDocument();
  });

  it("does not offer Inladen when doelen exist but none are in this class's scope", async () => {
    // Importing more of the same discipline would not help, so no link is offered rather than one that leads nowhere
    // useful. The paired negative of the test above, because "a link appears" and "it appears only then" are two
    // different claims.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [],
          aantalGedekt: 0,
          aantalLeerplandoelen: 0,
          aantalBuitenBereik: 7,
        }),
      },
    });

    await screen.findByText(t("dekking.nietMeetbaar"));
    expect(screen.queryByRole("link", { name: t("dekking.naarImport") })).not.toBeInTheDocument();
  });
});

describe("Dekkingsoverzicht — waartegen gemeten wordt (eigenaarsruling 2026-08-04)", () => {
  it("asks the server for the class's own jaar/fase by default and names the codes", async () => {
    const fake = renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    expect(
      await screen.findByText(t("dekking.gemetenTegen", { fasen: "JK, K2, K3" })),
    ).toBeInTheDocument();

    // The scope travelled to the server. The fixture refuses an absent or unknown one, so a screen relying on the
    // endpoint's own default would have failed above rather than reached this line.
    expect(fake.laatsteDekkingUrl()).toContain("bereik=EigenJaarFase");
  });

  it("switches to the whole curriculum, refetches, and puts the choice in the URL", async () => {
    const fake = renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking(),
        HeelCurriculum: dekking({
          bereik: "HeelCurriculum",
          gemetenJaarFasen: [],
          doelen: [
            doel({ code: "NAT-K3-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
            doel({ code: "NAT-K3-02" }),
            doel({ code: "WIS-L6-09", jaarFase: "L6", domein: "Wiskunde", subdomein: "Getallen" }),
          ],
        }),
      },
    });

    await screen.findByText(t("dekking.gemetenTegen", { fasen: "JK, K2, K3" }));

    fireEvent.click(screen.getByRole("button", { name: t("dekking.bereikAlles") }));

    // A new REQUEST, not a client-side filter: the denominator is the server's answer.
    await waitFor(() => expect(fake.laatsteDekkingUrl()).toContain("bereik=HeelCurriculum"));
    expect(await screen.findByText(t("dekking.gemetenTegenAlles"))).toBeInTheDocument();
    expect(screen.getByText("WIS-L6-09")).toBeInTheDocument();

    // And in the URL, so the figure a directie is asked to check can be linked to (ADR-0021).
    expect(new URLSearchParams(window.location.search).get("bereik")).toBe("HeelCurriculum");
  });

  it("opens a shared link at the scope it names", async () => {
    const fake = renderApp(`${MET_KLAS}&bereik=HeelCurriculum`, {
      perBereik: { HeelCurriculum: dekking({ bereik: "HeelCurriculum", gemetenJaarFasen: [] }) },
    });

    expect(await screen.findByText(t("dekking.gemetenTegenAlles"))).toBeInTheDocument();
    expect(fake.laatsteDekkingUrl()).toContain("bereik=HeelCurriculum");
    expect(screen.getByRole("button", { name: t("dekking.bereikAlles") })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("falls back to the default scope for a URL naming a scope that does not exist", async () => {
    // A stale or hand-edited link. The API would answer 400 for it, and the teacher who followed the link deserves the
    // screen rather than an error.
    const fake = renderApp(`${MET_KLAS}&bereik=Onzin`, {
      perBereik: { EigenJaarFase: dekking() },
    });

    await screen.findByText(t("dekking.gemetenTegen", { fasen: "JK, K2, K3" }));
    expect(fake.laatsteDekkingUrl()).toContain("bereik=EigenJaarFase");
  });

  it("says so when the class has no jaar or fase to be measured against", async () => {
    // The unresolved graadklas half of the Art. XIV decision reaching a user: the control says "Deze klas" while every
    // leerjaar is listed, so the screen has to explain itself or it contradicts its own control.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          bereik: "HeelCurriculum",
          gemetenJaarFasen: [],
          isTerugvalNaarHeelCurriculum: true,
        }),
      },
    });

    expect(await screen.findByText(t("dekking.terugval"))).toBeInTheDocument();
  });

  it("states how many loaded doelen the scope leaves out", async () => {
    // A narrower denominator flatters the figure, which is the one direction coverage must never move by itself.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking({ aantalBuitenBereik: 12 }) } });

    expect(
      await screen.findByText(tAantal(12, "dekking.buitenBereikEnkelvoud", "dekking.buitenBereik")),
    ).toBeInTheDocument();
  });

  it("says nothing about goals left out when the whole curriculum is measured", async () => {
    // Opened AT the whole-curriculum scope, not switched to it: the fixture refuses a scope it has no answer for, so
    // the URL has to name the one being tested.
    renderApp(`${MET_KLAS}&bereik=HeelCurriculum`, {
      perBereik: {
        HeelCurriculum: dekking({
          bereik: "HeelCurriculum",
          gemetenJaarFasen: [],
          aantalBuitenBereik: 0,
        }),
      },
    });

    await screen.findByText(t("dekking.gemetenTegenAlles"));
    expect(
      screen.queryByText(tAantal(0, "dekking.buitenBereikEnkelvoud", "dekking.buitenBereik")),
    ).not.toBeInTheDocument();
  });
});

describe("Dekkingsoverzicht — de andere toestanden", () => {
  it("asks for a class instead of reporting an empty result, and fetches nothing", async () => {
    // Three states, not two. Reading "no class chosen" as "no coverage" is how the register used to tell every
    // first-time visitor that no curriculum was imported.
    const fake = renderApp("/dekking", { perBereik: { EigenJaarFase: dekking() } });

    expect(await screen.findByText(t("dekking.kiesKlas"))).toBeInTheDocument();
    expect(fake.aantalDekkingAanroepen()).toBe(0);
  });

  it("reports a failed computation as a failure, not as zero coverage", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() }, status: 500 });

    expect(await screen.findByRole("alert")).toHaveTextContent(t("dekking.fout"));

    // Specifically NOT a figure and not an empty list: a request that failed says nothing about how much is covered,
    // and "0 gedekt" would be a claim about the school's planning made out of a network fault.
    expect(screen.queryByRole("region", { name: t("dekking.titel") })).not.toBeInTheDocument();
    expect(screen.queryByText(TOTAALVORM)).not.toBeInTheDocument();
    expect(screen.queryByText(t("dekking.gedekt"))).not.toBeInTheDocument();
  });

  it("has no axe violations with a figure on screen", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    await screen.findByText(tAantal(2, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 1 }));

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("has no axe violations while the figure is withheld", async () => {
    // Checked separately because this state adds a heading, an attentie-coloured paragraph and a link that the healthy
    // state does not have, and a structure check over one state says nothing about the other.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          isBetrouwbaar: false,
          aantalGedekt: null,
          aantalOnopgelosteVervallenPlaatsingen: 1,
        }),
      },
    });

    await screen.findByText(t("dekking.cijferIngehouden"));

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
