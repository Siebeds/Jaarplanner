import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { OngekoppeldeDoelenLijst } from "./OngekoppeldeDoelenLijst";
import { useWijzigSuggestieStatus } from "./useDoelsuggesties";
import type { OngekoppeldDoel } from "./types";

/**
 * Pins the E2-06 "ongekoppelde doelen" view (FR-4.4, Art. V): the leerplandoelen not (yet) linked to any
 * thema render with their code + doelsoort badge, and — the load-bearing behaviour — the list updates as
 * links change. The API is faked at the fetch boundary with a mutable server-side set, so a status change
 * (accept) followed by the query's invalidation refetches a shorter list. That proves the list is driven
 * by the server (the source of truth for coverage), not local state.
 */

const DOEL_A: OngekoppeldDoel = {
  code: "NAT-K3-01",
  doelsoort: "Minimumdoel",
  jaarFase: "K3",
  domein: "Natuur",
  subdomein: "Levend",
  tekst: "De kleuter observeert planten in de omgeving.",
};
const DOEL_B: OngekoppeldDoel = {
  code: "NAT-K3-02",
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  domein: "Natuur",
  subdomein: "Levend",
  tekst: "De kleuter benoemt de seizoenen.",
};

/** A fetch fake with a mutable server-side gap list; a PUT (accept) drops NAT-K3-01 from it. */
function maakFetchFake() {
  let ongekoppeld: OngekoppeldDoel[] = [DOEL_A, DOEL_B];

  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") {
      // A teacher accepts the suggestion for NAT-K3-01 — the server now links it, so it leaves the gap list.
      ongekoppeld = ongekoppeld.filter((d) => d.code !== "NAT-K3-01");
      return new Response(
        JSON.stringify({ id: "s1", leerplandoelCode: "NAT-K3-01", status: "Aanvaard", aiMotivatie: null }),
        { status: 200 },
      );
    }
    if (url.includes("/ongekoppeld")) {
      return new Response(JSON.stringify(ongekoppeld), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  });

  return { fetchFake };
}

function renderLijst() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OngekoppeldeDoelenLijst />
    </QueryClientProvider>,
  );
}

/** Renders the gap list alongside the accept mutation so the invalidation → refetch cycle is exercised. */
function Harness() {
  const wijzig = useWijzigSuggestieStatus("thema-1");
  return (
    <div>
      <button
        type="button"
        onClick={() => wijzig.mutate({ suggestieId: "s1", status: "Aanvaard" })}
      >
        accepteer
      </button>
      <OngekoppeldeDoelenLijst />
    </div>
  );
}

beforeEach(() => {
  const fake = maakFetchFake();
  vi.stubGlobal("fetch", fake.fetchFake);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OngekoppeldeDoelenLijst", () => {
  it("shows the ongekoppelde doelen with code, doelsoort and text", async () => {
    renderLijst();

    expect(await screen.findByText("NAT-K3-01")).toBeInTheDocument();
    expect(screen.getByText("NAT-K3-02")).toBeInTheDocument();
    expect(
      screen.getByText(/De kleuter observeert planten/),
    ).toBeInTheDocument();
    // Colour is never the sole signal — the doelsoort badge carries its abbreviation.
    expect(screen.getByText(t("doelsoortAfkorting.md"))).toBeInTheDocument();
  });

  it("shows the empty state when everything is linked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    renderLijst();

    expect(await screen.findByText(t("ongekoppeld.leeg"))).toBeInTheDocument();
  });

  it("updates as links change: accepting a suggestion removes its doel from the list", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    // Both doelen are initially ongekoppeld.
    expect(await screen.findByText("NAT-K3-01")).toBeInTheDocument();
    expect(screen.getByText("NAT-K3-02")).toBeInTheDocument();

    // Accept the suggestion for NAT-K3-01; the mutation invalidates the gap-list query.
    screen.getByRole("button", { name: "accepteer" }).click();

    // The now-linked doel disappears; the other remains — driven by the server, via refetch.
    await waitFor(() => {
      expect(screen.queryByText("NAT-K3-01")).not.toBeInTheDocument();
    });
    expect(screen.getByText("NAT-K3-02")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderLijst();
    await screen.findByText("NAT-K3-01");
    await waitFor(async () => {
      const list = within(container).getByRole("list");
      expect(await axe(list)).toHaveNoViolations();
    });
  });
});
