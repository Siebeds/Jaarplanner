import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { Dekkingsvoortgangsbalk } from "./Dekkingsvoortgangsbalk";
import { vernieuwDekking } from "./useDekking";

/**
 * Pins the coverage progress bar (E9-06, CR4).
 *
 * **The states are the subject, not the pixels.** `bepaalVoortgangsbalk` is already unit-tested against `bepaalCijfer`
 * state-for-state (`voortgang.test.ts`); what only a rendering test can show is that each state reaches the screen with
 * the right words and, for two of them, that a figure is **absent** rather than merely explained. A screen can print a
 * percentage and an apology at the same time, which is the failure this file is written to catch.
 */

const KLAS_ID = "11111111-1111-1111-1111-111111111111";

const VOORTGANG = {
  bereik: "EigenJaarFase",
  gemetenJaarFasen: ["L3"],
  isTerugvalNaarHeelCurriculum: false,
  aantalBuitenBereik: 0,
  isBetrouwbaar: true,
  aantalOnopgelosteVervallenPlaatsingen: 0,
  aantalGedekt: 3,
  aantalMogelijkGedekt: 3,
  aantalLeerplandoelen: 12,
  aantalOnbereikbaar: 9,
};

/** Every request the bar made, so an assertion can be about the REQUEST rather than only about the screen. */
function stub(antwoorden: unknown[]) {
  const urls: string[] = [];
  let n = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const body = antwoorden[Math.min(n, antwoorden.length - 1)];
      n += 1;

      if (body === null) {
        return new Response("nope", { status: 500 });
      }

      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );

  return urls;
}

function renderBalk(
  props: Partial<Parameters<typeof Dekkingsvoortgangsbalk>[0]> = {},
  pad = "/themas?klas=x",
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const gerenderd = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[pad]}>
          <Dekkingsvoortgangsbalk klasId={KLAS_ID} jaarFase={null} {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );

  return { ...gerenderd, queryClient };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Dekkingsvoortgangsbalk — de twee cijfers (E9-06, Art. IV.1)", () => {
  it("noemt het gedekte cijfer met zijn noemer", async () => {
    stub([VOORTGANG]);
    renderBalk();

    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 })),
    ).toBeInTheDocument();
  });

  it("leest de voortgang, niet de volledige dekkingspayload", async () => {
    // The whole reason a second endpoint exists: `/dekking` ships every in-scope leerplandoel unpaged, which is
    // thousands of rows to move a bar by one, refetched on every link a teacher makes.
    const urls = stub([VOORTGANG]);
    renderBalk();

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 }));

    expect(urls.every((url) => url.includes("/dekking/voortgang"))).toBe(true);
  });

  it("noemt het increment apart en telt de twee nooit op", async () => {
    // 3 covered now, 9 if every standing placement were accepted, so the increment is SIX. The ceiling is not coverage
    // (Art. IV.1): it counts placements nobody has answered, including AI proposals.
    stub([{ ...VOORTGANG, aantalMogelijkGedekt: 9 }]);
    renderBalk();

    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 })),
    ).toBeInTheDocument();
    expect(screen.getByText(t("dekking.voortgangTeAanvaarden", { aantal: 6 }))).toBeInTheDocument();

    // Neither the ceiling nor the sum may appear as the covered figure.
    expect(screen.queryByText(t("dekking.cijfer", { gedekt: 9, aantal: 12 }))).toBeNull();
    expect(screen.queryByText(t("dekking.cijfer", { gedekt: 12, aantal: 12 }))).toBeNull();
  });

  it("tekent het tweede segment als het verschil, niet als het plafond", async () => {
    /*
      The one property of the bar that a text assertion cannot reach, and it is a correctness property rather than a
      style: a second segment drawn from `percentageMogelijk` instead of from the DIFFERENCE starts at zero, paints over
      the covered part, and shows one quantity where the screen claims two.

      3 of 12 covered (25%) and a ceiling of 9 of 12 (75%), so the segments must be 25% and 50%.
    */
    stub([{ ...VOORTGANG, aantalMogelijkGedekt: 9 }]);
    const { container } = renderBalk();

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 }));

    const spoor = container.querySelector("[aria-hidden='true']");
    const segmenten = [...(spoor?.children ?? [])] as HTMLElement[];

    expect(segmenten).toHaveLength(2);
    expect(segmenten[0].style.width).toBe("25%");
    expect(segmenten[1].style.width).toBe("50%");
    // And the two never fill the track, because 9 of 12 is not everything: the remainder is what a teacher is here to
    // close, so the track must still show through.
    expect(segmenten[0].style.width).not.toBe("75%");
  });

  it("zwijgt over het increment wanneer er niets openstaat", async () => {
    stub([VOORTGANG]);
    renderBalk();

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 }));

    expect(screen.queryByText(/als je de voorgestelde plaatsing/)).toBeNull();
  });

  it("gebruikt het enkelvoud bij precies één openstaande plaatsing", async () => {
    stub([{ ...VOORTGANG, aantalMogelijkGedekt: 4 }]);
    renderBalk();

    expect(
      await screen.findByText(t("dekking.voortgangTeAanvaardenEnkelvoud")),
    ).toBeInTheDocument();
  });
});

describe("Dekkingsvoortgangsbalk — de toestanden zonder cijfer", () => {
  it("toont geen cijfer en geen balk wanneer er niets te meten valt", async () => {
    // 0 of 0 is "we cannot measure this class yet", never "alles gedekt". A progress bar over it would draw FULL,
    // which is the one reading of this state that would be actively misleading (E5-02).
    stub([{ ...VOORTGANG, aantalGedekt: 0, aantalLeerplandoelen: 0, aantalOnbereikbaar: 0 }]);
    const { container } = renderBalk();

    expect(await screen.findByText(t("dekking.nietMeetbaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("dekking.cijfer", { gedekt: 0, aantal: 0 }))).toBeNull();
    // No track and no fill: the absence of the bar is the assertion, since a 0/0 bar is the defect.
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("houdt beide cijfers samen in wanneer een plaatsing vervallen is", async () => {
    // The directie ruling of 2026-07-28: while a placement points at a period that no longer exists, no figure is
    // shown. Asserting on each absence separately is what catches a PARTIAL withholding, which is what would let a
    // screen print a ceiling beside a blank.
    stub([
      {
        ...VOORTGANG,
        isBetrouwbaar: false,
        aantalGedekt: null,
        aantalMogelijkGedekt: null,
        aantalOnbereikbaar: null,
        aantalOnopgelosteVervallenPlaatsingen: 2,
      },
    ]);
    renderBalk();

    expect(await screen.findByText(t("dekking.cijferIngehouden"))).toBeInTheDocument();
    expect(screen.queryByText(/doelen gedekt/)).toBeNull();
    expect(screen.queryByText(/als je de voorgestelde plaatsing/)).toBeNull();
  });

  it("zwijgt over de inhouding waar het scherm die zelf al meldt", async () => {
    // `ingehoudenElders` is passed by the kalender alone, which carries its own non-dismissible notice counting exactly
    // these placements plus the affordance to resolve them. Two statements of one fact a few hundred pixels apart is
    // the E4-06 defect.
    stub([
      {
        ...VOORTGANG,
        isBetrouwbaar: false,
        aantalGedekt: null,
        aantalMogelijkGedekt: null,
        aantalOnbereikbaar: null,
        aantalOnopgelosteVervallenPlaatsingen: 2,
      },
    ]);
    const { container } = renderBalk({ ingehoudenElders: true });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("zegt dat de dekking niet berekend kon worden in plaats van te zwijgen", async () => {
    // Silence on a failed read reads as "no goals are missing", which is the one direction a coverage signal must never
    // fail in, and the direction a 500 fails in by default.
    stub([null]);
    renderBalk();

    expect(await screen.findByText(t("dekking.fout"))).toBeInTheDocument();
  });

  it("vraagt niets en toont niets zonder gekozen klas", async () => {
    const urls = stub([VOORTGANG]);
    const { container } = renderBalk({ klasId: "" });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(urls).toEqual([]);
  });
});

describe("Dekkingsvoortgangsbalk — CR4: het cijfer beweegt terwijl de leerkracht koppelt", () => {
  it("herleest zodra een koppeling de dekkingscache laat vallen", async () => {
    /*
      **This is CR4 itself, and it passes without one line of invalidation code in this feature.** Every write that can
      move this figure — a themadoel, an accepted doelsuggestie, a placement edit, an import — already calls
      `removeQueries` with a dekking PREFIX and none passes `exact`. Because the bar's key is nested inside
      `dekkingKlasKey`, all of them drop it.

      Driven through **the writers' own helper** rather than a hand-written `resetQueries`, deliberately: this test's
      whole value is that it fails if that helper ever goes back to `removeQueries`, which clears the entry without
      notifying a mounted observer and leaves this bar frozen. That is not hypothetical — it is what the first version of
      E9-06 shipped, and it is CR4's complaint reproduced by the fix for CR4.

      Driven at the cache rather than by clicking through `/themas`, because what is under test is that this component's
      key sits in the family the writers refresh. Driving the real mutation would test `useThemas`.
    */
    stub([VOORTGANG, { ...VOORTGANG, aantalGedekt: 5 }]);
    const { queryClient } = renderBalk();

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 }));

    // Exactly what `useThemas` does after a link is written.
    vernieuwDekking(queryClient);

    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 5, aantal: 12 })),
    ).toBeInTheDocument();
  });
});

describe("Dekkingsvoortgangsbalk — bereikbaarheid", () => {
  it("draagt de klaskeuze en de versmalling mee in de link", async () => {
    stub([VOORTGANG]);
    renderBalk({ jaarFase: "K3" }, "/themas?klas=abc&schooljaar=def");

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 }));

    const link = screen.getByRole("link", { name: t("dekking.voortgangLink") });
    const href = link.getAttribute("href") ?? "";

    // ADR-0021: following a link never silently drops the klas/schooljaar selection, and it never widens the scope
    // back out either, which would land the teacher on a screen measuring a different denominator.
    expect(href).toContain("/dekking");
    expect(href).toContain("klas=abc");
    expect(href).toContain("schooljaar=def");
    expect(href).toContain("jaarFase=K3");
  });

  it("heeft een toegankelijke naam en geen axe-schendingen", async () => {
    stub([{ ...VOORTGANG, aantalMogelijkGedekt: 9 }]);
    const { container } = renderBalk();

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 12 }));

    // A region a screen-reader user arrives at out of context: "3 van 12 doelen gedekt" does not say what it is 3 of.
    expect(
      screen.getByRole("region", { name: t("dekking.voortgangTitel") }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
