import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { DoelsuggestieLijst } from "./DoelsuggestieLijst";
import type { Doelsuggestie } from "./types";

/**
 * Pins the E2-05 accept/reject/adjust review UI (FR-4.3, Art. IV.1/IV.3): the suggestion + its
 * motivation render, and a teacher decision sends the right PUT and reflects the persisted status.
 * The API is faked at the fetch boundary so the test needs no backend — the mutation → refetch cycle
 * is what proves the status change is driven by the server (the source of truth for coverage, E5).
 */

const THEMA_ID = "11111111-1111-1111-1111-111111111111";
const SUGGESTIE_ID = "22222222-2222-2222-2222-222222222222";

/** A fetch fake with a mutable server-side status, so the refetch after a PUT sees the new value. */
function maakFetchFake() {
  const suggestie: Doelsuggestie = {
    id: SUGGESTIE_ID,
    leerplandoelCode: "NAT-K3-01",
    status: "Voorgesteld",
    aiMotivatie: "past bij het observeren van bomen",
  };
  const putBodies: unknown[] = [];

  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { status: Doelsuggestie["status"] };
      putBodies.push({ url, status: body.status });
      suggestie.status = body.status;
      return new Response(JSON.stringify(suggestie), { status: 200 });
    }
    // GET: list for the thema.
    return new Response(JSON.stringify([suggestie]), { status: 200 });
  });

  return { fetchFake, putBodies };
}

function renderLijst() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DoelsuggestieLijst themaId={THEMA_ID} />
    </QueryClientProvider>,
  );
}

let putBodies: unknown[];

beforeEach(() => {
  const fake = maakFetchFake();
  putBodies = fake.putBodies;
  vi.stubGlobal("fetch", fake.fetchFake);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DoelsuggestieLijst", () => {
  it("shows the suggestion with its code, motivation and status", async () => {
    renderLijst();

    expect(await screen.findByText("NAT-K3-01")).toBeInTheDocument();
    expect(
      screen.getByText(/past bij het observeren van bomen/),
    ).toBeInTheDocument();
    // Colour is never the sole signal — the status label is present as text.
    expect(
      screen.getByText(t("suggestieStatus.voorgesteld")),
    ).toBeInTheDocument();
  });

  it("accepts a suggestion: sends the right PUT and reflects the persisted status", async () => {
    renderLijst();

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.aanvaardenAria", { code: "NAT-K3-01" }),
      }),
    );

    // The persisted status comes back via refetch and replaces the badge.
    expect(
      await screen.findByText(t("suggestieStatus.aanvaard")),
    ).toBeInTheDocument();
    expect(putBodies).toEqual([
      {
        url: `/api/themas/${THEMA_ID}/doelsuggesties/${SUGGESTIE_ID}/status`,
        status: "Aanvaard",
      },
    ]);
  });

  it("rejects a suggestion with the geweigerd status", async () => {
    renderLijst();

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.weigerenAria", { code: "NAT-K3-01" }),
      }),
    );

    expect(
      await screen.findByText(t("suggestieStatus.geweigerd")),
    ).toBeInTheDocument();
    expect(putBodies).toEqual([expect.objectContaining({ status: "Geweigerd" })]);
  });

  it("adjusts (manueel) a suggestion", async () => {
    renderLijst();

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.manueelAria", { code: "NAT-K3-01" }),
      }),
    );

    expect(
      await screen.findByText(t("suggestieStatus.manueel")),
    ).toBeInTheDocument();
    expect(putBodies).toEqual([expect.objectContaining({ status: "Manueel" })]);
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
