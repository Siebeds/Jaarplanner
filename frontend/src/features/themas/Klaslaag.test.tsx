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
