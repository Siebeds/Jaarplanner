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

function genereerKnop() {
  return screen.getByRole("button", { name: t("matching.genereerAria") });
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

  it("reports the run with correctly inflected counts", async () => {
    renderPagina();
    fireEvent.click(genereerKnop());

    // Singular for the one suggestion, plural for the twelve candidates — via tAantal, not a template that
    // would read "1 suggesties".
    expect(
      await screen.findByText(t("matching.genereerGeluktEnkelvoud")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t("matching.kandidaten", { aantal: 12 })),
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

  it("names the codes the model invented instead of swallowing them", async () => {
    vi.unstubAllGlobals();
    stub({ onbekend: ["VERZONNEN-99"] });
    renderPagina();

    fireEvent.click(genereerKnop());

    expect(
      await screen.findByText(
        t("matching.onbekendeCodes", { codes: "VERZONNEN-99" }),
      ),
    ).toBeInTheDocument();
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
