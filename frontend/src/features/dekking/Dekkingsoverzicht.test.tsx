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

  it("shows no per-group tally either while the figure is withheld", async () => {
    // FOUND BY OPENING THE SCREEN, not by a test: the summary said "Zolang dat zo is, geeft dit overzicht geen cijfer"
    // and two lines below it every group printed "2 van 14 gedekt". The group counts are additive, so a teacher could
    // add them up and reconstruct exactly the total the ruling of 2026-07-28 forbids, in its misleading form: a stale
    // placement's doelen count as niet gedekt here, while what is actually unknown is which period they sit in.
    //
    // The row chips deliberately stay: "this doel is covered by thema X" is a per-doel fact that holds either way, and
    // what the ruling forbids is a figure for the plan. A per-group count is one.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          isBetrouwbaar: false,
          aantalGedekt: null,
          aantalOnopgelosteVervallenPlaatsingen: 1,
          doelen: [
            doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
            doel({ code: "A-02" }),
          ],
        }),
      },
    });

    await screen.findByText(t("dekking.cijferIngehouden"));

    // The group is still there, with its rows and their chips.
    expect(
      screen.getByText(
        t("ongekoppeld.domeinKop", { domein: "Natuur", subdomein: "Levende natuur" }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(t("dekking.gedekt"))).toBeInTheDocument();

    // But no count anywhere on the page, in either grammatical form.
    expect(
      screen.queryByText(
        tAantal(2, "dekking.groepTellingEnkelvoud", "dekking.groepTelling", { gedekt: 1 }),
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/van \d+ gedekt/)).not.toBeInTheDocument();
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

describe("Dekkingsoverzicht — wat ronde 2 ongedekt vond", () => {
  it("still names the unresolved placements when there is also nothing to measure against", async () => {
    // THE COMBINED STATE, and the defect round 2 found. An L3 class while only kleuterdoelen are loaded gives an empty
    // scope, AND a stale placement can be open at the same time. The summary slot has three mutually exclusive
    // branches, so with the explanation and the link living inside the `ingehouden` one, this state said "nog niets om
    // tegen te meten" and NOTHING about the placement awaiting a decision, nor offered the link to go fix it. Worse,
    // `bepaalCijfer` justified its branch order by claiming that block was rendered independently. It was not.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [],
          aantalGedekt: null,
          aantalLeerplandoelen: 0,
          aantalBuitenBereik: 9,
          isBetrouwbaar: false,
          aantalOnopgelosteVervallenPlaatsingen: 1,
        }),
      },
    });

    // The slot reports the empty scope, which is the actionable half...
    expect(await screen.findByText(t("dekking.nietMeetbaar"))).toBeInTheDocument();

    // ...and the placement is reported anyway, with its route to being fixed.
    expect(
      screen.getByText(
        tAantal(1, "dekking.ingehoudenUitlegEnkelvoud", "dekking.ingehoudenUitleg"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("dekking.naarJaarplan") })).toBeInTheDocument();

    // And still no coverage total, in either state's right.
    expect(within(samenvatting()).queryByText(TOTAALVORM)).not.toBeInTheDocument();
  });

  it("gives every group an accessible name, so its heading is a real region label", async () => {
    // The `id` was built from the group key, which is `JSON.stringify([domein, subdomein])` and therefore contains
    // quotes and whitespace. HTML forbids whitespace in an `id` and `aria-labelledby` is an ID-reference LIST parsed on
    // whitespace, so it resolved to two ids that do not exist and every group silently lost its name. Nothing caught
    // it: axe does not flag an unresolvable `aria-labelledby` on a `section`, and the fixture's names were single
    // words. This asserts the name rather than the text, which is the only level at which the difference is visible.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [
            doel({ code: "A-01", domein: "Levende natuur", subdomein: "Dieren en planten" }),
            doel({ code: "B-01", domein: "Wiskunde", subdomein: "Getallen en bewerkingen" }),
          ],
        }),
      },
    });

    await screen.findByText("A-01");

    for (const [domein, subdomein] of [
      ["Levende natuur", "Dieren en planten"],
      ["Wiskunde", "Getallen en bewerkingen"],
    ]) {
      expect(
        screen.getByRole("region", {
          name: new RegExp(t("ongekoppeld.domeinKop", { domein, subdomein })),
        }),
      ).toBeInTheDocument();
    }
  });

  it("links the nakijken marker to the register, carrying the class selection", async () => {
    // Two claims, both previously untested. The marker says one word, "nakijken", and on this screen the row is
    // deliberately not a link, so without a target it was an instruction with no route to its own meaning. And the
    // link must carry `search`: `useSelectie` reads the klas/schooljaar ONLY from the URL, so dropping it empties the
    // shell's pickers, and at desktop width the register's way back is hidden.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: [doel({ code: "OUD-01", nietMeerInOpstap: true })],
        }),
      },
    });

    const markering = await screen.findByRole("link", { name: t("doelen.vervallenMarkering") });
    expect(markering).toHaveAttribute("href", expect.stringContaining("/doelen/OUD-01"));
    expect(markering).toHaveAttribute("href", expect.stringContaining(`klas=${KLAS_ID}`));
  });
});

describe("Dekkingsoverzicht — waartegen gemeten wordt (eigenaarsruling 2026-08-04)", () => {
  it("asks the server for the class's own jaar/fase by default and names the codes", async () => {
    const fake = renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    expect(
      await screen.findByText(t("dekking.gemetenTegenMeerdere", { fasen: "JK, K2, K3" })),
    ).toBeInTheDocument();

    // The scope travelled to the server. The fixture refuses an absent or unknown one, so a screen relying on the
    // endpoint's own default would have failed above rather than reached this line.
    expect(fake.laatsteDekkingUrl()).toContain("bereik=EigenJaarFase");
  });

  it("names one leerjaar plainly, and says so when the scope is wider than one", async () => {
    // THE DISTINCTION THE ANTAGONIST'S MAJOR-2 WAS ABOUT. An L3 class is measured against exactly L3, which the plain
    // sentence states. A kleutergroep has `Leerjaar = 0` and cannot say WHICH kleuterjaar it is, so it is measured
    // against all three kleuter codes: up to two other years' doelen sit in its denominator and read as its own
    // lacunes. The payload calls both `EigenJaarFase` with no fallback flag, which is accurate and not the whole
    // truth, so the widening has to be said out loud. Derived from the number of codes, so a future graadklas ruling
    // that yields two codes lands in the same branch.
    // Both lists, because they cannot disagree in reality: a class measured against L3 alone is a class whose only
    // available code is L3. Setting only `gemetenJaarFasen` described a state the server cannot produce, and the
    // kleuterjaar chooser then correctly read it as "narrowed by choice" and failed this test.
    const enkel = renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({ gemetenJaarFasen: ["L3"], beschikbareJaarFasen: ["L3"] }),
      },
    });

    expect(await screen.findByText(t("dekking.gemetenTegen", { fasen: "L3" }))).toBeInTheDocument();
    expect(
      screen.queryByText(t("dekking.gemetenTegenMeerdere", { fasen: "L3" })),
    ).not.toBeInTheDocument();
    expect(enkel.laatsteDekkingUrl()).toContain("bereik=EigenJaarFase");
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

    await screen.findByText(t("dekking.gemetenTegenMeerdere", { fasen: "JK, K2, K3" }));

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

    await screen.findByText(t("dekking.gemetenTegenMeerdere", { fasen: "JK, K2, K3" }));
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

describe("Dekkingsoverzicht — een kleutergroep kiest haar kleuterjaar (eigenaarsruling 2026-08-04)", () => {
  it("offers the choice only when the class has more than one code", async () => {
    // A control with one option is a control that does nothing (the E3-06 rule). The chooser keys on how many codes the
    // class HAS, not on "is this kleuter", because the data model cannot answer the second and a graadklas ruling would
    // answer it differently while producing the same shape.
    renderApp(MET_KLAS, {
      perBereik: {
        EigenJaarFase: dekking({
          gemetenJaarFasen: ["L3"],
          beschikbareJaarFasen: ["L3"],
        }),
      },
    });

    await screen.findByText(t("dekking.gemetenTegen", { fasen: "L3" }));
    expect(screen.queryByText(t("dekking.jaarFaseLabel"))).not.toBeInTheDocument();
  });

  it("narrows to one kleuterjaar through a NEW request, and puts it in the URL", async () => {
    const fake = renderApp(MET_KLAS, {
      perBereik: { EigenJaarFase: dekking() },
      perJaarFase: {
        K3: dekking({
          gemetenJaarFasen: ["K3"],
          beschikbareJaarFasen: ["JK", "K2", "K3"],
          aantalBuitenBereik: 12,
          doelen: [doel({ code: "NAT-K3-01", isGedekt: true, dekkendeThemas: ["Herfst"] })],
        }),
      },
    });

    await screen.findByText(t("dekking.gemetenTegenMeerdere", { fasen: "JK, K2, K3" }));

    // THIS screen's own caption, asserted in both directions (antagonist round 2). `Jaarfasekiezer` is shared with the
    // kalender since E3-09 and takes a `uitlegKey`, defaulting to the dekking one; nothing pinned that default, so
    // changing it — or passing the kalender's key from `Dekkingsamenvatting` — would silently put a sentence about "de
    // dekking" on a screen that measures it, and no test would fail.
    expect(screen.getByText(t("dekking.jaarFaseUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.jaarFaseUitleg"))).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "K3" }));

    // A new REQUEST, because narrowing changes the denominator. A screen that filtered rows in the browser would leave
    // the total over three years and pass any test that only counted rows.
    await waitFor(() => expect(fake.laatsteDekkingUrl()).toContain("jaarFase=K3"));
    expect(new URLSearchParams(window.location.search).get("jaarFase")).toBe("K3");

    // And the sentence says the scope is the teacher's CHOICE rather than the class's one leerjaar, which is what
    // distinguishes a narrowed kleutergroep from an L3 class.
    expect(
      await screen.findByText(t("dekking.gemetenTegenGekozen", { fasen: "K3" })),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(t("dekking.gemetenTegen", { fasen: "K3" })),
    ).not.toBeInTheDocument();

    // The denominator really moved: one doel in scope now, twelve left out.
    expect(
      screen.getByText(tAantal(1, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 1 })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(tAantal(12, "dekking.buitenBereikEnkelvoud", "dekking.buitenBereik")),
    ).toBeInTheDocument();
  });

  it("opens a shared narrowed link at that jaar/fase, with the option pressed", async () => {
    const fake = renderApp(`${MET_KLAS}&jaarFase=K2`, {
      perJaarFase: {
        K2: dekking({ gemetenJaarFasen: ["K2"], beschikbareJaarFasen: ["JK", "K2", "K3"] }),
      },
    });

    expect(
      await screen.findByText(t("dekking.gemetenTegenGekozen", { fasen: "K2" })),
    ).toBeInTheDocument();
    expect(fake.laatsteDekkingUrl()).toContain("jaarFase=K2");
    expect(screen.getByRole("button", { name: "K2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: t("dekking.jaarFaseAlle") })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("goes back to all three, and drops the narrowing from the URL", async () => {
    renderApp(`${MET_KLAS}&jaarFase=K3`, {
      perBereik: { EigenJaarFase: dekking() },
      perJaarFase: {
        K3: dekking({ gemetenJaarFasen: ["K3"], beschikbareJaarFasen: ["JK", "K2", "K3"] }),
      },
    });

    await screen.findByText(t("dekking.gemetenTegenGekozen", { fasen: "K3" }));

    fireEvent.click(screen.getByRole("button", { name: t("dekking.jaarFaseAlle") }));

    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).has("jaarFase")).toBe(false),
    );
    expect(
      await screen.findByText(t("dekking.gemetenTegenMeerdere", { fasen: "JK, K2, K3" })),
    ).toBeInTheDocument();
  });

  it("drops the narrowing when switching to the whole curriculum", async () => {
    // A narrowing belongs to the class's own scope. Left in the URL it would say something the answer does not, and it
    // would reappear on the way back.
    renderApp(`${MET_KLAS}&jaarFase=K3`, {
      perJaarFase: {
        K3: dekking({ gemetenJaarFasen: ["K3"], beschikbareJaarFasen: ["JK", "K2", "K3"] }),
      },
      perBereik: {
        HeelCurriculum: dekking({
          bereik: "HeelCurriculum",
          gemetenJaarFasen: [],
          beschikbareJaarFasen: [],
        }),
      },
    });

    await screen.findByText(t("dekking.gemetenTegenGekozen", { fasen: "K3" }));

    fireEvent.click(screen.getByRole("button", { name: t("dekking.bereikAlles") }));

    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).has("jaarFase")).toBe(false),
    );
    expect(await screen.findByText(t("dekking.gemetenTegenAlles"))).toBeInTheDocument();

    // And the chooser is gone, because the whole curriculum has no class codes to narrow.
    expect(screen.queryByText(t("dekking.jaarFaseLabel"))).not.toBeInTheDocument();
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

/**
 * A mixed scope: two minimumdoelen (one covered) and three gemeenschappelijke doelen (two covered).
 *
 * The numbers are chosen so the filtered and unfiltered figures cannot be confused with each other: unfiltered is
 * 3 of 5 (60%), narrowed to MD it is 1 of 2 (50%). A fixture where the two coincided would let a screen that ignored
 * the filter pass every assertion below.
 */
function gemengd() {
  return dekking({
    doelen: [
      doel({ code: "MD-01", doelsoort: "Minimumdoel", isGedekt: true, dekkendeThemas: ["Herfst"] }),
      doel({ code: "MD-02", doelsoort: "Minimumdoel" }),
      doel({ code: "G-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
      doel({ code: "G-02", isGedekt: true, dekkendeThemas: ["Winter"] }),
      doel({ code: "G-03" }),
    ],
  });
}

describe("Dekkingsoverzicht — percentage, doelsoortfilter en ontbrekende doelen (E5-03, FR-9.2)", () => {
  it("shows the percentage and the fraction it was computed from, never the percentage alone", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: gemengd() } });

    const paneel = await screen.findByRole("region", { name: t("dekking.titel") });

    expect(within(paneel).getByText(t("dekking.percentage", { percentage: 60 }))).toBeInTheDocument();
    // The fraction stays, so a reader can check the percentage against it. That is what makes the 1..99 clamp
    // verifiable by the person looking at the screen rather than only by a unit test.
    expect(
      within(paneel).getByText(tAantal(5, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 3 })),
    ).toBeInTheDocument();
  });

  it("shows minimumdoel-only coverage when filtered by MD", async () => {
    // THE STORY'S ACCEPTANCE CRITERION, in the browser's terms. Unfiltered this class reads 3 of 5; narrowed to
    // minimumdoelen it must read 1 of 2, and the percentage must move with it.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: gemengd() } });

    const keuze = await screen.findByLabelText(t("dekking.doelsoortLabel"));
    fireEvent.change(keuze, { target: { value: "Minimumdoel" } });

    const paneel = samenvatting();
    await waitFor(() =>
      expect(within(paneel).getByText(t("dekking.percentage", { percentage: 50 }))).toBeInTheDocument(),
    );
    expect(
      within(paneel).getByText(tAantal(2, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 1 })),
    ).toBeInTheDocument();

    // And it says so, because a percentage that rose or fell because the denominator changed is the most misleading
    // thing this screen could do silently. For MD specifically that sentence also has to disown the minimumdoel LEVEL
    // (antagonist round 1, MAJOR-2), which is why this is not the generic key.
    expect(within(paneel).getByText(t("dekking.gefilterdOpMinimumdoel"))).toBeInTheDocument();

    // The rows follow the same narrowing: the gemeenschappelijke doelen are gone.
    expect(screen.getByText("MD-01")).toBeInTheDocument();
    expect(screen.queryByText("G-01")).not.toBeInTheDocument();
  });

  it("puts the doelsoort narrowing in the URL, because it changes the figure", async () => {
    // Same argument as the scope (ADR-0021): a link that dropped it would open a different percentage from the one the
    // sender was looking at, and this figure is the one a directie is asked to check.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: gemengd() } });

    fireEvent.change(await screen.findByLabelText(t("dekking.doelsoortLabel")), {
      target: { value: "Minimumdoel" },
    });

    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get("doelsoort")).toBe("Minimumdoel"),
    );
  });

  it("opens on the narrowed figure when the URL already carries the doelsoort", async () => {
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel`, { perBereik: { EigenJaarFase: gemengd() } });

    const paneel = await screen.findByRole("region", { name: t("dekking.titel") });
    expect(within(paneel).getByText(t("dekking.percentage", { percentage: 50 }))).toBeInTheDocument();
  });

  it("does not offer a filter when the scope holds one doelsoort, because every option would do nothing", async () => {
    // The E3-06 rule. `dekking()`'s two doelen are both Gemeenschappelijk.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    await screen.findByText("NAT-K3-01");

    expect(screen.queryByLabelText(t("dekking.doelsoortLabel"))).not.toBeInTheDocument();
  });

  it("says a doelsoort has no doelen rather than reporting nothing to measure", async () => {
    // Distinct from `nietMeetbaar`, whose remedy is an import. Reached here by a URL naming a doelsoort this class does
    // not have, which is the realistic route: a stale shared link.
    renderApp(`${MET_KLAS}&doelsoort=Verdieping`, { perBereik: { EigenJaarFase: gemengd() } });

    expect(await screen.findByText(t("dekking.geenVanDezeSoort"))).toBeInTheDocument();
    expect(screen.queryByText(t("dekking.nietMeetbaar"))).not.toBeInTheDocument();
    expect(screen.queryByText(TOTAALVORM)).not.toBeInTheDocument();
  });

  it("shows only the gaps without changing the figure", async () => {
    // THE ASYMMETRY THE WHOLE DESIGN RESTS ON. "Alleen ontbrekende" is a view, not a scope: if the figure followed it,
    // asking to see your gaps would report 0% every single time, because every row left standing is uncovered.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: gemengd() } });

    fireEvent.click(await screen.findByRole("button", { name: t("dekking.toonOntbrekende") }));

    const paneel = samenvatting();
    await waitFor(() => expect(screen.queryByText("MD-01")).not.toBeInTheDocument());

    // The rows are only the two uncovered ones...
    expect(screen.getByText("MD-02")).toBeInTheDocument();
    expect(screen.getByText("G-03")).toBeInTheDocument();
    expect(screen.queryByText("G-01")).not.toBeInTheDocument();

    // ...and the figure has not moved.
    expect(within(paneel).getByText(t("dekking.percentage", { percentage: 60 }))).toBeInTheDocument();
    expect(
      within(paneel).getByText(tAantal(5, "dekking.cijferEnkelvoud", "dekking.cijfer", { gedekt: 3 })),
    ).toBeInTheDocument();
  });

  it("states how many doelen are still missing, in either view", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: gemengd() } });

    // Before pressing anything: the number a teacher came for should not require a click.
    expect(
      await screen.findByText(
        tAantal(2, "dekking.ontbrekendeTellingEnkelvoud", "dekking.ontbrekendeTelling"),
      ),
    ).toBeInTheDocument();
  });

  it("combines the two narrowings without letting the view half reach the figure", async () => {
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel&ontbrekend=1`, {
      perBereik: { EigenJaarFase: gemengd() },
    });

    // Rows: the one uncovered minimumdoel, and nothing else.
    expect(await screen.findByText("MD-02")).toBeInTheDocument();
    expect(screen.queryByText("MD-01")).not.toBeInTheDocument();
    expect(screen.queryByText("G-03")).not.toBeInTheDocument();

    // Figure: minimumdoel-only (the doelsoort half applied) but still counting the covered one (the view half did not).
    expect(within(samenvatting()).getByText(t("dekking.percentage", { percentage: 50 }))).toBeInTheDocument();
  });

  it("says everything is covered rather than leaving an empty area under a pressed toggle", async () => {
    const allesGedekt = dekking({
      doelen: [
        doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "A-02", isGedekt: true, dekkendeThemas: ["Winter"] }),
      ],
    });
    renderApp(`${MET_KLAS}&ontbrekend=1`, { perBereik: { EigenJaarFase: allesGedekt } });

    expect(await screen.findByText(t("dekking.allesGedekt"))).toBeInTheDocument();

    // And the control that produced the state is still there to press back. A toggle that vanishes when it succeeds
    // strands the teacher on an empty list.
    expect(screen.getByRole("button", { name: t("dekking.toonAlle") })).toBeInTheDocument();
  });

  it("drops the per-group tally in the gaps-only view rather than counting a subset as a whole", async () => {
    // The group then holds only its uncovered rows, so its honest tally would read "0 van 1 gedekt" and describe a
    // subdomein with no coverage at all. Suppressed; the missing total is stated once above the list instead.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: gemengd() } });

    const groepTelling = tAantal(5, "dekking.groepTellingEnkelvoud", "dekking.groepTelling", {
      gedekt: 3,
    });
    expect(await screen.findByText(groepTelling)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("dekking.toonOntbrekende") }));

    await waitFor(() => expect(screen.queryByText(groepTelling)).not.toBeInTheDocument());
  });

  it("gives no percentage under a filter while a stale placement withholds the figure", async () => {
    // THE ROUTE AROUND THE DIRECTIE RULING, closed in the browser as well as in the unit test. The server nulls the
    // total in this state, but every row still carries its own `isGedekt`, so a client-side count over a filtered
    // subset could reconstruct precisely the number that is being withheld. A percentage is a second way to print one.
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel`, {
      perBereik: {
        EigenJaarFase: dekking({
          doelen: gemengd().doelen,
          isBetrouwbaar: false,
          aantalGedekt: null,
          aantalOnopgelosteVervallenPlaatsingen: 1,
        }),
      },
    });

    expect(await screen.findByText(t("dekking.cijferIngehouden"))).toBeInTheDocument();
    expect(screen.queryByText(TOTAALVORM)).not.toBeInTheDocument();
    // The percentage specifically, in every form it could take for this fixture.
    expect(screen.queryByText(t("dekking.percentage", { percentage: 50 }))).not.toBeInTheDocument();
    expect(screen.queryByText(t("dekking.percentage", { percentage: 60 }))).not.toBeInTheDocument();
    // And the missing-count is withheld with it: it is additive with the group tallies, so printing it would hand back
    // the same total by subtraction.
    expect(
      screen.queryByText(tAantal(2, "dekking.ontbrekendeTellingEnkelvoud", "dekking.ontbrekendeTelling")),
    ).not.toBeInTheDocument();
  });

  it("has no axe violations with both narrowings on screen", async () => {
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel`, { perBereik: { EigenJaarFase: gemengd() } });

    await screen.findByText("MD-02");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe("Dekkingsoverzicht — wat antagonist ronde 1 vond (E5-03)", () => {
  it("keeps the doelsoort control on screen when a narrowing is active but the scope holds one soort", async () => {
    // MAJOR-1. The two conditions intersect: `dekking()`'s doelen are all Gemeenschappelijk, so the "more than one
    // option" rule hid the filter, while `?doelsoort=Minimumdoel` matched no row and produced a sentence telling the
    // teacher to use it. No control, no list header: the only ways out were the Back button and the scope switch,
    // which changes the denominator instead of clearing the filter.
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel`, { perBereik: { EigenJaarFase: dekking() } });

    expect(await screen.findByText(t("dekking.geenVanDezeSoort"))).toBeInTheDocument();

    const keuze = screen.getByLabelText(t("dekking.doelsoortLabel"));
    expect(keuze).toBeInTheDocument();
    // And it reports the narrowing that is actually in force. Without the absent value among its options the browser
    // would paint the first one, so the control would read "Alle doelsoorten" beside a screen saying everything was
    // filtered out.
    expect((keuze as HTMLSelectElement).value).toBe("Minimumdoel");
  });

  it("clears the narrowing from that state, so the way out the copy promises exists", async () => {
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel`, { perBereik: { EigenJaarFase: dekking() } });

    await screen.findByText(t("dekking.geenVanDezeSoort"));
    fireEvent.change(screen.getByLabelText(t("dekking.doelsoortLabel")), { target: { value: "" } });

    // Back to a real figure, and the parameter is gone from the URL rather than left behind to reappear.
    expect(await screen.findByText(t("dekking.percentage", { percentage: 50 }))).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("doelsoort")).toBeNull();
  });

  it("does not let an MD narrowing read as coverage at minimumdoelniveau", async () => {
    // MAJOR-2. The doelsoort is labelled "Minimumdoel", so "63%" landed a few lines under "Dekking op het niveau van de
    // minimumdoelen ... zit er nog niet in". Those are different quantities: Art. V.1 makes a minimumdoel covered when
    // AT LEAST ONE concorded leerplandoel is, aggregated over distinct refs, so E5-04 will print a different number for
    // the same class.
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel`, { perBereik: { EigenJaarFase: gemengd() } });

    expect(await screen.findByText(t("dekking.gefilterdOpMinimumdoel"))).toBeInTheDocument();
    // The generic sentence must NOT be the one used here.
    expect(
      screen.queryByText(t("dekking.gefilterdOpDoelsoort", { naam: t("doelsoort.md") })),
    ).not.toBeInTheDocument();
  });

  it("keeps the generic sentence for a doelsoort that carries no such ambiguity", async () => {
    const metVerdieping = dekking({
      doelen: [
        doel({ code: "V-01", doelsoort: "Verdieping", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "G-01" }),
      ],
    });
    renderApp(`${MET_KLAS}&doelsoort=Verdieping`, { perBereik: { EigenJaarFase: metVerdieping } });

    expect(
      await screen.findByText(t("dekking.gefilterdOpDoelsoort", { naam: t("doelsoort.verdieping") })),
    ).toBeInTheDocument();
  });

  it("ignores a doelsoort the vocabulary does not know rather than rendering the catalogue key", async () => {
    // MINOR-2. `doelsoortLabel("Foo")` looked up `doelsoortBadgeSoort["Foo"]` → undefined → `t("doelsoort.undefined")`,
    // and `t` returns a missing path verbatim, so the screen read "geen enkel doel van de soort doelsoort.undefined"
    // (Art. II.3). Falls back to no narrowing, exactly as an unknown `bereik` does.
    renderApp(`${MET_KLAS}&doelsoort=Foo`, { perBereik: { EigenJaarFase: gemengd() } });

    // The unfiltered figure: `gemengd()` is 3 of 5, so the bad value narrowed nothing.
    expect(await screen.findByText(t("dekking.percentage", { percentage: 60 }))).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("doelsoort.undefined");
    expect(screen.queryByText(t("dekking.geenVanDezeSoort"))).not.toBeInTheDocument();
  });

  it("says something under a pressed gaps-only toggle even while the figure is withheld", async () => {
    // MINOR-3. Reachable: an unresolved stale placement while the other placements cover the whole in-scope set. The
    // `cijfer` guard on "Elk doel is gedekt" is correct and stays, because that sentence asserts gedekt === totaal and
    // would hand over the withheld figure in words. So this state needs its own neutral line, not a relaxed guard.
    const allesGedektMaarOnbetrouwbaar = dekking({
      doelen: [
        doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "A-02", isGedekt: true, dekkendeThemas: ["Winter"] }),
      ],
      isBetrouwbaar: false,
      aantalGedekt: null,
      aantalOnopgelosteVervallenPlaatsingen: 1,
    });
    renderApp(`${MET_KLAS}&ontbrekend=1`, { perBereik: { EigenJaarFase: allesGedektMaarOnbetrouwbaar } });

    expect(await screen.findByText(t("dekking.geenOntbrekendeInBeeld"))).toBeInTheDocument();
    // And it still claims no coverage: "everything is covered" would be the withheld total, spelled out.
    expect(screen.queryByText(t("dekking.allesGedekt"))).not.toBeInTheDocument();
    expect(screen.queryByText(TOTAALVORM)).not.toBeInTheDocument();
  });
});
