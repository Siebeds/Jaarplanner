import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t } from "../../i18n";
import { KLAS_K3, KLAS_L3, THEMA_HERFST, maakThemaFetchFake, type ThemaFakeOpties } from "./testdata";

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
      target: { value: "MUZ-L2-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "MUZ-L2-01",
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
        code: "MUZ-L2-01",
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
      target: { value: "NAT-K3-02" },
    });

    // Three pickers can be open on one screen (thema, subthema, activiteit). Identical labels would leave a
    // screen-reader user with three "Koppelen" buttons and no way to tell them apart.
    expect(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "NAT-K3-02",
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
      target: { value: "MUZ-L2-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("themabeheer.doelKoppelAria", {
          code: "MUZ-L2-01",
          waaraan: t("themabeheer.niveauActiviteit"),
        }),
      }),
    );

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0].pad).toMatch(/^\/api\/activiteiten\/.+\/doelkoppelingen$/);

    const ontkoppel = await screen.findByRole("button", {
      name: t("themabeheer.ontkoppelAria", {
        code: "MUZ-L2-01",
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

    const keuzelijst = within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsLabel"));
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
  });

  it("verplaatst de activiteit en zegt waar ze nu staat, want de rij verdwijnt van dit scherm", async () => {
    const { fake, sectie } = await openVerplaatspaneel();

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsLabel")), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestig") }),
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
    const weigering = "Dit subthema bestaat niet meer. Kies een ander subthema.";
    const { sectie } = await openVerplaatspaneel({ verplaatsWeigering: weigering });

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsLabel")), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestig") }),
    );

    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();
    expect(screen.getByText(t("themabeheer.serverReden", { melding: weigering }))).toBeInTheDocument();

    // Still open, and still able to pick another subthema: a refusal a teacher can act on must leave the
    // control that acts on it standing.
    expect(
      within(await klassectie()).getByLabelText(t("themabeheer.activiteitVerplaatsLabel")),
    ).toBeInTheDocument();
  });

  it("haalt de bestemmingen opnieuw op na een weigering, zodat de lijst niets blijft aanbieden wat weg is", async () => {
    /*
      Found in a browser, by no test: with the destination deleted by a colleague, the server answers 400 with
      "Dit subthema bestaat niet meer. Kies een ander subthema." while the picker one line above it still
      **offered** that subthema, and still had it selected. A message asserting something is gone beside a
      control presenting it is the contradiction that reopened E3-07.

      Pinned as "the destinations are refetched after a failure", which is the property that makes the list
      correct whatever the reason for the refusal was.
    */
    const { fake, sectie } = await openVerplaatspaneel({ verplaatsWeigering: "Dit subthema bestaat niet meer." });

    const voor = fake.urls.filter((url) => url.includes("/api/subthemas/voor-klas/")).length;
    expect(voor).toBeGreaterThan(0);

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsLabel")), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestig") }),
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

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsLabel")), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    const submit = () =>
      within(sectie).getByRole("button", {
        name: t("themabeheer.activiteitVerplaatsBevestig"),
      }) as HTMLButtonElement;
    expect(submit().disabled).toBe(false);

    fireEvent.click(submit());
    expect(await screen.findByText(t("themabeheer.activiteitVerplaatsMislukt"))).toBeInTheDocument();

    // The refused destination is gone from the list, so the choice is no longer a choice.
    await waitFor(() => expect(submit().disabled).toBe(true));
    expect(
      within(sectie)
        .getByLabelText(t("themabeheer.activiteitVerplaatsLabel"))
        .querySelectorAll("option").length,
    ).toBe(1);
  });

  it("behandelt een 404 als een activiteit die iemand anders al verwijderde, niet als een mislukte verhuizing", async () => {
    const { sectie } = await openVerplaatspaneel({ verplaatsActiviteitAlWeg: true });

    fireEvent.change(within(sectie).getByLabelText(t("themabeheer.activiteitVerplaatsLabel")), {
      target: { value: "cccccccc-0000-0000-0000-000000000002" },
    });
    fireEvent.click(
      within(sectie).getByRole("button", { name: t("themabeheer.activiteitVerplaatsBevestig") }),
    );

    // The section says it, because the row is refetched away; and it says "gone", not "failed".
    expect(await screen.findByText(t("themabeheer.activiteitAlWeg"))).toBeInTheDocument();
    expect(screen.queryByText(t("themabeheer.activiteitVerplaatsMislukt"))).not.toBeInTheDocument();

    // The panel closed with it: an open picker under a notice saying the activiteit is gone is the
    // self-contradiction that reopened E3-07.
    await waitFor(() =>
      expect(
        screen.queryByLabelText(t("themabeheer.activiteitVerplaatsLabel")),
      ).not.toBeInTheDocument(),
    );
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
