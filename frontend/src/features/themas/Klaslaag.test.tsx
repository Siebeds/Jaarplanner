import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t } from "../../i18n";
import {
  DOEL_L3,
  KLAS_K3,
  KLAS_L3,
  THEMA_HERFST,
  maakThemaFetchFake,
  type ThemaFakeOpties,
} from "./testdata";

/**
 * Pins the **class-scoped writes** of the beheer screens (E1-14 landing 2, FR-3.1/3.2, Art. IX.2).
 *
 * Landing 1's tests are in `ThemasPagina.test.tsx` and cover the school-wide half plus the level boundary.
 * This file is about the half that was read-only until landing 2: creating, editing and deleting a subthema
 * and an activiteit, and linking leerplandoelen at both levels.
 *
 * **The fetch fake is stateful here on purpose** (`maakThemaFetchFake` keeps a subthema store): a canned
 * response would let a missing query invalidation pass, because the screen would render identical rows before
 * and after a write. Several assertions below therefore check that the new row **appears**, which can only
 * happen if the component refetched.
 */

function renderApp(pad: string, opties: ThemaFakeOpties = {}) {
  const fake = maakThemaFetchFake(opties);
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

/**
 * The class-scoped section of the thema detail, awaited **until its data has arrived**.
 *
 * The wait on the loading line is not ceremony: the heading renders as soon as a klas is in the URL, while the
 * per-class read is still in flight, so a helper that returned at the heading handed back a section whose only
 * content was "Het thema wordt geladen." Every query in this file then failed with "unable to find button",
 * which reads like a missing control rather than a race.
 */
async function klassectie() {
  const kop = await screen.findByRole("heading", {
    name: t("themabeheer.klasTitel", { klas: "L3 derde leerjaar" }),
  });
  const sectie = kop.closest("section") as HTMLElement;

  await waitFor(() =>
    expect(within(sectie).queryByText(t("themabeheer.detailLaden"))).not.toBeInTheDocument(),
  );

  return sectie;
}

/** The URL of Herfst's detail with L3 selected: the state every test here starts from. */
const L3_PAD = `/themas/${THEMA_HERFST}?klas=${KLAS_L3}`;

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Klaslaag — een subthema aanmaken (FR-3.1, Art. IX.2)", () => {
  it("stuurt de klas van de sectie mee en vraagt de leeftijd apart", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(within(sectie).getByRole("button", { name: t("themabeheer.subthemaNieuw") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), {
      target: { value: "Water en ijs" },
    });
    fireEvent.change(screen.getByLabelText(t("themabeheer.leeftijdLabel")), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0]).toMatchObject({
      pad: `/api/themas/${THEMA_HERFST}/subthemas`,
      methode: "POST",
    });
    // The klas is NOT a form field: it comes from the section the form was opened in, so a teacher cannot
    // create, from L3's section, a subthema that then belongs to another class and vanishes from view.
    // The leeftijd IS a field, because Art. IX.2 scopes per class AND age.
    expect(fake.verzoeken[0].body).toMatchObject({ naam: "Water en ijs", klasId: KLAS_L3, leeftijd: "8" });

    // It appears, which can only happen if the write invalidated the class-scoped read.
    expect(await within(await klassectie()).findByText("Water en ijs")).toBeInTheDocument();
  });

  it("weigert een lege leeftijd zonder de server lastig te vallen", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(within(sectie).getByRole("button", { name: t("themabeheer.subthemaNieuw") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), { target: { value: "Zonder" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t("themabeheer.leeftijdVerplicht"));
    expect(fake.verzoeken).toEqual([]);
  });

  it("biedt zonder klaskeuze geen aanmaakknop aan, want een subthema kan niet klasloos bestaan", async () => {
    renderApp(`/themas/${THEMA_HERFST}`);

    expect(await screen.findByText(t("themabeheer.klasGeenKeuze"))).toBeInTheDocument();
    // A form that cannot be submitted is a control that does nothing (the E3-06 rule).
    expect(
      screen.queryByRole("button", { name: t("themabeheer.subthemaNieuw") }),
    ).not.toBeInTheDocument();
  });
});

describe("Klaslaag — een subthema wijzigen en verwijderen", () => {
  it("wijzigt op het eigen adres van het subthema, niet onder het thema", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.subthemaWijzigAria", { naam: "Bladeren" }),
      }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), {
      target: { value: "Bladeren en takken" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/subthemas\//);
    expect(fake.verzoeken[0].methode).toBe("PUT");
    expect(await within(await klassectie()).findByText("Bladeren en takken")).toBeInTheDocument();
  });

  it("verwijdert niets op één klik en zegt dat andere klassen dit niet raakt", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.subthemaVerwijderAria", { naam: "Bladeren" }),
      }),
    );

    expect(screen.getByText(t("themabeheer.subthemaVerwijderGevolg"))).toBeInTheDocument();
    expect(fake.verzoeken).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.subthemaVerwijderBevestig") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].methode).toBe("DELETE");
    // Gone from the screen, which again proves the refetch rather than a local splice.
    await waitFor(() =>
      expect(screen.queryByText("Bladeren")).not.toBeInTheDocument(),
    );
  });
});

describe("Klaslaag — activiteiten (FR-3.1)", () => {
  it("maakt een activiteit onder haar subthema en stuurt het soort bij naam", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitNieuwAria", { naam: "Bladeren" }),
      }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), {
      target: { value: "Bladeren persen" },
    });
    fireEvent.change(screen.getByLabelText(t("themabeheer.activiteitTypeLabel")), {
      target: { value: "Waarneming" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/subthemas\/.+\/activiteiten$/);
    // By name, never by number: the enum is persisted and transported by name, so a numeric value would bind
    // to whichever member happens to sit at that index after the enum grows.
    expect(fake.verzoeken[0].body).toMatchObject({
      naam: "Bladeren persen",
      activiteitType: "Waarneming",
    });
    expect(await within(await klassectie()).findByText(/Bladeren persen/)).toBeInTheDocument();
  });

  it("verwijdert een activiteit in twee stappen", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    // The activiteit's own delete, not the subthema's: both are on screen, so the test has to pick the right
    // one. The activiteit sits inside the list item that names it.
    const activiteitRegel = (await within(sectie).findByText(/Bladkroon maken/)).closest(
      "li",
    ) as HTMLElement;
    fireEvent.click(
      await within(activiteitRegel).findByRole("button", {
        name: t("themabeheer.activiteitVerwijderAria", { naam: "Bladkroon maken" }),
      }),
    );

    expect(screen.getByText(t("themabeheer.activiteitVerwijderGevolg"))).toBeInTheDocument();
    expect(fake.verzoeken).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.activiteitVerwijderBevestig") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/activiteiten\//);
    expect(fake.verzoeken[0].methode).toBe("DELETE");
  });
});

/**
 * *These three tests search `WIS-L3-01` and used to search `MUZ-L2-01` / `NAT-K3-02` (changed 2026-08-19, E9-07).*
 *
 * Not a rename: the picker now scopes its search to the jaar/fase codes the class teaches, and `L3_PAD` is an L3 class,
 * so an L2 or K3 code is no longer offered by default. That is CR5 working rather than a fixture detail, and searching
 * the class's own code is what keeps these tests about what they are about (which endpoint a link posts to) instead of
 * about the scope. The scope itself has its own block below.
 */
describe("Klaslaag — leerdoelen koppelen op klasniveau (FR-3.2)", () => {
  it("koppelt aan een subthema via doelkoppelingen en ontkoppelt via subdoelen", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.subdoelKoppelAria", { naam: "Bladeren" }),
      }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "WIS-L3-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "WIS-L3-01",
          waaraan: t("themabeheer.niveauSubthema"),
        }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/subthemas\/.+\/doelkoppelingen$/);

    // The asymmetry the API really has, and the reason it is worth a test: linking posts to
    // `doelkoppelingen`, unlinking deletes a `subdoelen/{id}`.
    const bijgewerkt = await klassectie();
    const ontkoppel = within(bijgewerkt).getAllByRole("button", {
      name: t("themabeheer.ontkoppelAria", {
        code: "WIS-L3-01",
        waaraan: t("themabeheer.niveauSubthema"),
      }),
    });
    fireEvent.click(ontkoppel[0]);

    await waitFor(() => expect(fake.verzoeken).toHaveLength(2));
    expect(fake.verzoeken[1].pad).toMatch(/^\/api\/subthemas\/.+\/subdoelen\/.+$/);
    expect(fake.verzoeken[1].methode).toBe("DELETE");
  });

  it("noemt in de knoplabels waaraan gekoppeld wordt, want drie niveaus staan op één scherm", async () => {
    renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.subdoelKoppelAria", { naam: "Bladeren" }),
      }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "WIS-L3-01" },
    });

    // Three pickers can be open on one screen (thema, subthema, activiteit). Identical labels would leave a
    // screen-reader user with three "Koppelen" buttons and no way to tell them apart.
    expect(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "WIS-L3-01",
          waaraan: t("themabeheer.niveauSubthema"),
        }),
      }),
    ).toBeInTheDocument();
  });

  it("koppelt en ontkoppelt op een activiteit", async () => {
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    const activiteitRegel = (await within(sectie).findByText(/Bladkroon maken/)).closest(
      "li",
    ) as HTMLElement;
    fireEvent.click(
      await within(activiteitRegel).findByRole("button", {
        name: t("themabeheer.activiteitKoppelAria", { naam: "Bladkroon maken" }),
      }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "WIS-L3-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "WIS-L3-01",
          waaraan: t("themabeheer.niveauActiviteit"),
        }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/activiteiten\/.+\/doelkoppelingen$/);

    const ontkoppel = await screen.findByRole("button", {
      name: t("themabeheer.ontkoppelAria", {
        code: "WIS-L3-01",
        waaraan: t("themabeheer.niveauActiviteit"),
      }),
    });
    fireEvent.click(ontkoppel);

    await waitFor(() => expect(fake.verzoeken).toHaveLength(2));
    expect(fake.verzoeken[1].pad).toMatch(/^\/api\/activiteiten\/.+\/doelkoppelingen\/.+$/);
  });
});

describe("Klaslaag — een record dat iemand anders al verwijderde (antagonist ronde 2)", () => {
  it("meldt een verwijderd subthema als weg, zonder de GUID van de server", async () => {
    renderApp(L3_PAD, { subthemaAlWeg: true });
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.subthemaVerwijderAria", { naam: "Bladeren" }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.subthemaVerwijderBevestig") }));

    // Landing 1 already treats a 404 on delete this way one level up; the two new levels did not, and reported
    // it as a failure while rendering "Subthema <guid> bestaat niet." at a teacher.
    expect(await screen.findByText(t("themabeheer.subthemaAlWeg"))).toBeInTheDocument();
    expect(screen.queryByText(t("themabeheer.subthemaVerwijderMislukt"))).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);

    // **And the screen must agree with the sentence** (antagonist round 3, MAJOR 1). Saying a record is gone
    // while its card, its activiteiten and an enabled "Ja, verwijder dit subthema" stay on screen is the
    // self-contradiction that reopened E3-07: the confirm could only reproduce the same 404.
    await waitFor(() => expect(screen.queryByText("Bladeren")).not.toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: t("themabeheer.subthemaVerwijderBevestig") }),
    ).not.toBeInTheDocument();
  });
});

describe("Klaslaag — geen inhoud van een andere klas, en geen zin meer die naar Import wijst", () => {
  it("laat K3 niets van L3 zien, ook nu er geschreven kan worden", async () => {
    renderApp(`/themas/${THEMA_HERFST}?klas=${KLAS_K3}`);

    expect(await screen.findByText(t("themabeheer.subthemasGeen"))).toBeInTheDocument();
    expect(screen.queryByText("Bladeren")).not.toBeInTheDocument();
    expect(screen.queryByText(/Bladkroon maken/)).not.toBeInTheDocument();
  });

  it("heeft geen axe-schendingen met een subthemaformulier en een doelkiezer open", async () => {
    renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(within(sectie).getByRole("button", { name: t("themabeheer.subthemaNieuw") }));
    fireEvent.click(
      within(await klassectie()).getByRole("button", {
        name: t("themabeheer.subdoelKoppelAria", { naam: "Bladeren" }),
      }),
    );

    // **Settle the picker before auditing.** Its unfiltered-total query resolves ~1s in, and nothing used to
    // await it, so axe walked a DOM that re-rendered under it and the update could land after the test
    // returned. That is the mechanism behind the one unexplained failure recorded on this story: React's
    // "update was not wrapped in act(...)" warning named this test on every run, green or not.
    await screen.findByLabelText(t("themabeheer.doelZoekLabel"));
    await waitFor(() => expect(screen.getByText(t("themabeheer.doelZoekKort"))).toBeInTheDocument());

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("heeft geen axe-schendingen met een activiteitformulier open, kopniveaus incluis", async () => {
    renderApp(L3_PAD);
    const sectie = await klassectie();

    // The heading-order fix only held while a subthema-level h4 was open, so opening an activiteit-level form
    // on its own jumped h3 -> h5 again (antagonist round 2). This is that state, audited.
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitNieuwAria", { naam: "Bladeren" }),
      }),
    );
    await screen.findByRole("heading", {
      name: t("themabeheer.activiteitFormNieuw", { subthema: "Bladeren" }),
    });

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("laat twee open formulieren elkaars velden niet afpakken", async () => {
    renderApp(L3_PAD);
    const sectie = await klassectie();

    // Two forms at once: the create form under the list plus the edit form on the existing card. With literal
    // field ids the second form's labels resolved to the FIRST form's inputs, so five fields had no label and
    // clicking "Naam" focused the wrong box. axe cannot fail on that (it reports those rules as *incomplete*),
    // so this asserts the association directly (antagonist round 2, MAJOR 1).
    fireEvent.click(within(sectie).getByRole("button", { name: t("themabeheer.subthemaNieuw") }));
    fireEvent.click(
      within(await klassectie()).getByRole("button", {
        name: t("themabeheer.subthemaWijzigAria", { naam: "Bladeren" }),
      }),
    );

    const naamvelden = screen.getAllByLabelText(t("themabeheer.naamLabel"));
    expect(naamvelden).toHaveLength(2);
    // Each label reaches its own input: two distinct elements, and neither is labelled twice.
    expect(naamvelden[0]).not.toBe(naamvelden[1]);
    for (const veld of naamvelden) {
      expect((veld as HTMLInputElement).labels).toHaveLength(1);
    }
    // And the edit form really is the one holding the record's values.
    expect(naamvelden.map((veld) => (veld as HTMLInputElement).value)).toContain("Bladeren");
  });
});

describe("Klaslaag — een activiteit naar een ander subthema verplaatsen (E4-08, FR-7.2)", () => {
  /** Opens the move panel on the one activiteit L3 has, and hands back the section it lives in. */
  async function openVerplaatspaneel(opties: ThemaFakeOpties = {}) {
    const fake = renderApp(L3_PAD, opties);
    const sectie = await klassectie();

    // Awaited, because the control is deliberately absent until the destinations are known to exist.
    const knop = await within(sectie).findByRole("button", {
      name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
    });
    fireEvent.click(knop);

    return { fake, sectie: await klassectie() };
  }

  it("biedt de andere subthema's van deze klas aan, gegroepeerd per thema, en nooit het eigen subthema", async () => {
    const { sectie } = await openVerplaatspaneel();

    const keuzelijst = within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }));
    const opties = Array.from(keuzelijst.querySelectorAll("option")).map((optie) => optie.textContent);

    // The placeholder plus exactly one destination: the klas's other subthema, under the other thema.
    expect(opties).toEqual([
      t("themabeheer.activiteitVerplaatsKies"),
      `Drijven en zinken · ${t("themabeheer.leeftijdWaarde", { leeftijd: "8" })}`,
    ]);

    // Its own subthema is not offered. The server refuses it too, so this is the picker agreeing with the
    // server rather than the only thing standing between a teacher and a refusal.
    expect(opties.some((optie) => optie?.startsWith("Bladeren"))).toBe(false);

    // Grouped by thema, which is the only thing that tells two same-named subthema's of one klas apart.
    const groep = keuzelijst.querySelector("optgroup");
    expect(groep).toHaveAttribute("label", "Water");
  });

  it("zegt in het paneel dat een verhuizing de dekking van deze klas kan veranderen", async () => {
    const { sectie } = await openVerplaatspaneel();

    // The consequence of the owner's ruling: dekking counts an activiteitkoppeling through the thema its
    // subthema hangs under, so a move that stays inside the klas can still change the figure.
    expect(within(sectie).getByText(t("themabeheer.activiteitVerplaatsGevolg"))).toBeInTheDocument();

    /*
      And **not** the leeftijd sentence here, because every destination this klas offers has the same leeftijd as
      the source. The owner ruled that the crossing must be disclosed, not that the sentence must always be
      printed (round 2, MINOR 9), so on a non-graadklas the panel does not carry a paragraph about something that
      cannot happen. The next test is the same panel with a different-age destination on offer.
    */
    expect(
      within(sectie).queryByText(t("themabeheer.activiteitVerplaatsLeeftijd")),
    ).not.toBeInTheDocument();
  });

  it("zegt dat een andere leeftijd een andere leeftijdsgroep betekent, zodra zo'n bestemming bestaat", async () => {
    // The owner's ruling of 2026-08-05, in the state where it applies: a graadklas offering a subthema at
    // another age. Art. IX.2 makes (subthema x leeftijd) the differentiation axis, so this changes who teaches
    // the activiteit from then on, and the age in an option label is not a disclosure of that.
    const { sectie } = await openVerplaatspaneel({ extraBestemming: true });

    expect(within(sectie).getByText(t("themabeheer.activiteitVerplaatsLeeftijd"))).toBeInTheDocument();
    // And the klas half is stated in the same breath, so the sentence answers the question it raises.
    expect(t("themabeheer.activiteitVerplaatsLeeftijd")).toContain("klas blijft altijd dezelfde");
  });

  it("zegt niets over leeftijden zodra het paneel meldt dat het de lijst niet kon laden", async () => {
    /*
      Round 3, MINOR 6. `isRefetchError` is a real TanStack state: `isError` true while `data` still holds the
      previous list. A failed *refetch* therefore drops the panel into its list-error branch with candidates
      still in hand, and without gating the disclosure on `heeftKeuzelijst` a graadklas would read an
      instruction about choosing another age directly above the sentence saying nothing can be chosen.

      `bestemmingenFaalt` cannot reach this, because failing the first fetch means no data ever exists. This
      fixture serves the list once and fails afterwards.

      The move has to be **refused** as well, and that is not incidental: a successful move closes the panel and
      takes the row with it, so there would be no panel left to contradict itself. A refusal keeps it open and is
      also what fires the refresh-on-any-failure rule whose refetch then fails. Two fake options for one state,
      because the state genuinely needs both.
    */
    const { sectie } = await openVerplaatspaneel({
      extraBestemming: true,
      bestemmingenFaaltNaEerste: true,
      verplaatsWeigering: "Dit subthema bestaat niet meer.",
    });

    // The disclosure is there while the list is: leeftijd 9 is on offer against a source of 8.
    expect(within(sectie).getByText(t("themabeheer.activiteitVerplaatsLeeftijd"))).toBeInTheDocument();

    // A move that fails triggers the refresh-on-any-failure rule, whose refetch now fails.
    fireEvent.change(
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000003" } },
    );
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );

    expect(
      await screen.findByText(t("themabeheer.activiteitVerplaatsLijstFout")),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(t("themabeheer.activiteitVerplaatsLeeftijd")),
    ).not.toBeInTheDocument();
  });

  it("zet de verplaatsknop weer uit wanneer juist de gekozen bestemming verdwijnt", async () => {
    /*
      Round 2, MINOR 3. The derived-choice fix was untestable in the old fixture: the refused destination was
      L3's only candidate, so the whole picker was replaced by the empty-state sentence and the submit was absent
      **whatever** the component computed. With a second destination still on offer the picker stays, and the
      question becomes the one the fix is about: does a chosen id that is no longer offered still enable the
      submit?
    */
    const { sectie } = await openVerplaatspaneel({
      extraBestemming: true,
      verplaatsBestemmingVerdwijnt: true,
    });

    const kiezer = () =>
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ) as HTMLSelectElement;
    const submit = () =>
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }) as HTMLButtonElement;

    fireEvent.change(kiezer(), { target: { value: "cccccccc-0000-0000-0000-000000000002" } });
    expect(submit().disabled).toBe(false);

    fireEvent.click(submit());
    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();

    // The picker is still there, with the surviving destination, and the choice that no longer exists is no
    // longer a choice: without the derivation the submit would stay enabled on a stale id and do nothing.
    await waitFor(() => expect(submit().disabled).toBe(true));
    expect(kiezer().value).toBe("");
    expect(kiezer().querySelectorAll("option").length).toBe(2);
  });

  it("laat het paneel in elke toestand sluiten, ook wanneer er niets te kiezen valt", async () => {
    /*
      Round 2, MAJOR 1, and it was introduced by the fix for round 1's MAJOR 2: replacing the picker with a
      sentence took the cancel with it, because the cancel lived inside the "there are destinations" arm. The
      panel then had no control that closes it at all, beside a trigger above that only sets a state which is
      already set.

      Asserted as a property over **every** state the panel can be in, rather than for the one branch that was
      broken, so a fifth branch added later is covered.
      */
    const annuleerNaam = t("themabeheer.activiteitVerplaatsAnnuleerAria", { naam: "Bladkroon maken" });

    for (const opties of [
      {},
      { bestemmingenHangt: true },
      { bestemmingenFaalt: true },
      { verplaatsBestemmingVerdwijnt: true },
    ] as ThemaFakeOpties[]) {
      const { sectie } = await openVerplaatspaneel(opties);

      if ("verplaatsBestemmingVerdwijnt" in opties) {
        // Reach the empty state the way a teacher does: the destination is deleted under the open panel.
        fireEvent.change(
          within(sectie).getByLabelText(
            t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
          ),
          { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
        );
        fireEvent.click(
          within(sectie).getByRole("button", {
            name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
          }),
        );
        expect(
          await screen.findByText(t("themabeheer.activiteitVerplaatsGeenBestemming")),
        ).toBeInTheDocument();
      }

      const huidig = await klassectie();

      /*
        Round 3, MINOR 2: the loading state was missing from this loop, and its absence hid a live mutation —
        rendering the submit while `bestemmingen.isPending` left the whole suite green, which is a submit with no
        picker to submit from. So the property is now two properties, over four states: there is always a way
        out, and a submit never appears without the control it acts on.
      */
      const kiezer = within(huidig).queryByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      );
      const submit = within(huidig).queryByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      });
      expect(Boolean(submit)).toBe(Boolean(kiezer));

      const annuleer = within(huidig).getByRole("button", { name: annuleerNaam });
      fireEvent.click(annuleer);

      // It really closes: the panel and its heading are gone, not merely unreachable.
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", {
            name: t("themabeheer.activiteitVerplaatsTitel", { naam: "Bladkroon maken" }),
          }),
        ).not.toBeInTheDocument(),
      );

      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("houdt de live region gemonteerd, zodat de bevestiging ook aangekondigd wordt", async () => {
    /*
      Round 2, MAJOR 2. A role="status" element that enters the DOM already populated is frequently not
      announced at all, which this codebase wrote down twice after E4-06 shipped exactly that and found it
      silent. The region is therefore mounted with the section and only its text is conditional. It matters more
      here than in either earlier case: for a cross-thema move the row leaves the screen, so this sentence is the
      only evidence a teacher gets.
    */
    const { sectie } = await openVerplaatspaneel();
    const regios = () => within(sectie).getAllByRole("status", { hidden: true });

    // Present before anything happened, and empty.
    expect(regios().length).toBeGreaterThan(0);
    expect(regios()[0].textContent).toBe("");

    fireEvent.change(
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
    );
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );

    // The same element is filled rather than a new one inserted, which is the whole point.
    const na = await klassectie();
    await waitFor(() =>
      expect(within(na).getAllByRole("status", { hidden: true })[0].textContent).toContain(
        "Drijven en zinken",
      ),
    );
  });

  it("wist de melding bij het bewaren, ook als het formulier al openstond voor de melding er was", async () => {
    /*
      Round 3's MAJOR, and it is a lesson about test setup rather than about the code. The test below raises the
      notice and *then* opens the create form, but the trigger's own handler already clears notices, so the
      assertion never observed the `onSuccess` site that round 1's MAJOR-1 fix installed. Measured: deleting
      either clearing site alone left 33/33 green; only removing both failed. The mechanism whose absence made a
      confirmation never paint was therefore unprotected, and E1-20 told the next author it was pinned.

      Here the form is opened **first**, so the trigger's clear happens before there is anything to clear, and
      the only thing that can remove the sentence is the create's `onSuccess`.
    */
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(within(sectie).getByRole("button", { name: t("themabeheer.subthemaNieuw") }));

    // Now move an activiteit, with the create form standing open and untouched.
    fireEvent.click(
      await within(await klassectie()).findByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      }),
    );
    const metPaneel = await klassectie();
    fireEvent.change(
      within(metPaneel).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
    );
    fireEvent.click(
      within(metPaneel).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );
    const melding = t("themabeheer.activiteitVerplaatstNaar", {
      activiteit: "Bladkroon maken",
      subthema: "Drijven en zinken",
      thema: "Water",
    });
    expect(await screen.findByText(melding)).toBeInTheDocument();

    // Saving the form that was already open is the only remaining event.
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), { target: { value: "Water en ijs" } });
    fireEvent.change(screen.getByLabelText(t("themabeheer.leeftijdLabel")), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await within(await klassectie()).findByText("Water en ijs")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(melding)).not.toBeInTheDocument());
    expect(fake.verzoeken.some((verzoek) => verzoek.pad.endsWith("/subthemas"))).toBe(true);
  });

  it("laat een melding niet staan na een latere geslaagde schrijfactie", async () => {
    /*
      Round 2, MINOR 4: nothing asserted that a notice is ever *cleared*, so the mechanism that replaced round
      4's latched guard was unpinned in exactly the way the latched guard had been. Deleting both wisMeldingen()
      calls left the suite green.
    */
    const { sectie } = await openVerplaatspaneel();

    fireEvent.change(
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
    );
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );
    const melding = t("themabeheer.activiteitVerplaatstNaar", {
      activiteit: "Bladkroon maken",
      subthema: "Drijven en zinken",
      thema: "Water",
    });
    expect(await screen.findByText(melding)).toBeInTheDocument();

    // A later successful write is a new fact about the screen, so the old sentence must go.
    fireEvent.click(
      within(await klassectie()).getByRole("button", { name: t("themabeheer.subthemaNieuw") }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), { target: { value: "Water en ijs" } });
    fireEvent.change(screen.getByLabelText(t("themabeheer.leeftijdLabel")), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await within(await klassectie()).findByText("Water en ijs")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(melding)).not.toBeInTheDocument());
  });

  it("verplaatst de activiteit en zegt waar ze nu staat, want de rij verdwijnt van dit scherm", async () => {
    const { fake, sectie } = await openVerplaatspaneel();

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    );

    // The destination is named, because a move to another thema takes the activiteit off this screen entirely
    // and "het is gelukt" would leave a teacher with nowhere to look.
    expect(
      await screen.findByText(
        t("themabeheer.activiteitVerplaatstNaar", {
          activiteit: "Bladkroon maken",
          subthema: "Drijven en zinken",
          thema: "Water",
        }),
      ),
    ).toBeInTheDocument();

    // Only the place changed: the body names the destination and nothing else.
    const schrijf = fake.verzoeken.find((verzoek) => verzoek.pad.endsWith("/subthema"));
    expect(schrijf?.methode).toBe("PUT");
    expect(schrijf?.body).toEqual({ doelSubthemaId: "cccccccc-0000-0000-0000-000000000002" });

    /*
      And it really left this thema's card. The fake is stateful, so the row can only disappear if the screen
      refetched after the write.

      Asserted on the row's own control rather than on its name: the confirmation above the list *contains* the
      activiteit's name, so a text query for "Bladkroon maken" matches the notice this test just demanded and
      would fail while the screen was in fact correct.
    */
    await waitFor(() =>
      expect(
        within(sectie).queryByRole("button", {
          name: t("themabeheer.activiteitVerwijderAria", { naam: "Bladkroon maken" }),
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("biedt geen verplaatsknop aan wanneer deze klas nergens anders naartoe kan", async () => {
    renderApp(L3_PAD, { geenBestemming: true });
    const sectie = await klassectie();

    // The destinations read has to have happened before absence means anything, otherwise this test would
    // pass on a screen that simply had not loaded yet.
    await waitFor(() => expect(within(sectie).getByText(/Bladkroon maken/)).toBeInTheDocument());
    await waitFor(() =>
      expect(
        within(sectie).getByRole("button", {
          name: t("themabeheer.activiteitVerwijderAria", { naam: "Bladkroon maken" }),
        }),
      ).toBeInTheDocument(),
    );

    expect(
      within(sectie).queryByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      }),
    ).not.toBeInTheDocument();
  });

  it("houdt het paneel open met de reden van de server wanneer de bestemming geweigerd wordt", async () => {
    const weigering = "Dit subthema bestaat niet meer.";
    const { sectie } = await openVerplaatspaneel({ verplaatsWeigering: weigering });

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    );

    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();
    expect(screen.getByText(t("themabeheer.serverReden", { melding: weigering }))).toBeInTheDocument();

    // Still open, and still able to pick another subthema: a refusal a teacher can act on must leave the
    // control that acts on it standing.
    expect(
      within(await klassectie()).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })),
    ).toBeInTheDocument();
  });

  it("haalt de bestemmingen opnieuw op na een weigering, zodat de lijst niets blijft aanbieden wat weg is", async () => {
    /*
      Found in a browser, by no test: with the destination deleted by a colleague, the server answers 400 with
      "Dit subthema bestaat niet meer." while the picker one line above it still
      **offered** that subthema, and still had it selected. A message asserting something is gone beside a
      control presenting it is the contradiction that reopened E3-07.

      Pinned as "the destinations are refetched after a failure", which is the property that makes the list
      correct whatever the reason for the refusal was.
    */
    const { fake, sectie } = await openVerplaatspaneel({ verplaatsWeigering: "Dit subthema bestaat niet meer." });

    const voor = fake.urls.filter((url) => url.includes("/api/subthemas/voor-klas/")).length;
    expect(voor).toBeGreaterThan(0);

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    );

    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();
    await waitFor(() =>
      expect(fake.urls.filter((url) => url.includes("/api/subthemas/voor-klas/")).length).toBeGreaterThan(voor),
    );
  });

  it("laat geen verplaatsknop staan voor een bestemming die intussen verdwenen is", async () => {
    /*
      The other half of the same browser finding, and it needs the destination to *really* vanish: once the
      refused subthema is refetched away, the id still held in state points at something the list no longer
      offers. A submit that stayed enabled on it could only reproduce the same refusal, which is the
      "message says it is gone, control still offers it" shape again.

      Asserted on the submit rather than on the select's value: a `<select>` refuses a value that matches no
      option all by itself, so that assertion would pass on any implementation, including one that trusts the
      stale state. The enabled/disabled state is the part this component decides.
    */
    const { sectie } = await openVerplaatspaneel({ verplaatsBestemmingVerdwijnt: true });

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    const submit = () =>
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }) as HTMLButtonElement;
    expect(submit().disabled).toBe(false);

    fireEvent.click(submit());
    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();

    /*
      The refused destination was this klas's only other subthema, so the list is now empty, and an empty list
      must be a **sentence** rather than a picker holding only its placeholder (antagonist round 1, MAJOR 2).
      The first version of this test asserted the bare placeholder as the desired outcome, which is how this
      class of defect became sticky in E3-07: a passing test declaring the contradiction correct.
    */
    await waitFor(() =>
      expect(
        within(sectie).getByText(t("themabeheer.activiteitVerplaatsGeenBestemming")),
      ).toBeInTheDocument(),
    );
    expect(
      within(sectie).queryByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    ).not.toBeInTheDocument();
    expect(
      within(sectie).queryByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
    ).not.toBeInTheDocument();
  });

  it("behandelt een 404 als een activiteit die iemand anders al verwijderde, niet als een mislukte verhuizing", async () => {
    const { sectie } = await openVerplaatspaneel({ verplaatsActiviteitAlWeg: true });

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    );

    // The section says it, because the row is refetched away; and it says "gone", not "failed".
    expect(await screen.findByText(t("themabeheer.activiteitAlWeg"))).toBeInTheDocument();
    expect(screen.queryByText(t("themabeheer.activiteitVerplaatsMislukt"))).not.toBeInTheDocument();

    // The panel closed with it: an open picker under a notice saying the activiteit is gone is the
    // self-contradiction that reopened E3-07.
    await waitFor(() =>
      expect(
        screen.queryByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })),
      ).not.toBeInTheDocument(),
    );
  });

  it("zegt ook waar de activiteit heen ging wanneer er eerst een subthema is aangemaakt", async () => {
    /*
      The regression test for antagonist round 1's MAJOR 1, and the flow no earlier test walked: every move test
      here wrote exactly once. `maakSubthema.isSuccess` is a **latched** flag, so a render-phase
      `if (verplaatst && maakSubthema.isSuccess) setVerplaatst(null)` cleared the notice on the very render that
      raised it, for the whole mount after one successful create. The confirmation then never painted, in the
      one flow where it is the only feedback there is: a move to another thema takes the row off this screen, so
      without the sentence a successful move is indistinguishable from a delete.
    */
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(within(sectie).getByRole("button", { name: t("themabeheer.subthemaNieuw") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), { target: { value: "Water en ijs" } });
    fireEvent.change(screen.getByLabelText(t("themabeheer.leeftijdLabel")), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
    expect(await within(await klassectie()).findByText("Water en ijs")).toBeInTheDocument();

    const naCreatie = await klassectie();
    fireEvent.click(
      await within(naCreatie).findByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      }),
    );
    const paneel = await klassectie();
    fireEvent.change(within(paneel).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(paneel).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    );

    expect(
      await screen.findByText(
        t("themabeheer.activiteitVerplaatstNaar", {
          activiteit: "Bladkroon maken",
          subthema: "Drijven en zinken",
          thema: "Water",
        }),
      ),
    ).toBeInTheDocument();
    // And the move really happened, so this is not a notice about nothing.
    expect(fake.verzoeken.some((verzoek) => verzoek.pad.endsWith("/subthema"))).toBe(true);
  });

  it("laat een eerdere mislukking niet terugkomen bij het opnieuw openen van het paneel", async () => {
    // The mutation lives on the row, not on the panel, so without a reset the next open greets a teacher with
    // the reason a *previous* attempt failed, beside a fresh picker and nothing attempted (antagonist round 1).
    const { sectie } = await openVerplaatspaneel({ verplaatsWeigering: "Dit subthema bestaat niet meer." });

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" })), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }) }),
    );
    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();

    fireEvent.click(
      within(await klassectie()).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAnnuleerAria", { naam: "Bladkroon maken" }),
      }),
    );
    fireEvent.click(
      within(await klassectie()).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      }),
    );

    expect(screen.queryByText(t("themabeheer.activiteitVerplaatsMislukt"))).not.toBeInTheDocument();
  });

  it("houdt twee gelijktijdig open panelen onderscheidbaar, want de open-staat is per rij", async () => {
    /*
      `verplaatsen` is per-row state, so two rows can have a panel open at once. With one heading and one select
      label shared between them, a screen reader got two identically named controls and two identical headings
      with nothing saying which activiteit they belong to (antagonist round 1). The property asserted is that no
      two accessible names in the section collide, over every control and every heading, so a third panel or a
      fourth control is covered without anyone remembering this test.

      A second activiteit is created through the UI rather than added to the fixtures, so no other test's
      expectations move.
    */
    const fake = renderApp(L3_PAD);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitNieuwAria", { naam: "Bladeren" }) }),
    );
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), {
      target: { value: "Bladeren persen" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
    expect(await within(await klassectie()).findByText(/Bladeren persen/)).toBeInTheDocument();
    expect(fake.verzoeken.some((verzoek) => verzoek.pad.endsWith("/activiteiten"))).toBe(true);

    for (const naam of ["Bladkroon maken", "Bladeren persen"]) {
      fireEvent.click(
        await within(await klassectie()).findByRole("button", {
          name: t("themabeheer.activiteitVerplaatsAria", { naam }),
        }),
      );
    }

    const beide = await klassectie();
    const selects = within(beide).getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const namen = [
      ...within(beide).getAllByRole("button"),
      ...selects,
      ...within(beide).getAllByRole("heading"),
    ].map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "");

    expect(new Set(namen).size).toBe(namen.length);
  });

  it("is een echte uitklapknop: hij meldt de paneelstaat, wijst ernaar en klapt ook weer in", async () => {
    /*
      Round 4's MAJOR. The trigger used to open only, while `aria-expanded` reported `true`, so a screen reader
      heard "uitgevouwen, knop" and pressing it called `setVerplaatsen(true)` on a state already `true`: no
      collapse, no focus move, nothing. That is the surviving half of round 2's MAJOR 1 for exactly the users who
      cannot see that the panel is open, and no axe rule catches a lying `aria-expanded`.

      Closing from the trigger also has to do the panel's own cleanup, or round 2's MINOR 3 comes back by a new
      door: a stale failure greeting the next open, with a destination still preselected.
    */
    const { sectie } = await openVerplaatspaneel({ verplaatsWeigering: "Dit subthema bestaat niet meer." });
    const trigger = () =>
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      });

    // It says the panel is open, and it says which panel.
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const paneelId = trigger().getAttribute("aria-controls");
    expect(paneelId).toBeTruthy();
    expect(document.getElementById(paneelId!)).toBeInTheDocument();

    // Leave a failure and a choice behind, so the cleanup has something to clean.
    fireEvent.change(
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
    );
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );
    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();

    // Pressing the trigger while open collapses it, which is what it had been announcing all along.
    fireEvent.click(within(await klassectie()).getByRole("button", {
      name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
    }));
    const dicht = await klassectie();
    const naSluiten = within(dicht).getByRole("button", {
      name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
    });
    expect(naSluiten).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(paneelId!)).not.toBeInTheDocument();

    // And it reset on the way out: no stale reason, no preselected destination behind an enabled submit.
    fireEvent.click(naSluiten);
    const heropend = await klassectie();
    expect(screen.queryByText(t("themabeheer.activiteitVerplaatsMislukt"))).not.toBeInTheDocument();
    expect(
      (within(heropend).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ) as HTMLSelectElement).value,
    ).toBe("");
    expect(
      (within(heropend).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("biedt bij een laadfout een knop die de lijst echt opnieuw ophaalt", async () => {
    /*
      Round 4's MINOR 1. Round 3 asked the list-error state to name a remedy; the first attempt put "Probeer het
      opnieuw." in the copy with nothing to press, which is the half-measure `Themakiezer`'s own fix round
      rejected. Closing and reopening this panel issues no request: the query is section-scoped, stays mounted
      with the row, and has exhausted its retries. So the button is the remedy, and the sentence states the fact.
    */
    const { fake, sectie } = await openVerplaatspaneel({ bestemmingenFaalt: true });

    expect(within(sectie).getByText(t("themabeheer.activiteitVerplaatsLijstFout"))).toBeInTheDocument();
    const voor = fake.urls.filter((url) => url.includes("/api/subthemas/voor-klas/")).length;
    expect(voor).toBeGreaterThan(0);

    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsOpnieuwAria") }),
    );

    await waitFor(() =>
      expect(fake.urls.filter((url) => url.includes("/api/subthemas/voor-klas/")).length).toBeGreaterThan(voor),
    );
  });

  it("zet nooit twee tegenstrijdige meldingen tegelijk boven de lijst", async () => {
    /*
      Round 4's MINOR 3. `Klaslaag`'s comment claims the two notices are "mutually exclusive by construction,
      since each setter clears the other", and the construction is there while nothing observed it: removing
      either clear left the suite green. The state is reachable, and it prints an assertive "Deze activiteit
      bestaat niet meer" directly above a polite "staat nu bij Drijven en zinken", which is the contradiction
      class this story has now fixed four times in four shapes.

      `subthemaAlWeg` makes the delete answer 404, which is the only thing that raises `alWeg`: a *successful*
      delete reports nothing upward, which is E1-20.
    */
    const { sectie } = await openVerplaatspaneel({ subthemaAlWeg: true });

    // First a successful move, which raises the confirmation.
    fireEvent.change(
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
    );
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );
    const bevestiging = t("themabeheer.activiteitVerplaatstNaar", {
      activiteit: "Bladkroon maken",
      subthema: "Drijven en zinken",
      thema: "Water",
    });
    expect(await screen.findByText(bevestiging)).toBeInTheDocument();

    // Then a colleague's delete of the subthema, which raises the other notice.
    const metSubthema = await klassectie();
    fireEvent.click(
      within(metSubthema).getByRole("button", {
        name: t("themabeheer.subthemaVerwijderAria", { naam: "Bladeren" }),
      }),
    );
    fireEvent.click(
      within(await klassectie()).getByRole("button", { name: t("themabeheer.subthemaVerwijderBevestig") }),
    );

    // Whichever arrives second, the other is gone: they cannot both stand.
    await waitFor(() => expect(screen.getByText(t("themabeheer.subthemaAlWeg"))).toBeInTheDocument());
    expect(screen.queryByText(bevestiging)).not.toBeInTheDocument();

  });

  it("wist de verwijdermelding zodra een verhuizing lukt, de andere richting van dezelfde uitsluiting", async () => {
    /*
      The exclusion is a claim about a **pair**, so it needs both directions. A first version asserted only
      move-then-delete, and removing `setAlWeg(null)` from `onVerplaatst` then left the suite green.

      It has to be its own test rather than two more steps in the previous one: a successful cross-thema move
      takes the activiteit off this screen, so there is nothing left to move a second time. The order here is
      therefore 404-delete first, move second.
    */
    /*
      The notice is raised by a move that 404s, not by a subthema delete: `subthemaAlWeg` removes the subthema
      from the store, so after that sentence there is no activiteit left on this screen to move. This fixture
      404s the first attempt only and leaves the row in place.
    */
    const { sectie } = await openVerplaatspaneel({ verplaatsActiviteitAlWegEenmaal: true });

    const kies = (huidig: HTMLElement) =>
      fireEvent.change(
        within(huidig).getByLabelText(
          t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
        ),
        { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
      );
    const verstuur = (huidig: HTMLElement) =>
      fireEvent.click(
        within(huidig).getByRole("button", {
          name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
        }),
      );

    kies(sectie);
    verstuur(sectie);
    expect(await screen.findByText(t("themabeheer.activiteitAlWeg"))).toBeInTheDocument();

    const naFout = await klassectie();
    fireEvent.click(
      await within(naFout).findByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      }),
    );
    const opnieuw = await klassectie();
    kies(opnieuw);
    verstuur(opnieuw);

    expect(
      await screen.findByText(
        t("themabeheer.activiteitVerplaatstNaar", {
          activiteit: "Bladkroon maken",
          subthema: "Drijven en zinken",
          thema: "Water",
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(t("themabeheer.activiteitAlWeg"))).not.toBeInTheDocument();
  });

  it("houdt de verplaatsknop staan wanneer het paneel open is en er niets meer te kiezen valt", async () => {
    // Round 4's MINOR 5: `|| verplaatsen` in `kanVerplaatsen` was unasserted. The trigger is now also the
    // panel's toggle, so losing it in this state would take a way out with it.
    const { sectie } = await openVerplaatspaneel({ verplaatsBestemmingVerdwijnt: true });

    fireEvent.change(
      within(sectie).getByLabelText(
        t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }),
      ),
      { target: { value: "cccccccc-0000-0000-0000-000000000002" } },
    );
    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestigAria", { naam: "Bladkroon maken" }),
      }),
    );
    expect(
      await screen.findByText(t("themabeheer.activiteitVerplaatsGeenBestemming")),
    ).toBeInTheDocument();

    expect(
      within(await klassectie()).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }),
      }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("heeft geen axe-schendingen met het verplaatspaneel open", async () => {
    // Every other panel on these screens got an axe pass in the state it renders in; this one introduces the
    // first select/optgroup on the card and a new heading level (antagonist round 1).
    const { sectie } = await openVerplaatspaneel();
    await within(sectie).findByLabelText(t("themabeheer.activiteitVerplaatsKiezerAria", { naam: "Bladkroon maken" }));

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("geeft elke verplaatsknop een eigen naam, zodat drie activiteiten niet drie keer hetzelfde heten", async () => {
    const { sectie } = await openVerplaatspaneel();

    /*
      Landing 2 found four controls on one card sharing an accessible name, and this row now carries four. The
      first version of this affordance reintroduced the defect twice over: the trigger toggled to "Annuleren"
      beside the panel's own "Annuleren", and the submit repeated the trigger's "Verplaatsen". So the property
      asserted here is that **no two controls in this row share a name**, over every control, rather than that
      one particular label exists.
    */
    /*
      Scoped to the activiteit's own row, and that scope is load-bearing. At section level "Wijzigen" and
      "Verwijderen" each appear twice by design (once for the subthema, once for the activiteit), disambiguated
      by their aria-labels and by the row a teacher sees them in. That is E1-14's deliberate answer, so a
      section-wide check would fail on correct code.
    */
    const rij = within(sectie)
      .getByRole("button", { name: t("themabeheer.activiteitVerplaatsAria", { naam: "Bladkroon maken" }) })
      .closest("li") as HTMLElement;
    const knoppen = within(rij).getAllByRole("button");
    const namen = knoppen.map((knop) => knop.getAttribute("aria-label") ?? knop.textContent?.trim() ?? "");
    const zichtbaar = knoppen.map((knop) => knop.textContent?.trim() ?? "");

    expect(namen.length).toBeGreaterThan(4);
    // What a screen reader hears.
    expect(new Set(namen).size).toBe(namen.length);
    /*
      And what a sighted teacher reads, which is a **separate** property: an `aria-label` keeps the accessible
      names unique even when two buttons show the same word, so the first version of this guard passed on the
      defect it was written for (the trigger toggling to "Annuleren" beside the panel's own "Annuleren").
    */
    expect(new Set(zichtbaar).size).toBe(zichtbaar.length);
  });
});

/**
 * The Doelkiezer's scope (E9-07, CR5): a teacher is offered their own class's doelen, not the whole register.
 *
 * **What makes these tests worth having is what they can catch.** The scoping is a query parameter, so a screen that
 * dropped it looks identical and simply offers too much; and a screen that scoped to an empty set looks identical and
 * offers nothing. Both are silent. So each test here asserts on the RESULTS and, where it matters, on the request.
 */
describe("Klaslaag — de Doelkiezer scoopt op de klas (E9-07, CR5)", () => {
  /** Opens the subthema picker on a class page and types a term that matches every doel in the fixture. */
  async function opendPicker(pad: string, opties: ThemaFakeOpties = {}) {
    const fake = renderApp(pad, opties);
    const sectie = await klassectie();

    fireEvent.click(
      within(sectie).getByRole("button", {
        name: t("themabeheer.subdoelKoppelAria", { naam: "Bladeren" }),
      }),
    );
    // Matches on the shared "-0" in every fixture code, so the SCOPE is the only thing narrowing the result.
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "-0" },
    });

    return fake;
  }

  it("biedt een L3-klas alleen de doelen van L3 aan", async () => {
    const fake = await opendPicker(L3_PAD);

    expect(await screen.findByText(DOEL_L3.tekst)).toBeInTheDocument();

    // The complaint CR5 was raised about: an L3 teacher was offered kleuterdoelen.
    expect(screen.queryByText("De kleuter observeert planten in de omgeving.")).toBeNull();
    expect(screen.queryByText("De leerling herkent een puls in muziek.")).toBeNull();

    // Scoped server-side, not in the browser: after a full import the register is thousands of rows.
    const zoekvragen = fake.urls.filter((url) => url.startsWith("/api/leerplandoelen?"));
    expect(zoekvragen.some((url) => url.includes("jaarFase=L3"))).toBe(true);
  });

  it("zegt in welke doelen er gezocht is", async () => {
    await opendPicker(L3_PAD);

    await screen.findByText(DOEL_L3.tekst);

    // A picker that narrowed silently would make a teacher who knows a doel exists doubt the import, not the filter.
    expect(
      screen.getByText(t("themabeheer.doelBereikGemeten", { fasen: "L3" })),
    ).toBeInTheDocument();
  });

  it("verbreedt naar het hele curriculum op vraag, en zegt dat ook", async () => {
    await opendPicker(L3_PAD);
    await screen.findByText(DOEL_L3.tekst);

    const groep = screen.getByRole("group", { name: t("themabeheer.doelBereikLabel") });
    fireEvent.click(within(groep).getByRole("button", { name: t("themabeheer.doelBereikAlles") }));

    // Never HIDDEN, only ranked away by default: a graadklas legitimately teaches across fasen, and E5-02's ruling is
    // that the teacher narrows on screen rather than the tool deciding.
    expect(
      await screen.findByText("De kleuter observeert planten in de omgeving."),
    ).toBeInTheDocument();
    expect(screen.getByText(t("themabeheer.doelBereikGemetenAlles"))).toBeInTheDocument();
    expect(screen.queryByText(t("themabeheer.doelBereikGemeten", { fasen: "L3" }))).toBeNull();
  });

  it("biedt een kleutergroep alle drie de kleuterjaren aan, want welk jaar het is staat niet vast", async () => {
    // `Leerjaar = 0` cannot say WHICH kleuterjaar, so the widest honest answer is all three (E5-02, 2026-08-04). A tool
    // that guessed K3 would hide two thirds of what a derde kleuterklas may legitimately teach.
    /*
      Driven through the THEMA-level picker rather than the subthema one, because the kleuter fixture deliberately has no
      subthema's of its own (another test pins that a class sees only its own). The scope is a property of the picker
      wherever it is mounted, and the thema level is the one reachable on this class's page.
    */
    const fake = renderApp(`/themas/${THEMA_HERFST}?klas=${KLAS_K3}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.doelKiezerTitel") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "-0" },
    });

    expect(await screen.findByText("De kleuter observeert planten in de omgeving.")).toBeInTheDocument();
    expect(screen.queryByText(DOEL_L3.tekst)).toBeNull();

    const zoekvragen = fake.urls.filter((url) => url.startsWith("/api/leerplandoelen?"));
    expect(
      zoekvragen.some(
        (url) => url.includes("jaarFase=JK") && url.includes("jaarFase=K2") && url.includes("jaarFase=K3"),
      ),
    ).toBe(true);
  });

  it("zegt het wanneer de klasgegevens niet geladen konden worden, in plaats van stil te verbreden", async () => {
    /*
      **A failed read is not the same fact as an undeducible class, and the screen must not conflate them** (audit
      finding, 2026-08-20). Both widen the search, because widening is the safe direction. But an undeducible graadklas
      is an *answer*, while a 500 is the absence of one, and only the second silently restores exactly the
      whole-register search CR5 exists to remove. Before this the picker said nothing at all in that state:
      `doelBereikOnbekend` is gated on the payload having arrived, so it was unreachable.
    */
    const fake = await opendPicker(L3_PAD, { klasLeesFaalt: true });

    // Widened: a kleuterdoel is offered to an L3 class, which is the pre-CR5 behaviour and the honest fallback here.
    expect(await screen.findByText("De kleuter observeert planten in de omgeving.")).toBeInTheDocument();
    expect(screen.getByText(DOEL_L3.tekst)).toBeInTheDocument();

    // And it SAYS so, with the degrade rather than the graadklas sentence.
    expect(screen.getByText(t("themabeheer.doelBereikNietGeladen"))).toBeInTheDocument();
    expect(screen.queryByText(t("themabeheer.doelBereikOnbekend"))).toBeNull();

    // No scope control, because there is nothing to switch between.
    expect(screen.queryByRole("group", { name: t("themabeheer.doelBereikLabel") })).toBeNull();

    const zoekvragen = fake.urls.filter((url) => url.startsWith("/api/leerplandoelen?"));
    expect(zoekvragen.every((url) => !url.includes("jaarFase="))).toBe(true);
  });

  it("verbreedt in plaats van naar niets te versmallen wanneer de klas geen jaar of fase heeft", async () => {
    /*
      The unresolved graadklas. An empty `jaarFasen` means the set COULD NOT BE DERIVED, never "teaches nothing", and a
      search scoped to an empty set makes every leerplandoel unreachable -- worse than the unscoped search this story
      replaces. So it widens, and it says why, because this is the one unscoped state the teacher did not ask for.
    */
    const fake = await opendPicker(L3_PAD, { onbepaaldeKlas: true });

    expect(await screen.findByText(DOEL_L3.tekst)).toBeInTheDocument();
    expect(screen.getByText("De kleuter observeert planten in de omgeving.")).toBeInTheDocument();
    expect(screen.getByText(t("themabeheer.doelBereikOnbekend"))).toBeInTheDocument();

    // No scope control, because both positions would search the whole curriculum (the E3-06 rule).
    expect(screen.queryByRole("group", { name: t("themabeheer.doelBereikLabel") })).toBeNull();

    const zoekvragen = fake.urls.filter((url) => url.startsWith("/api/leerplandoelen?"));
    expect(zoekvragen.every((url) => !url.includes("jaarFase="))).toBe(true);
  });
});
