import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t, tAantal } from "../../i18n";
import {
  HERFST,
  KLAS_K3,
  KLAS_L3,
  THEMA_HERFST,
  THEMA_WATER,
  maakThemaFetchFake,
  type ThemaFakeOpties,
} from "./testdata";

/**
 * Pins the beheer screens (E1-14, FR-3.1/3.2/3.3) against the **real** `App`, so the nested
 * `/themas/:themaId` route, the URL as the source of truth (ADR-0021) and the real `nl.json` copy are all
 * under test.
 *
 * The assertions worth reading first are the two about the **level boundary** (Art. IX.2), because they are
 * the ones that pin behaviour a passing screen can get wrong invisibly: with no class chosen the screen must
 * make **no** per-class request, and with one chosen it must ask for **that** class rather than filter a
 * full tree in the browser. Both are asserted against the requests made, not only against what is rendered.
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

/** The thema list, awaited. */
function lijst() {
  return screen.findByRole("list", { name: t("themabeheer.lijstLabel") });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Thema's — de lijst (FR-3.1)", () => {
  it("toont per thema de duur, het aantal themadoelen en hoeveel klassen erop bouwden", async () => {
    renderApp("/themas");

    const rijen = within(await lijst()).getAllByRole("listitem");
    expect(rijen).toHaveLength(2);

    const herfst = within(await lijst()).getByRole("link", { name: /Herfst/ });
    expect(herfst).toHaveTextContent(tAantal(6, "themabeheer.duurEnkelvoud", "themabeheer.duur"));
    expect(herfst).toHaveTextContent(
      tAantal(2, "themabeheer.themadoelenEnkelvoud", "themabeheer.themadoelen"),
    );
    // Singular through tAantal: "1 klas werkte dit uit", never "1 klassen werkten".
    expect(herfst).toHaveTextContent(
      tAantal(1, "themabeheer.klassenEnkelvoud", "themabeheer.klassen"),
    );
  });

  it("markeert het 2-of-3-advies met woorden, en alleen bij een thema dat eronder zit", async () => {
    renderApp("/themas");

    const water = within(await lijst()).getByRole("link", { name: /Water/ });
    const herfst = within(await lijst()).getByRole("link", { name: /Herfst/ });

    // Water heeft 1 themadoel (heeftVoldoendeThemadoelen: false), Herfst er 2.
    expect(water).toHaveTextContent(t("themabeheer.adviesKort"));
    expect(herfst).not.toHaveTextContent(t("themabeheer.adviesKort"));
  });

  it("zegt bij een lege bibliotheek wat je kan doen, in plaats van een lege lijst te tonen", async () => {
    renderApp("/themas", { bibliotheek: [] });

    expect(await screen.findByText(t("themabeheer.leegTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("themabeheer.leegUitleg"))).toBeInTheDocument();
  });

  it("meldt een mislukte lijst als fout en niet als leeg", async () => {
    renderApp("/themas", { bibliotheekFaalt: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(t("themabeheer.fout"));
    expect(screen.queryByText(t("themabeheer.leegTitel"))).not.toBeInTheDocument();
  });

  it("houdt de klaskeuze in de link naar een thema", async () => {
    renderApp(`/themas?klas=${KLAS_L3}`);

    const herfst = within(await lijst()).getByRole("link", { name: /Herfst/ });
    // Losing `?klas=` here would silently reset the class the teacher is working on the moment they open a
    // thema, and the class-scoped half of the detail would then say "kies eerst een klas".
    expect(herfst.getAttribute("href")).toBe(`/themas/${THEMA_HERFST}?klas=${KLAS_L3}`);
  });
});

describe("Thema's — het detail en de niveaugrens (Art. IX.2)", () => {
  it("zegt van wie de schoolbrede laag is, één keer boven de velden", async () => {
    renderApp(`/themas/${THEMA_HERFST}`);

    expect(await screen.findByText(t("themabeheer.schoolTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("themabeheer.schoolUitleg"))).toBeInTheDocument();
    // Once, not per themadoel: the boundary is a section property, not a row property.
    expect(screen.getAllByText(t("themabeheer.schoolUitleg"))).toHaveLength(1);
  });

  it("vraagt zonder klaskeuze NIETS per klas op en vraagt de leerkracht een klas te kiezen", async () => {
    const fake = renderApp(`/themas/${THEMA_HERFST}`);

    expect(await screen.findByText(t("themabeheer.klasGeenKeuze"))).toBeInTheDocument();

    // The anti-bleed assertion, made against the requests rather than against the screen: with no class
    // chosen there is nothing to scope a read to, so no per-class read may happen at all.
    await waitFor(() => expect(fake.urls.length).toBeGreaterThan(0));
    expect(fake.urls.filter((url) => url.includes("/voor-klas/"))).toEqual([]);
  });

  it("vraagt met een klaskeuze precies die klas op, en toont wat die klas uitwerkte", async () => {
    const fake = renderApp(`/themas/${THEMA_HERFST}?klas=${KLAS_L3}`);

    expect(
      await screen.findByText(t("themabeheer.klasTitel", { klas: "L3 derde leerjaar" })),
    ).toBeInTheDocument();
    expect(await screen.findByText("Bladeren")).toBeInTheDocument();
    expect(screen.getByText(/Bladkroon maken/)).toBeInTheDocument();
    expect(screen.getByText(/creahoek/)).toBeInTheDocument();

    // Exactly one class read, for the class in the URL: not the full tree, not every class.
    await waitFor(() =>
      expect(fake.urls.filter((url) => url.includes("/voor-klas/"))).toEqual([
        `/api/themas/${THEMA_HERFST}/voor-klas/${KLAS_L3}`,
      ]),
    );
    // And `GET /api/themas` is never called: it would carry every class's content into the tab.
    expect(fake.urls.filter((url) => url === "/api/themas")).toEqual([]);
  });

  it("toont voor een klas zonder afgeleide inhoud dat die klas dit thema nog niet uitwerkte", async () => {
    renderApp(`/themas/${THEMA_HERFST}?klas=${KLAS_K3}`);

    expect(await screen.findByText(t("themabeheer.subthemasGeen"))).toBeInTheDocument();
    // K3's empty state must not show L3's subthema.
    expect(screen.queryByText("Bladeren")).not.toBeInTheDocument();
  });

  it("noemt een onbekend thema-id bij naam in plaats van een leeg paneel te tonen", async () => {
    renderApp("/themas/11111111-1111-1111-1111-000000000000");

    expect(await screen.findByText(t("themabeheer.onbekendTitel"))).toBeInTheDocument();
  });
});

describe("Thema's — aanmaken, wijzigen en verwijderen (FR-3.1)", () => {
  it("stuurt bij aanmaken geen klas mee, want een thema is van de school", async () => {
    const fake = renderApp("/themas");

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.nieuw") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.naamLabel")), {
      target: { value: "Winter" },
    });
    fireEvent.change(screen.getByLabelText(t("themabeheer.duurLabel")), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0]).toMatchObject({ pad: "/api/themas", methode: "POST" });
    expect(fake.verzoeken[0].body).toMatchObject({ naam: "Winter", duurWeken: 5 });
    // The payload has no klas and no leeftijd: those belong to the class-scoped levels (Art. IX.2), and
    // offering them here would be a field the server rejects.
    expect(fake.verzoeken[0].body).not.toHaveProperty("klasId");
    expect(fake.verzoeken[0].body).not.toHaveProperty("leeftijd");
  });

  it("weigert een leeg naamveld zonder de server lastig te vallen", async () => {
    const fake = renderApp("/themas");

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.nieuw") }));
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t("themabeheer.naamVerplicht"));
    expect(fake.verzoeken).toEqual([]);
  });

  it("stuurt de woordenschat als lijst, één regel per term", async () => {
    const fake = renderApp(`/themas/${THEMA_HERFST}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.wijzigActie") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.kernwoordenschatLabel")), {
      target: { value: "blad\n\nwind \n" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0]).toMatchObject({
      pad: `/api/themas/${THEMA_HERFST}`,
      methode: "PUT",
    });
    // Blank lines dropped and each term trimmed, so a trailing newline is not a woordenschat entry.
    expect(fake.verzoeken[0].body).toMatchObject({ kernwoordenschat: ["blad", "wind"] });
  });

  it("verwijdert niets op één klik en zegt eerst wat er mee verdwijnt", async () => {
    const fake = renderApp(`/themas/${THEMA_HERFST}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.verwijderActie") }));

    // The consequence is stated as a count of classes, from the bibliotheek's own aantalAfgeleideKlassen.
    expect(
      screen.getByText(
        tAantal(
          HERFST.aantalAfgeleideKlassen,
          "themabeheer.verwijderGevolgEnkelvoud",
          "themabeheer.verwijderGevolg",
        ),
      ),
    ).toBeInTheDocument();
    // Nothing has been sent yet: opening the confirmation is not the decision.
    expect(fake.verzoeken).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.verwijderBevestig") }));

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0]).toMatchObject({
      pad: `/api/themas/${THEMA_HERFST}`,
      methode: "DELETE",
    });
  });

  it("vraagt na het verwijderen niets meer op over het verwijderde thema", async () => {
    const fake = renderApp(`/themas/${THEMA_WATER}?klas=${KLAS_L3}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.verwijderActie") }));
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.verwijderBevestig") }));

    // Found in a browser, not by a test: invalidating the thema prefix made the class-scoped read fire again
    // for the thema just deleted, and the server answered 404. Invisible on a fast connection, and one slow
    // request away from telling a teacher their successful delete failed to load.
    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    const naVerwijderen = fake.urls.slice(fake.urls.indexOf(`/api/themas/${THEMA_WATER}`) + 1);
    expect(naVerwijderen.filter((url) => url.includes(THEMA_WATER))).toEqual([]);
  });

  it("zegt bij een thema zonder afgeleide inhoud dat alleen het thema zelf verdwijnt", async () => {
    renderApp(`/themas/${THEMA_WATER}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.verwijderActie") }));

    expect(screen.getByText(t("themabeheer.verwijderGevolgLeeg"))).toBeInTheDocument();
  });

  it("toont de weigering van de server erbij wanneer het thema nog in een jaarplan staat", async () => {
    const weigering =
      "Thema 'Herfst' staat nog 2 keer in een jaarplan en kan niet verwijderd worden. Verwijder het thema eerst uit die jaarplannen.";
    renderApp(`/themas/${THEMA_HERFST}`, { verwijderWeigering: weigering });

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.verwijderActie") }));
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.verwijderBevestig") }));

    // Our own framing sentence AND the server's reason: only the server knows how many placements there are,
    // and in which class (Art. II.3 as amended 2026-07-30).
    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent(t("themabeheer.verwijderMislukt"));
    expect(melding).toHaveTextContent(t("themabeheer.serverReden", { melding: weigering }));
  });
});

describe("Thema's — themadoelen koppelen (FR-3.2)", () => {
  it("koppelt een gezocht leerplandoel en stuurt alleen de code", async () => {
    const fake = renderApp(`/themas/${THEMA_HERFST}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.doelKiezerTitel") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "MUZ-L2-01" },
    });

    const koppel = await screen.findByRole("button", {
      name: t("themabeheer.doelKoppelAria", { code: "MUZ-L2-01" }),
    });
    fireEvent.click(koppel);

    await waitFor(() => expect(fake.verzoeken).toHaveLength(1));
    expect(fake.verzoeken[0]).toMatchObject({
      pad: `/api/themas/${THEMA_HERFST}/themadoelen`,
      methode: "POST",
      body: { leerplandoelCode: "MUZ-L2-01" },
    });
  });

  it("verbergt een al gekoppeld doel niet, maar zegt dat het al gekoppeld is", async () => {
    renderApp(`/themas/${THEMA_HERFST}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.doelKiezerTitel") }));
    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "NAT-K3-01" },
    });

    // Hiding it would leave a teacher searching for something they cannot find, unable to tell "not in the
    // curriculum" from "already done".
    expect(await screen.findByText(t("themabeheer.doelAlGekoppeld"))).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: t("themabeheer.doelKoppelAria", { code: "NAT-K3-01" }),
      }),
    ).not.toBeInTheDocument();
  });

  it("zegt bij een leeg curriculum dat er niets ingeladen is, niet dat de zoekterm niets oplevert", async () => {
    renderApp(`/themas/${THEMA_HERFST}`, { geenCurriculum: true });

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.doelKiezerTitel") }));

    // Two different facts, and a teacher can act on only one of them. Confusing them is what sent a teacher
    // refining a search that can never match (the same defect E1-16 was audited for).
    expect(await screen.findByText(t("themabeheer.doelGeenCurriculum"))).toBeInTheDocument();
    expect(screen.queryByLabelText(t("themabeheer.doelZoekLabel"))).not.toBeInTheDocument();
  });

  it("zoekt pas vanaf twee tekens, en zegt dat in plaats van niets gevonden te melden", async () => {
    const fake = renderApp(`/themas/${THEMA_HERFST}`);

    fireEvent.click(await screen.findByRole("button", { name: t("themabeheer.doelKiezerTitel") }));
    expect(screen.getByText(t("themabeheer.doelZoekKort"))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t("themabeheer.doelZoekLabel")), {
      target: { value: "N" },
    });

    expect(screen.getByText(t("themabeheer.doelZoekKort"))).toBeInTheDocument();
    expect(fake.urls.filter((url) => url.startsWith("/api/leerplandoelen?"))).toEqual([]);
  });

  it("toont de status van elk themadoel, zodat een voorstel niet als beslist leest", async () => {
    renderApp(`/themas/${THEMA_HERFST}`);

    // Herfst carries one Aanvaard and one Voorgesteld link; both statuses must be readable as words.
    expect(await screen.findByText(t("suggestieStatus.aanvaard"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.voorgesteld"))).toBeInTheDocument();
  });
});

describe("Thema's — de AI-suggesties staan bij het thema (eigenaarsruling 2026-08-04)", () => {
  it("toont de suggestiesectie op het themadetail", async () => {
    renderApp(`/themas/${THEMA_HERFST}`);

    expect(await screen.findByRole("heading", { name: t("matching.titel") })).toBeInTheDocument();
  });

  it("vraagt nergens meer een thema-id aan de leerkracht", async () => {
    renderApp("/themas");
    await lijst();

    // The stopgap this story removed: a GUID typed into a text box. Asserted as the absence of any textbox on
    // the list screen, so the check cannot pass because a key was renamed.
    expect(screen.queryAllByRole("textbox")).toEqual([]);
  });
});

describe("Thema's — toegankelijkheid", () => {
  it("heeft geen axe-schendingen op de lijst met een thema open en een klas gekozen", async () => {
    const { container } = { container: document.body };
    renderApp(`/themas/${THEMA_HERFST}?klas=${KLAS_L3}`);
    await screen.findByText("Bladeren");

    expect(await axe(container)).toHaveNoViolations();
  });
});
