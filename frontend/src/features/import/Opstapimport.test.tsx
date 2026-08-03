import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { NAVIGATIE } from "../../app/routes";
import { t, tAantal } from "../../i18n";
import { OPSTAP_SECTIE_ALLEEN_BEHEERDER } from "./Opstapimport";
import {
  OPSTAP_MET_RIJPROBLEMEN,
  OPSTAP_OVERGESLAGEN,
  OPSTAP_SCHOON,
  OPSTAP_TE_HERZIEN,
  maakBestand,
  maakImportFetchFake,
  opstapCodeInAndereDiscipline,
  opstapOnbekendeDiscipline,
  opstapOnbekendeWeigering,
  opstapOntbrekendeMinimumdoelen,
  type ImportFakeOpties,
} from "./testdata";

/**
 * Pins the Op.stap review flow (E1-13 clause 6, FR-2.1/FR-2.5) against the real `App`.
 *
 * Two of these tests exist because of named traps rather than of features:
 * - a **409** must read as a system state with a next step, not as a rejection of a file the school just
 *   downloaded from Op.stap. While E1-12 is open it is almost always the missing decreed minimumdoelen;
 * - `diff.vereistReview` must **not** produce a standing banner, because it never clears once a discipline has
 *   lost a goal.
 */

function renderImport(opties: ImportFakeOpties = {}) {
  const fake = maakImportFetchFake(opties);
  vi.stubGlobal("fetch", vi.fn(fake.fetchFake));

  window.history.pushState({}, "", "/import");
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

/** The Op.stap section, so an assertion cannot accidentally match the school-content half above it. */
function sectie() {
  return screen.getByRole("region", { name: t("import.opstap.titel") });
}

function disciplineveld() {
  return screen.getByLabelText(t("import.opstap.disciplineLabel"));
}

function bestandsveld() {
  return screen.getByLabelText(t("import.opstap.bestandLabel"));
}

function nakijkknop() {
  return screen.getByRole("button", { name: t("import.opstap.nakijken") });
}

/** Fills in the discipline and the file the way a beheerder does, then checks. */
function vulInEnKijkNa(discipline = "1", bestandsnaam = "nederlands.xlsx") {
  fireEvent.change(disciplineveld(), { target: { value: discipline } });
  fireEvent.change(bestandsveld(), { target: { files: [maakBestand(bestandsnaam)] } });
  fireEvent.click(nakijkknop());
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Op.stap import — the section and its audience", () => {
  it("stands apart from the school-content import and names its audience in visible text", () => {
    renderImport();

    // Two separate sections on one page, each with its own heading: a teacher must never be handed a
    // discipline-number field beside their thema upload with no boundary between them.
    expect(screen.getByRole("heading", { name: t("import.schoolcontent.titel") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("import.opstap.titel") })).toBeInTheDocument();
    // Stated, not enforced: the API is unauthenticated (E7-11 owns that), so a client-side gate would be
    // theatre. The words are the honest option.
    expect(within(sectie()).getByText(t("import.opstap.publiek"))).toBeInTheDocument();
  });

  it("marks the beheerder audience on this section and not on the whole route", () => {
    // FA §3.2 has two rows with two audiences: Op.stap doelen = Beheerder, thema's/activiteiten = Beheerder AND
    // Leerkracht (FR-1.1). One flag on `/import` cannot say both, and it said "directie only", which is the
    // answer E6-02 would have filtered the nav by — hiding the school-content import from the teachers who are
    // entitled to it. So the route is open to both roles and the marking lives on the section.
    const importRoute = NAVIGATIE.find((bestemming) => bestemming.pad === "/import")!;
    expect(importRoute.magBeheerder).toBe(false);
    expect(OPSTAP_SECTIE_ALLEEN_BEHEERDER).toBe(true);
  });

  it("states the E1-12 prerequisite before the reader spends an upload on it", () => {
    // Every real per-discipline file refuses with a 409 while the decreed minimumdoelen have no source, so a
    // beheerder used to learn this by filling in a discipline number, uploading and failing. The 409 panel is
    // the reactive half and stays; this is the disclosure `routes.ts` had been claiming existed.
    renderImport();

    expect(within(sectie()).getByText(t("import.opstap.voorwaarde"))).toBeInTheDocument();
  });

  it("needs both a discipline number and a file before it can check anything", () => {
    renderImport();

    expect(nakijkknop()).toBeDisabled();

    fireEvent.change(bestandsveld(), { target: { files: [maakBestand()] } });
    // A file alone is not enough: the goal Excel carries no discipline column (Art. VII.1), so the number is
    // import context the uploader has to supply.
    expect(nakijkknop()).toBeDisabled();

    fireEvent.change(disciplineveld(), { target: { value: "9.2" } });
    expect(nakijkknop()).toBeEnabled();
  });

  it("sends the file and the discipline as multipart, preview first", async () => {
    const fake = renderImport();

    vulInEnKijkNa("9.2", "leren-leren.xlsx");
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    const verzoek = fake.verzoeken.at(-1)!;
    expect(verzoek.pad).toBe("/api/opstap-import/voorbeeld");
    expect(verzoek.disciplineNummer).toBe("9.2");
    expect(verzoek.bestandsnaam).toBe("leren-leren.xlsx");
    expect(verzoek.headers).not.toHaveProperty("Content-Type");
  });

  it("drops the outcome when the discipline number changes", async () => {
    renderImport();

    vulInEnKijkNa("1");
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    fireEvent.change(disciplineveld(), { target: { value: "2" } });

    // The same staleness rule as the school-content half: a report belongs to one file and one discipline.
    expect(screen.queryByRole("list", { name: t("import.verdict.groepLabel") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("import.opstap.doorvoeren") })).toBeNull();
  });

  it("commits only after a check", async () => {
    const fake = renderImport();

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    fireEvent.click(screen.getByRole("button", { name: t("import.opstap.doorvoeren") }));

    await screen.findByText(t("import.opstap.doorgevoerd"));
    expect(fake.verzoeken.map((v) => v.pad)).toEqual([
      "/api/opstap-import/voorbeeld",
      "/api/opstap-import",
    ]);
  });
});

describe("Op.stap import — the review report (FR-2.5)", () => {
  it("shows added and changed goals with their old and new values, and only counts the unchanged", async () => {
    renderImport({ opstapVoorbeeld: OPSTAP_TE_HERZIEN });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    expect(screen.getByText("NC-1.3")).toBeInTheDocument();
    expect(screen.getByText("NC-1.1")).toBeInTheDocument();
    expect(
      screen.getByText(
        t("import.opstap.veldWijziging", {
          oud: "De leerling luistert.",
          nieuw: "De leerling luistert actief.",
        }),
      ),
    ).toBeInTheDocument();
    // A field that was empty says so rather than rendering an empty pair of quotes.
    expect(
      screen.getByText(
        t("import.opstap.veldWijziging", { oud: t("import.opstap.veldLeeg"), nieuw: "Luisteren" }),
      ),
    ).toBeInTheDocument();

    // 120 unchanged goals are a count, never a list.
    expect(
      screen.getByText(
        new RegExp(t("import.telling", { aantal: 120, soort: t("import.soort.ongewijzigd") })),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("NC-9.1")).toBeNull();
  });

  it("scopes the disappearance notice to this run, and never keys it on vereistReview", async () => {
    renderImport({ opstapVoorbeeld: OPSTAP_TE_HERZIEN });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    const titel = tAantal(2, "import.opstap.verdwenenTitelEnkelvoud", "import.opstap.verdwenenTitel");
    expect(screen.getByRole("heading", { name: titel })).toBeInTheDocument();
    // Still linked, so it is the one a human has to decide about, and its link count is named.
    expect(
      screen.getByText(
        tAantal(3, "import.opstap.verdwenenKoppelingenEnkelvoud", "import.opstap.verdwenenKoppelingen"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(t("import.opstap.verdwenenOngekoppeld"))).toBeInTheDocument();

    // Choosing another file clears it. That is the whole point: `vereistReview` is true forever once a
    // discipline has lost a goal, so a notice keyed on it would be a banner nobody can dismiss (E3-09).
    fireEvent.change(bestandsveld(), { target: { files: [maakBestand("ander.xlsx")] } });
    expect(screen.queryByRole("heading", { name: titel })).toBeNull();
  });

  it("shows no disappearance notice for a run that only added goals, though vereistReview may be set", async () => {
    // `vereistReview` is also true for a mere change, so a notice about *disappearances* keyed on it would fire
    // when nothing disappeared. Derived from the two arrays instead.
    renderImport({
      opstapVoorbeeld: {
        ...OPSTAP_SCHOON,
        diff: { ...OPSTAP_SCHOON.diff, gewijzigd: [], vereistReview: true },
      },
    });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    expect(
      screen.queryByRole("heading", {
        name: tAantal(1, "import.opstap.verdwenenTitelEnkelvoud", "import.opstap.verdwenenTitel"),
      }),
    ).toBeNull();
  });
});

describe("Op.stap import — the English row diagnostics stay English (Art. II.3)", () => {
  it("shows them as secondary technical detail under a Dutch explanation, never as the headline", async () => {
    renderImport({ opstapVoorbeeld: OPSTAP_MET_RIJPROBLEMEN });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    // Untranslated: a malformed row in the *official* file is not something any user of this app can fix.
    expect(screen.getByText("Unknown doelsoort 'X'.")).toBeInTheDocument();
    expect(screen.getByText("Unknown doelsoort 'X'.")).toHaveAttribute("lang", "en");

    // Framed in Dutch, and framed as not the reader's fault.
    expect(
      screen.getByRole("heading", {
        name: tAantal(
          2,
          "import.opstap.rijproblemenTitelEnkelvoud",
          "import.opstap.rijproblemenTitel",
        ),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(t("import.opstap.rijproblemenUitleg"))).toBeInTheDocument();
  });
});

describe("Op.stap import — a refusal is a system state, not a broken download (trap 1)", () => {
  it("frames the E1-12 refusal as something the application is missing, apart from the row problems", async () => {
    renderImport({ opstapVoorbeeld: opstapOntbrekendeMinimumdoelen() });

    vulInEnKijkNa();

    expect(await screen.findByText(t("import.opstap.geweigerdTitel"))).toBeInTheDocument();
    // The sentence that stops a directie member re-downloading a file that is fine.
    expect(screen.getByText(t("import.opstap.geweigerdSysteemUitleg"))).toBeInTheDocument();
    // The server's Dutch detail, because only it knows which refs are missing and it names the next step.
    expect(screen.getByText(/Laad eerst de decretale minimumdoelen in/)).toBeInTheDocument();

    // Not rendered as a row-level fault, and no report claiming an outcome.
    expect(screen.queryByRole("list", { name: t("import.verdict.groepLabel") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("import.opstap.doorvoeren") })).toBeNull();
  });

  it("does not tell the reader to wait for the tool when the file is the wrong discipline", async () => {
    // The two 409s have opposite owners of the fix, and the screen used to apply the system-state frame to
    // both. Printed above the server's own "Controleer of dit bestand bij discipline 1 hoort", the frame said
    // the toepassing could not read the file yet: two contradictory sentences, and a directie member sent off
    // to wait for a change that was never coming. Keyed on the RFC 7807 `type` now, not on Dutch prose.
    renderImport({ opstapVoorbeeld: opstapCodeInAndereDiscipline() });

    vulInEnKijkNa();

    expect(await screen.findByText(t("import.opstap.geweigerdTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("import.opstap.geweigerdDisciplineUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(t("import.opstap.geweigerdSysteemUitleg"))).toBeNull();
    // The server's detail still carries the specific codes and the step, because only it knows them.
    expect(screen.getByText(/Controleer of dit bestand bij discipline 1 hoort/)).toBeInTheDocument();
  });

  it("claims nothing specific for a 409 it cannot classify", async () => {
    // `IProblemDetailsService` fills `type` in from the status code when the server set nothing, so a refusal
    // added without a discriminator arrives looking exactly like this. Defaulting into either specific frame
    // would print a confident sentence about a cause nobody established.
    renderImport({ opstapVoorbeeld: opstapOnbekendeWeigering() });

    vulInEnKijkNa();

    expect(await screen.findByText(t("import.opstap.geweigerdAlgemeenUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(t("import.opstap.geweigerdSysteemUitleg"))).toBeNull();
    expect(screen.queryByText(t("import.opstap.geweigerdDisciplineUitleg"))).toBeNull();

    // **And it claims nothing about the data either.** The frame used to end with "en er is niets gewijzigd",
    // defended in a comment as "what a 409 always guarantees". It is not: 409 carries no statement about
    // whether a write occurred, and `isWeigering` is true on the *commit* path too, where that sentence is the
    // same guess this story's own `import.onbeschikbaarNaDoorvoeren` fix decided a client may not make
    // (round-2 audit, MINOR 1). Asserted on the rendered panel rather than on the key, so restoring the clause
    // fails here even if the key is renamed.
    expect(screen.getByRole("alert").textContent).not.toMatch(/niets gewijzigd/);
  });

  it("survives a 409 whose body carried no reason", async () => {
    renderImport({ opstapVoorbeeld: new Response("", { status: 409 }) });

    vulInEnKijkNa();

    expect(await screen.findByText(t("import.opstap.geweigerdTitel"))).toBeInTheDocument();
    expect(screen.getByText(t("import.opstap.geweigerdZonderReden"))).toBeInTheDocument();
    // No body means no discriminator either: the frame that asserts least.
    expect(screen.getByText(t("import.opstap.geweigerdAlgemeenUitleg"))).toBeInTheDocument();
  });

  it("treats a 400 as the uploader's own request to fix, in the ordinary alert", async () => {
    renderImport({ opstapVoorbeeld: opstapOnbekendeDiscipline() });

    vulInEnKijkNa("42");

    expect(await screen.findByText(/is geen Op\.stap-discipline/)).toBeInTheDocument();
    // A wrong discipline number is not a system state, so it does not borrow that frame.
    expect(screen.queryByText(t("import.opstap.geweigerdTitel"))).toBeNull();
  });

  it("blames nothing and nobody for a 500", async () => {
    renderImport({ opstapVoorbeeld: new Response("boom", { status: 500 }) });

    vulInEnKijkNa();

    expect(await screen.findByText(t("import.onbeschikbaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("import.opstap.geweigerdTitel"))).toBeNull();
    expect(screen.queryByText("boom")).toBeNull();
  });

  it("does not claim nothing changed when the failure happened on the commit", async () => {
    renderImport({ opstapCommit: new Response("", { status: 504 }) });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });
    fireEvent.click(screen.getByRole("button", { name: t("import.opstap.doorvoeren") }));

    expect(await screen.findByText(t("import.onbeschikbaarNaDoorvoeren"))).toBeInTheDocument();
    expect(screen.queryByText(t("import.onbeschikbaar"))).toBeNull();
  });
});

describe("Op.stap import — the report on screen belongs to the most recent run", () => {
  it("shows the fresh review report after an import, not the previous commit's panel", async () => {
    // Clause 6 fails on this: the discarded answer *is* the FR-2.5 review report. `commit.data` won by fixed
    // precedence and was never cleared, so re-checking after an import fired a real preview and then rendered
    // the previous commit. Reproduced in a browser on this half too.
    const fake = renderImport({
      opstapVoorbeeld: OPSTAP_SCHOON,
      opstapVoorbeeldHerhaald: OPSTAP_TE_HERZIEN,
    });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });
    fireEvent.click(screen.getByRole("button", { name: t("import.opstap.doorvoeren") }));
    await screen.findByText(t("import.opstap.doorgevoerd"));

    fireEvent.click(nakijkknop());

    // The fresh run's review report, which the second fixture has and the first does not.
    const titel = tAantal(2, "import.opstap.verdwenenTitelEnkelvoud", "import.opstap.verdwenenTitel");
    expect(await screen.findByRole("heading", { name: titel })).toBeInTheDocument();
    expect(screen.queryByText(t("import.opstap.doorgevoerd"))).toBeNull();
    expect(screen.getByRole("button", { name: t("import.opstap.doorvoeren") })).toBeInTheDocument();

    expect(fake.verzoeken.map((v) => v.pad)).toEqual([
      "/api/opstap-import/voorbeeld",
      "/api/opstap-import",
      "/api/opstap-import/voorbeeld",
    ]);
  });

  it("offers no import control for a run that reads nothing (the E3-06 rule)", async () => {
    // A discipline outside the configured import selection (E1-06) reads nothing at all, so "Doelen inlezen"
    // would write nothing and then answer "De doelen zijn ingelezen."
    renderImport({ opstapVoorbeeld: OPSTAP_OVERGESLAGEN });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    expect(screen.getByText(t("import.opstap.nietsInTeLezen"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("import.opstap.doorvoeren") })).toBeNull();
    // The opmerking says which of the two reasons it is; the screen does not guess.
    expect(screen.getByText(/buiten de ingestelde importselectie/)).toBeInTheDocument();
  });
});

describe("Op.stap import — accessibility", () => {
  it("passes an axe structure check with a full review report on screen", async () => {
    renderImport({ opstapVoorbeeld: OPSTAP_TE_HERZIEN });

    vulInEnKijkNa();
    await screen.findByRole("list", { name: t("import.verdict.groepLabel") });

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
