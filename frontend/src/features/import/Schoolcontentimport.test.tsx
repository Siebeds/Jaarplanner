import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t, tAantal } from "../../i18n";
import {
  GELDIG_MAAR_VERLIES,
  MET_BEDREIGDE_BESLISSINGEN,
  MET_PROBLEMEN,
  MET_RIJPROBLEEM_ZONDER_VERLIES,
  SCHOON,
  VEEL_ONGEWIJZIGD,
  alsDoorgevoerd,
  maakBestand,
  maakImportFetchFake,
  type ImportFakeOpties,
} from "./testdata";
import { SJABLOON_URL } from "./api";

/**
 * Pins the school-content import (E1-13 clauses 1–5, FR-1.1…1.5) against the **real** `App`, so the `/import`
 * route, the real `nl.json` copy and the real transport are all under test rather than a `MemoryRouter` and a
 * mocked module.
 *
 * The fake records the parsed multipart body of every upload, which is deliberate: half of what this story must
 * get right is *what is sent*. The Art. IV.2 opt-in in particular is only meaningful if `false` really travels
 * on the wire unless a human ticked the box, and no assertion about the rendered page can show that.
 */

function renderImport(opties: ImportFakeOpties = {}) {
  const fake = maakImportFetchFake(opties);
  vi.stubGlobal("fetch", vi.fn(fake.fetchFake));

  window.history.pushState({}, "", "/import");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  // StrictMode because `main.tsx` is: effects double-invoke in development, and this repo has already had a bug
  // that passed a gentler harness and failed in a browser.
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
 * The school-content section. The page holds a second importer below it, so anything whose copy is shared
 * between the two is queried inside this container rather than on the whole document.
 */
function sectie() {
  return screen.getByRole("region", { name: t("import.schoolcontent.titel") });
}

/** The file field of the school-content section. */
function bestandsveld() {
  return screen.getByLabelText(t("import.schoolcontent.bestandLabel")) as HTMLInputElement;
}

/** Attaches a file the way a teacher does, through the real input. */
function kiesBestand(naam = "themas.xlsx") {
  fireEvent.change(bestandsveld(), { target: { files: [maakBestand(naam)] } });
}

function nakijkknop() {
  return screen.getByRole("button", { name: t("import.schoolcontent.nakijken") });
}

function doorvoerknop() {
  return screen.getByRole("button", { name: t("import.schoolcontent.doorvoeren") });
}

/** The two-verdict list, awaited: it appears once a run has answered. */
function verdicten() {
  return screen.findByRole("list", { name: t("import.verdict.groepLabel") });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Import screen — the sjabloon and the upload (clause 1)", () => {
  it("offers the sjabloon as a real download link, not a button", () => {
    renderImport();

    const link = screen.getByRole("link", { name: t("import.schoolcontent.sjabloon") });
    expect(link).toHaveAttribute("href", SJABLOON_URL);
    // `download` is what makes the browser save the `.xlsx` instead of trying to render it.
    expect(link).toHaveAttribute("download");
  });

  it("uploads the chosen file as multipart, with no Content-Type of our own", async () => {
    const fake = renderImport();

    kiesBestand("mijn-themas.xlsx");
    fireEvent.click(nakijkknop());

    await verdicten();

    const verzoek = fake.verzoeken.at(-1)!;
    expect(verzoek.pad).toBe("/api/schoolcontent-import/voorbeeld");
    expect(verzoek.bestandsnaam).toBe("mijn-themas.xlsx");
    // The browser must write `multipart/form-data; boundary=…` itself. A hard-set Content-Type is exactly what
    // made this endpoint unreachable from the SPA before this story (see `lib/api.ts`).
    expect(verzoek.headers).not.toHaveProperty("Content-Type");
  });

  it("cannot be checked until a file is chosen", () => {
    renderImport();

    expect(nakijkknop()).toBeDisabled();
    kiesBestand();
    expect(nakijkknop()).toBeEnabled();
  });

  it("names the chosen file back, so the reader can see which one is about to go", () => {
    renderImport();

    // Scoped to this section: the Op.stap importer below has its own picker with the same placeholder line.
    expect(within(sectie()).getByText(t("import.geenBestandGekozen"))).toBeInTheDocument();
    kiesBestand("herfst.xlsx");
    expect(
      within(sectie()).getByText(t("import.bestandGekozen", { naam: "herfst.xlsx" })),
    ).toBeInTheDocument();
  });
});

describe("Import screen — two verdicts that are never collapsed (clause 3)", () => {
  it("states both verdicts even when everything is fine", async () => {
    renderImport();

    kiesBestand();
    fireEvent.click(nakijkknop());

    const lijst = await verdicten();
    // Exactly two, always. A single "OK" line is the defect this clause forbids.
    expect(within(lijst).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lijst).getByText(t("import.verdict.gelezen"))).toBeInTheDocument();
    expect(within(lijst).getByText(t("import.verdict.volledig"))).toBeInTheDocument();
    expect(within(lijst).getByText(t("import.verdict.gelezenGoed"))).toBeInTheDocument();
    expect(
      within(lijst).getByText(t("import.verdict.volledigGoedVoorbeeld")),
    ).toBeInTheDocument();
  });

  it("warns on a file that parsed cleanly and still dropped content", async () => {
    renderImport({ voorbeeld: GELDIG_MAAR_VERLIES });

    kiesBestand();
    fireEvent.click(nakijkknop());

    const lijst = await verdicten();
    // Verdict 1 good, verdict 2 not: the exact combination that a single flag would render as success.
    expect(within(lijst).getByText(t("import.verdict.gelezenGoed"))).toBeInTheDocument();
    expect(
      within(lijst).getByText(
        tAantal(1, "import.verdict.volledigVerliesVoorbeeldEnkelvoud", "import.verdict.volledigVerliesVoorbeeld"),
      ),
    ).toBeInTheDocument();
  });

  it("says why nothing was overgenomen when the failure is the file itself", async () => {
    // `isVolledigVerwerkt` is false with zero opmerkingen here: the rejected rows *are* the missing content.
    // Without its own branch this verdict would read "0 stukken inhoud", which is false and ungrammatical.
    renderImport({ voorbeeld: MET_RIJPROBLEEM_ZONDER_VERLIES });

    kiesBestand();
    fireEvent.click(nakijkknop());

    const lijst = await verdicten();
    expect(
      within(lijst).getByText(t("import.verdict.volledigDoorProblemenVoorbeeld")),
    ).toBeInTheDocument();
  });

  it("uses the past tense only after a commit", async () => {
    renderImport({ voorbeeld: SCHOON, commit: alsDoorgevoerd(SCHOON) });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    // Before: it *can* happen. A preview has changed nothing, so claiming it has would be a lie about the data.
    expect(screen.getByText(t("import.verdict.volledigGoedVoorbeeld"))).toBeInTheDocument();

    fireEvent.click(doorvoerknop());

    expect(
      await screen.findByText(t("import.verdict.volledigGoedGedaan")),
    ).toBeInTheDocument();
    expect(screen.queryByText(t("import.verdict.volledigGoedVoorbeeld"))).toBeNull();
  });
});

describe("Import screen — per-row problems and dropped content (clause 2)", () => {
  it("names the row and the offending column, and never prints row 0", async () => {
    renderImport({ voorbeeld: MET_PROBLEMEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    expect(screen.getByText("Verplicht veld 'Klas' ontbreekt.")).toBeInTheDocument();
    expect(
      screen.getByText(`${t("import.rij", { nummer: 7 })} · ${t("import.kolom", { kolom: "Klas" })}`),
    ).toBeInTheDocument();

    // A file-level problem belongs to the file, not to row 0. The server sends 0; the screen must not show it.
    expect(screen.getByText(t("import.bestandNiveau"))).toBeInTheDocument();
    expect(screen.queryByText(t("import.rij", { nummer: 0 }))).toBeNull();
  });

  it("renders the opmerkingen for content that was dropped, separately from the problems", async () => {
    renderImport({ voorbeeld: GELDIG_MAAR_VERLIES });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    // The Dutch server diagnostic, verbatim: only the server knows which code was skipped (Art. II.3).
    expect(screen.getByText(/TYPO-999/)).toBeInTheDocument();
    expect(
      screen.getByText(
        tAantal(1, "import.schoolcontent.opmerkingenTitelEnkelvoud", "import.schoolcontent.opmerkingenTitel"),
      ),
    ).toBeInTheDocument();
    // And no problem list at all: this file parsed. The two must not merge.
    expect(
      screen.queryByText(tAantal(1, "import.problemenTitelEnkelvoud", "import.problemenTitel")),
    ).toBeNull();
  });
});

describe("Import screen — the preview and the diff (clause 4)", () => {
  it("offers no way to commit before a preview exists", () => {
    renderImport();

    kiesBestand();
    expect(
      screen.queryByRole("button", { name: t("import.schoolcontent.doorvoeren") }),
    ).toBeNull();
  });

  it("commits only after a preview, and to the committing endpoint", async () => {
    const fake = renderImport();

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    fireEvent.click(doorvoerknop());

    await screen.findByText(t("import.schoolcontent.doorgevoerd"));
    expect(fake.verzoeken.map((v) => v.pad)).toEqual([
      "/api/schoolcontent-import/voorbeeld",
      "/api/schoolcontent-import",
    ]);
    // No second commit control beside the confirmation: pressing it again would import the same file twice.
    expect(
      screen.queryByRole("button", { name: t("import.schoolcontent.doorvoeren") }),
    ).toBeNull();
  });

  it("collapses the unchanged majority to a count instead of listing 40 rows", async () => {
    renderImport({ voorbeeld: VEEL_ONGEWIJZIGD });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    expect(
      screen.getByText(
        new RegExp(t("import.telling", { aantal: 40, soort: t("import.soort.ongewijzigd") })),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Nieuw thema")).toBeInTheDocument();
    expect(screen.queryByText("Bestaand thema 1")).toBeNull();
    expect(screen.queryByText("Bestaand thema 40")).toBeNull();
  });

  it("names the klas and leeftijd of a changed subthema, because that is its identity", async () => {
    renderImport();

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    // A subthema is class/age-scoped (Art. IX.2): two rows reading "Bladeren, toegevoegd" for two classes
    // would be indistinguishable.
    expect(
      screen.getByText(
        t("import.subthemaContext", { thema: "Herfst", klas: "K3 groen", leeftijd: "5-6" }),
      ),
    ).toBeInTheDocument();
  });
});

describe("Import screen — add versus bijwerken (clause 5)", () => {
  it("pre-selects Toevoegen, the non-destructive option and the server's own default", () => {
    renderImport();

    expect(screen.getByRole("radio", { name: t("import.schoolcontent.modusToevoegen") })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: t("import.schoolcontent.modusBijwerken") }),
    ).not.toBeChecked();
  });

  it("sends the chosen mode", async () => {
    const fake = renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(screen.getByRole("radio", { name: t("import.schoolcontent.modusBijwerken") }));
    fireEvent.click(nakijkknop());
    await verdicten();

    expect(fake.verzoeken.at(-1)!.modus).toBe("Bijwerken");
  });
});

describe("Import screen — the Art. IV.2 warning and its opt-in (clause 5)", () => {
  it("offers no discard control when nothing is threatened", async () => {
    renderImport();

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("names every threatened decision, unchecked, with the count and consequence in its own label", async () => {
    renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    // The heading, specifically. The same sentence also exists as an `sr-only` `role="status"` sibling, so a
    // screen reader hears it announced live and reads it again in place; `getByText` would find two.
    expect(
      screen.getByRole("heading", {
        name: tAantal(4, "import.bedreigd.titelEnkelvoud", "import.bedreigd.titel"),
      }),
    ).toBeInTheDocument();
    for (const code of ["NC-1.1", "WO-2.3", "WO-2.4", "WO-2.5"]) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
    // The status of each is stated: it is the teacher's decision that is at stake, not an anonymous link.
    expect(screen.getAllByText(t("suggestieStatus.aanvaard"))).toHaveLength(2);
    expect(screen.getByText(t("suggestieStatus.manueel"))).toBeInTheDocument();
    expect(screen.getByText(t("suggestieStatus.geweigerd"))).toBeInTheDocument();

    const keuze = screen.getByRole("checkbox", {
      name: tAantal(4, "import.bedreigd.verwijderEnkelvoud", "import.bedreigd.verwijder"),
    });
    expect(keuze).not.toBeChecked();
  });

  it("keeps the decisions unless the box is ticked, and says so on the wire", async () => {
    const fake = renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();
    fireEvent.click(doorvoerknop());
    await screen.findByText(t("import.schoolcontent.doorgevoerd"));

    // Not merely absent from the form: `false` travels, which is what makes the server keep them (Art. IV.2).
    expect(fake.verzoeken.at(-1)!.beslissingenVerwijderen).toBe("false");
  });

  it("discards them only when the box is ticked, and does not re-preview when it is", async () => {
    const fake = renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    const voorTikken = fake.verzoeken.length;
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: tAantal(4, "import.bedreigd.verwijderEnkelvoud", "import.bedreigd.verwijder"),
      }),
    );
    // Ticking must not re-run the preview: the server would then answer with an EMPTY bedreigdeBeslissingen
    // (it discards instead of reporting), which would unmount the very list the checkbox refers to.
    expect(fake.verzoeken).toHaveLength(voorTikken);

    fireEvent.click(doorvoerknop());
    await screen.findByText(t("import.schoolcontent.doorgevoerd"));
    expect(fake.verzoeken.at(-1)!.beslissingenVerwijderen).toBe("true");
  });

  it("always previews non-destructively, whatever the box says", async () => {
    const fake = renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    expect(fake.verzoeken[0].beslissingenVerwijderen).toBe("false");
  });
});

describe("Import screen — a preview is never stale (the E3-04/E1-16 defect in a new flow)", () => {
  it("drops the preview when the file changes", async () => {
    renderImport();

    kiesBestand("eerste.xlsx");
    fireEvent.click(nakijkknop());
    await verdicten();

    kiesBestand("tweede.xlsx");

    // Not merely a disabled commit button: the whole outcome goes, because it describes another file.
    expect(
      screen.queryByRole("list", { name: t("import.verdict.groepLabel") }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: t("import.schoolcontent.doorvoeren") }),
    ).toBeNull();
  });

  it("drops the preview when the mode changes", async () => {
    renderImport();

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    fireEvent.click(screen.getByRole("radio", { name: t("import.schoolcontent.modusBijwerken") }));

    expect(screen.queryByRole("list", { name: t("import.verdict.groepLabel") })).toBeNull();
    expect(
      screen.queryByRole("button", { name: t("import.schoolcontent.doorvoeren") }),
    ).toBeNull();
  });

  it("forgets a ticked discard opt-in along with the preview it belonged to", async () => {
    const fake = renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(screen.getByRole("radio", { name: t("import.schoolcontent.modusBijwerken") }));
    fireEvent.click(nakijkknop());
    await verdicten();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: tAantal(4, "import.bedreigd.verwijderEnkelvoud", "import.bedreigd.verwijder"),
      }),
    );

    // A new file, a new preview, and the destructive choice starts from "keep" again: it counted a list of
    // threatened decisions belonging to the previous file.
    kiesBestand("andere.xlsx");
    fireEvent.click(nakijkknop());
    await verdicten();
    fireEvent.click(doorvoerknop());
    await screen.findByText(t("import.schoolcontent.doorgevoerd"));

    expect(fake.verzoeken.at(-1)!.beslissingenVerwijderen).toBe("false");
  });

  it("freezes the inputs while a request is in flight, so no answer can arrive for other inputs", async () => {
    // The preview never settles, which is the only way this state is observable at all: with an
    // immediately-resolving fake the whole pending phase is over before an assertion can run, and the guard
    // would be untestable.
    renderImport({ voorbeeld: "hangt" });

    kiesBestand();
    fireEvent.click(nakijkknop());

    await waitFor(() => expect(bestandsveld()).toBeDisabled());
    expect(screen.getByRole("radio", { name: t("import.schoolcontent.modusBijwerken") })).toBeDisabled();
    // The button says what it is doing rather than staying on its idle label.
    expect(
      screen.getByRole("button", { name: t("import.schoolcontent.nakijkenBezig") }),
    ).toBeDisabled();
  });
});

describe("Import screen — failures (Art. II.3)", () => {
  it("shows the server's Dutch reason for a 400, which is the only place it exists", async () => {
    renderImport({
      voorbeeld: new Response(
        JSON.stringify({
          detail: "Alleen .xlsx-bestanden worden ondersteund. Download de importsjabloon en vul die in.",
          status: 400,
          title: "Ongeldige aanvraag",
        }),
        { status: 400 },
      ),
    });

    kiesBestand("themas.csv");
    fireEvent.click(nakijkknop());

    expect(
      await screen.findByText(/Alleen \.xlsx-bestanden worden ondersteund/),
    ).toBeInTheDocument();
  });

  it("falls back to its own copy when a 400 carries no usable body", async () => {
    // A proxy can replace any body, and `GET /api/leerplandoelen` already answers a bare English string
    // somewhere else in this API. Neither may reach a teacher as a sentence.
    renderImport({ voorbeeld: new Response("Bad Request", { status: 400 }) });

    kiesBestand();
    fireEvent.click(nakijkknop());

    expect(
      await screen.findByText(t("import.schoolcontent.foutBestandOnbekend")),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bad Request")).toBeNull();
  });

  it("says the tool is unavailable for a 500, rather than blaming the file", async () => {
    renderImport({ voorbeeld: new Response("boom", { status: 500 }) });

    kiesBestand();
    fireEvent.click(nakijkknop());

    expect(await screen.findByText(t("import.onbeschikbaar"))).toBeInTheDocument();
    // Branching on the status, never on `isError` alone: telling a teacher to check their file for a server
    // fault sends them into a fix they cannot make.
    expect(screen.queryByText(t("import.schoolcontent.foutBestandOnbekend"))).toBeNull();
  });
});

describe("Import screen — accessibility", () => {
  it("passes an axe structure check with a full result on screen", async () => {
    const { container } = { container: document.body };
    renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    await verdicten();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("announces the outcome through a live region that holds no controls", async () => {
    renderImport({ voorbeeld: MET_BEDREIGDE_BESLISSINGEN });

    kiesBestand();
    fireEvent.click(nakijkknop());
    const lijst = await verdicten();

    // The live region wraps the verdicts only. A region around the commit button and the opt-in would
    // re-announce the whole outcome on every interaction, which is why E3-07 restructured `TeHerzien`.
    const regio = lijst.closest('[role="status"]')!;
    expect(regio).not.toBeNull();
    expect(within(regio as HTMLElement).queryByRole("button")).toBeNull();
    expect(within(regio as HTMLElement).queryByRole("checkbox")).toBeNull();
  });
});
