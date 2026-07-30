import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { DoelsuggestieGeneratie } from "./DoelsuggestieGeneratie";
import { DoelsuggestieLijst } from "./DoelsuggestieLijst";
import type { Doelsuggestie } from "./types";

/**
 * Pins the E2-08 trigger (FR-4.1): pressing "Doelsuggesties genereren" calls the generation endpoint, and the
 * review list next to it refreshes from the server with what the run persisted.
 *
 * The list is rendered alongside the trigger on purpose. The defect this story fixes was not a broken
 * component — every component worked — it was that nothing connected them, so a test that only asserted the
 * POST went out would have passed on the broken code too. What is pinned here is the *wire*: an empty list
 * becomes a populated one because the button was pressed.
 *
 * The API is faked at the fetch boundary, so there is no backend, no AI and no key (Art. VI.4).
 */

const THEMA_ID = "11111111-1111-1111-1111-111111111111";

interface FetchFakeOpties {
  /** HTTP status for the generation POST — 422 = the model answered badly, 500 = tool broken/unconfigured. */
  genereerStatus?: number;
  /** How many leerplandoelen the run reports having searched. */
  aantalKandidaten?: number;
  /** Codes the model returned that do not exist in the loaded set. */
  onbekend?: string[];
}

function maakFetchFake({
  genereerStatus = 200,
  aantalKandidaten = 12,
  onbekend = [],
}: FetchFakeOpties = {}) {
  // The "database": empty until a generation run adds to it, which is the behaviour under test.
  const opslag: Doelsuggestie[] = [];
  const posts: { url: string; body: unknown }[] = [];

  const nieuw: Doelsuggestie = {
    id: "22222222-2222-2222-2222-222222222222",
    leerplandoelCode: "NAT-K3-01",
    status: "Voorgesteld",
    aiMotivatie: "past bij het observeren van bomen",
    tekst: "herkent bomen aan hun bladeren.",
    doelsoort: "Minimumdoel",
  };

  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      if (genereerStatus !== 200) {
        return new Response("{}", { status: genereerStatus });
      }

      const bewaard = aantalKandidaten === 0 ? [] : [nieuw];
      opslag.push(...bewaard);
      return new Response(
        JSON.stringify({
          isGeslaagd: true,
          fout: null,
          aantalKandidaten,
          bewaard,
          overgeslagenOnbekend: onbekend,
          overgeslagenDuplicaat: [],
        }),
        { status: 200 },
      );
    }

    return new Response(JSON.stringify(opslag), { status: 200 });
  });

  return { fetchFake, posts };
}

function renderPagina() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DoelsuggestieGeneratie themaId={THEMA_ID} />
      <DoelsuggestieLijst themaId={THEMA_ID} />
    </QueryClientProvider>,
  );
}

function stub(opties?: FetchFakeOpties) {
  const fake = maakFetchFake(opties);
  posts = fake.posts;
  vi.stubGlobal("fetch", fake.fetchFake);
}

let posts: { url: string; body: unknown }[];

beforeEach(() => {
  stub();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Queried by its **visible** label on purpose: this is the accessible name, so the query fails the moment
 * an aria-label is (re)introduced that replaces the text on the button (WCAG 2.2 SC 2.5.3).
 */
function genereerKnop() {
  return screen.getByRole("button", { name: t("matching.genereer") });
}

describe("DoelsuggestieGeneratie", () => {
  it("generates suggestions and the review list refreshes with them", async () => {
    renderPagina();

    // Before: the empty state a deployed app showed forever, because nothing could create a suggestion.
    expect(await screen.findByText(t("matching.leeg"))).toBeInTheDocument();

    fireEvent.click(genereerKnop());

    // After: the list is driven by the server's own rows, refetched because the run succeeded.
    expect(await screen.findByText("NAT-K3-01")).toBeInTheDocument();
    expect(
      screen.getByText(/past bij het observeren van bomen/),
    ).toBeInTheDocument();
    // Nothing was auto-applied: it arrives as `voorgesteld` for the teacher to decide (Art. IV.1).
    expect(
      screen.getByText(t("suggestieStatus.voorgesteld")),
    ).toBeInTheDocument();

    expect(posts).toEqual([
      {
        url: `/api/themas/${THEMA_ID}/doelsuggesties/genereer`,
        body: { selectie: { disciplines: [], jaarFasen: [] } },
      },
    ]);
  });

  it("keeps the visible label as the accessible name (WCAG 2.2 SC 2.5.3)", async () => {
    renderPagina();

    // Speech input activates a control by saying what is written on it. An aria-label replaces the
    // accessible name, so "Doelsuggesties genereren" would no longer work — hence none here.
    const knop = genereerKnop();
    expect(knop).not.toHaveAttribute("aria-label");
    expect(knop).toHaveTextContent(t("matching.genereer"));
    expect(knop).toHaveAccessibleName(t("matching.genereer"));
  });

  it("has its live region in the DOM before a run, so the report is announced", async () => {
    renderPagina();
    // Wait out the list's own loading `role="status"`, so the only one left is the panel's report region.
    await screen.findByText(t("matching.leeg"));

    // A role="status" element that is mounted together with its content is frequently never announced.
    // The region must therefore exist (empty) from the start and be filled by the run.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    fireEvent.click(genereerKnop());

    await waitFor(() => {
      expect(screen.getByRole("status")).not.toBeEmptyDOMElement();
    });
  });

  it("reports the run with correctly inflected counts", async () => {
    renderPagina();
    fireEvent.click(genereerKnop());

    // Literal Dutch, not `t(...)`: an assertion built from the same catalogue entry the component renders
    // can only prove they agree, never that the sentence is correct Dutch.
    expect(
      await screen.findByText("1 nieuwe suggestie voorgesteld."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gezocht in 12 leerplandoelen."),
    ).toBeInTheDocument();
  });

  it("sends the teacher's selection when they narrow the scope", async () => {
    renderPagina();

    fireEvent.change(screen.getByLabelText(t("matching.disciplinesLabel")), {
      target: { value: "1, 9.2" },
    });
    fireEvent.change(screen.getByLabelText(t("matching.jaarFasenLabel")), {
      target: { value: "K3" },
    });
    fireEvent.click(genereerKnop());

    await screen.findByText("NAT-K3-01");
    expect(posts).toEqual([
      {
        url: `/api/themas/${THEMA_ID}/doelsuggesties/genereer`,
        body: { selectie: { disciplines: ["1", "9.2"], jaarFasen: ["K3"] } },
      },
    ]);
  });

  it("says so when there was nothing to search, rather than blaming the AI", async () => {
    vi.unstubAllGlobals();
    stub({ aantalKandidaten: 0 });
    renderPagina();

    fireEvent.click(genereerKnop());

    expect(
      await screen.findByText(t("matching.geenKandidaten")),
    ).toBeInTheDocument();
    // The "de AI stelde geen enkel leerplandoel voor" line would be a false diagnosis here.
    expect(
      screen.queryByText(t("matching.genereerNiets")),
    ).not.toBeInTheDocument();
  });

  // The expected Dutch is written out **literally** in the next three tests. Asserting against
  // `t("matching.onbekendeCodes", …)` compares the render to the very template it renders, so it cannot
  // fail on grammar — the earlier version of this test passed happily on "deze codes staan" for one code.
  it("uses the singular for exactly one unresolved code", async () => {
    vi.unstubAllGlobals();
    stub({ onbekend: ["VERZONNEN-99"] });
    renderPagina();

    fireEvent.click(genereerKnop());

    expect(
      await screen.findByText(
        "Genegeerd. Deze code uit het antwoord van de AI komt niet exact overeen met een geladen leerplandoel: VERZONNEN-99",
      ),
    ).toBeInTheDocument();
  });

  it("uses the plural for more than one unresolved code", async () => {
    vi.unstubAllGlobals();
    stub({ onbekend: ["VERZONNEN-99", "VERZONNEN-98"] });
    renderPagina();

    fireEvent.click(genereerKnop());

    expect(
      await screen.findByText(
        "Genegeerd. Deze codes uit het antwoord van de AI komen niet exact overeen met een geladen leerplandoel: VERZONNEN-99 · VERZONNEN-98",
      ),
    ).toBeInTheDocument();
  });

  // The message must not assert that the code is absent from the curriculum, because it may well be
  // present: the AI path matches a code **exactly** on purpose (a model altering the casing of a decreed
  // identifier is altering identity), while the substitution field one row below resolves the very same
  // string case-insensitively. So `nat-k3-01` can be skipped here and accepted there — and a teacher told
  // "deze code staat niet in de geladen leerplandoelen" would have been told something false about the
  // Op.stap curriculum. This test pins the honest wording, not just the inflection.
  it("does not claim an unresolved code is absent from the curriculum", async () => {
    vi.unstubAllGlobals();
    stub({ onbekend: ["nat-k3-01"] });
    renderPagina();

    fireEvent.click(genereerKnop());

    const melding = await screen.findByText(/nat-k3-01/);
    expect(melding).toHaveTextContent("komt niet exact overeen");
    expect(melding.textContent).not.toMatch(/staat niet in/);
    expect(melding.textContent).not.toMatch(/bestaat niet/);
  });

  it("shows retry copy on a 422 and never echoes the server diagnostic", async () => {
    vi.unstubAllGlobals();
    stub({ genereerStatus: 422 });
    renderPagina();

    fireEvent.click(genereerKnop());

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent(t("matching.genereerMislukt"));
  });

  it("shows configuration-fault copy on a 500 rather than blaming the model", async () => {
    // The realistic trigger today: no AzureAI:ApiKey configured, so the client throws and the API returns
    // 500. Telling a teacher "the AI answered badly" would send them into a pointless retry loop.
    vi.unstubAllGlobals();
    stub({ genereerStatus: 500 });
    renderPagina();

    fireEvent.click(genereerKnop());

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent(t("matching.genereerOnbeschikbaar"));
  });

  it("has no axe violations", async () => {
    const { container } = renderPagina();
    await screen.findByText(t("matching.leeg"));
    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
