import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaatsAlgemeneFiche, useVerplaatsFichemoment, useVerwijderAlgemeneFicheplaatsing } from "./gegevens";

/**
 * What a placement refetches, which is what makes the rest of the app follow it (Art. V.1 as amended).
 *
 * The first placement of a fiche makes its goals count and the last one takes them away again, so placing and
 * removing must refresh dekking, and the fiche list whose count Instellingen reads ("Staat nog niet in de agenda").
 * Moving one occurrence leaves the placement standing, so it must not: that refetch would prove a number that cannot
 * have changed.
 */
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((_pad: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : new Response(
            JSON.stringify({ id: "p-1", algemeneFicheId: "f-1", ficheNaam: "turnen", van: "", tot: "", momenten: [] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function metClient() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const ververs = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const sleutels = () => ververs.mock.calls.map(([filter]) => filter?.queryKey);
  return { wrapper, sleutels };
}

describe("algemene fiches: wat een plaatsing ververst", () => {
  it("ververst na inplannen de plaatsingen, de fichelijst en de dekking", async () => {
    const { wrapper, sleutels } = metClient();
    const { result } = renderHook(() => usePlaatsAlgemeneFiche("k-1"), { wrapper });

    result.current.mutate({
      algemeneFicheId: "f-1",
      van: "2026-09-07",
      tot: "2026-09-30",
      weekdagen: [1],
      begin: "10:30:00",
      einde: "11:20:00",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/klassen/k-1/algemene-ficheplaatsingen");
    expect(init.method).toBe("POST");
    expect(sleutels()).toEqual(
      expect.arrayContaining([["algemene-ficheplaatsingen"], ["algemene-fiches"], ["dekking"]]),
    );
  });

  it("ververst na weghalen hetzelfde, want de laatste periode neemt de doelen weer mee", async () => {
    const { wrapper, sleutels } = metClient();
    const { result } = renderHook(() => useVerwijderAlgemeneFicheplaatsing(), { wrapper });

    result.current.mutate("p-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock.mock.calls[0][0]).toBe("/api/algemene-ficheplaatsingen/p-1");
    expect(sleutels()).toEqual(
      expect.arrayContaining([["algemene-ficheplaatsingen"], ["algemene-fiches"], ["dekking"]]),
    );
  });

  it("ververst na één moment verplaatsen alleen de plaatsingen", async () => {
    const { wrapper, sleutels } = metClient();
    const { result } = renderHook(() => useVerplaatsFichemoment(), { wrapper });

    result.current.mutate({ plaatsingId: "p-1", momentId: "m-1", datum: "2026-09-15", begin: "10:30:00", einde: "11:20:00" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sleutels()).toEqual([["algemene-ficheplaatsingen"]]);
  });
});
