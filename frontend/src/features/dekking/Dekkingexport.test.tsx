import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { t } from "../../i18n";
import { KLAS_ID, SCHOOLJAAR_ID, dekking, maakDekkingFetchFake } from "./testdata";
import type { FakeOpties } from "./testdata";

/**
 * Pins the coverage export link (E5-06, FR-9.5, FR-11.2) against the **real** `App`, so the route, the URL as the
 * source of truth (ADR-0021) and the real `nl.json` copy are under test.
 *
 * **The assertion that carries the owner ruling is the negative one.** The ruling of 2026-08-06 is that the export is
 * always the full set in scope: `bereik` and `jaarFase` travel because they decide what the figures mean, while the
 * doelsoort filter and the gaps-only toggle do not. On the server that is enforced by an absence (there is no query
 * parameter for them), and the browser half is enforced by the same absence in the URL this link builds. An absence
 * is exactly what a later story re-adds without noticing, so it is asserted here with the screen genuinely filtered
 * rather than in its default state, where the two behaviours are indistinguishable.
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

const MET_KLAS = `/dekking?schooljaar=${SCHOOLJAAR_ID}&klas=${KLAS_ID}`;

/** The download link, once the answer has arrived. */
function exportlink() {
  return screen.getByRole("link", { name: t("dekking.export") });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("Dekkingsexport — de downloadlink (FR-9.5)", () => {
  it("wijst naar de export van deze klas en draagt het bereik mee", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    await waitFor(() => expect(exportlink()).toBeInTheDocument());

    const href = exportlink().getAttribute("href") ?? "";

    expect(href).toContain(`/api/klassen/${KLAS_ID}/dekking/export`);
    // The scope is part of what the document's figures MEAN, so a link that dropped it would hand a teacher a file
    // built over a different denominator from the screen that offered it.
    expect(href).toContain("bereik=EigenJaarFase");
  });

  it("draagt de gekozen jaar/fase mee, want die bepaalt de noemer", async () => {
    // Keyed on `perJaarFase`, because the fake answers the narrowing server-side: a fixture that ignored the
    // parameter would be satisfied by a screen that narrowed in the browser and left the denominator alone.
    renderApp(`${MET_KLAS}&jaarFase=K3`, { perJaarFase: { K3: dekking() } });

    await waitFor(() => expect(exportlink()).toBeInTheDocument());

    expect(exportlink().getAttribute("href")).toContain("jaarFase=K3");
  });

  it("laat de doelsoortfilter en de alleen-ontbrekende-schakelaar er BUITEN", async () => {
    // The screen is genuinely narrowed here, in both ways at once. In the default state a link that honoured the
    // filters and one that ignores them produce the same URL, so this is the only state where the ruling is
    // observable at all.
    renderApp(`${MET_KLAS}&doelsoort=Minimumdoel&ontbrekend=1`, {
      perBereik: { EigenJaarFase: dekking() },
    });

    await waitFor(() => expect(exportlink()).toBeInTheDocument());

    const href = exportlink().getAttribute("href") ?? "";

    expect(href).not.toContain("doelsoort");
    expect(href).not.toContain("ontbrekend");
  });

  it("zegt zelf dat je alles krijgt, ongeacht wat er op het scherm gefilterd staat", async () => {
    // Unconditional copy, deliberately: rendered only when something is filtered out, the sentence would be false in
    // a reachable state (a scope holding exactly one doelsoort, filtered to that doelsoort, hides nothing). So it is
    // asserted in the UNFILTERED state, which is the one a conditional version would not have covered.
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    await waitFor(() => expect(exportlink()).toBeInTheDocument());

    expect(screen.getByText(t("dekking.exportUitleg"))).toBeInTheDocument();
  });

  it("is een echte downloadlink en geen knop", async () => {
    // A download is a navigation: an anchor keeps the browser's own progress, cancel, "link opslaan als" and
    // middle-click. The import sjabloon is the precedent (FR-1.5).
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() } });

    await waitFor(() => expect(exportlink()).toBeInTheDocument());

    expect(exportlink().tagName).toBe("A");
    expect(exportlink()).toHaveAttribute("download");
  });

  it("staat er niet zonder gekozen klas", async () => {
    // Nothing to export, and a link that 404s is a control that does not do what it says (the E3-06 rule).
    renderApp("/dekking", { perBereik: { EigenJaarFase: dekking() } });

    await waitFor(() => expect(screen.getByText(t("dekking.kiesKlas"))).toBeInTheDocument());

    expect(screen.queryByRole("link", { name: t("dekking.export") })).not.toBeInTheDocument();
  });

  it("staat er ook niet als de dekking niet berekend kon worden", async () => {
    renderApp(MET_KLAS, { perBereik: { EigenJaarFase: dekking() }, status: 500 });

    await waitFor(() => expect(screen.getByText(t("dekking.fout"))).toBeInTheDocument());

    expect(screen.queryByRole("link", { name: t("dekking.export") })).not.toBeInTheDocument();
  });
});
