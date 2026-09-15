import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActieveSelectie, type Klassenbron } from "./selectie";

/**
 * When `useActieveSelectie` says a list failed to load (FB-001, antagonist rounds 2 and 3), over a real query client:
 * every screen test mocks the hook away, so this is the one place its `fout` is derived for real.
 *
 * A first load that fails leaves a list with no data, and an empty list then proves nothing: that is `fout`. A refetch
 * that fails keeps the loaded data, which is still usable: that is not.
 */

const JAAR = { id: "jaar-1", naam: "2026-2027", start: "2026-09-01", eind: "2027-06-30" };
const KLAS = {
  id: "k3-blauw",
  schooljaarId: JAAR.id,
  naam: "K3 blauw",
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: ["K3"],
  jaarfase: "K3",
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: true,
};

function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

/** Which of the two routes answer 500 right now; a test flips them between loads. */
const faalt = { schooljaren: false, klassen: false };

function gebruik(bron?: Klassenbron) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useActieveSelectie(bron), { wrapper }) };
}

beforeEach(() => {
  faalt.schooljaren = false;
  faalt.klassen = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (invoer: string) => {
      const pad = String(invoer);
      if (pad.endsWith("/api/schooljaren")) return faalt.schooljaren ? json({}, 500) : json([JAAR]);
      if (pad.endsWith("/api/klassen")) return faalt.klassen ? json({}, 500) : json([KLAS]);
      if (pad.endsWith("/api/rapportklassen")) return json([{ ...KLAS, id: "k3-groen", naam: "K3 groen" }]);
      return json({}, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useActieveSelectie, fout", () => {
  it("is er niet als beide lijsten laden", async () => {
    const { result } = gebruik();

    await waitFor(() => expect(result.current.laadt).toBe(false));
    expect(result.current.fout).toBe(false);
    expect(result.current.schooljaren).toHaveLength(1);
    expect(result.current.klassen).toHaveLength(1);
  });

  it("is er als de schooljaren de eerste keer niet laden", async () => {
    faalt.schooljaren = true;
    const { result } = gebruik();

    await waitFor(() => expect(result.current.fout).toBe(true));
    expect(result.current.laadt).toBe(false);
    expect(result.current.schooljaren).toHaveLength(0);
  });

  it("is er als de klassen de eerste keer niet laden", async () => {
    faalt.klassen = true;
    const { result } = gebruik();

    await waitFor(() => expect(result.current.fout).toBe(true));
    expect(result.current.klassen).toHaveLength(0);
  });

  it("is er niet als een herlading mislukt terwijl de lijsten al geladen zijn", async () => {
    const { client, result } = gebruik();
    await waitFor(() => expect(result.current.klassen).toHaveLength(1));

    faalt.schooljaren = true;
    faalt.klassen = true;
    await client.refetchQueries();
    // The refetch has failed: the query says so, and keeps its data.
    await waitFor(() => expect(client.getQueryState(["klassen"])?.status).toBe("error"));

    expect(result.current.fout).toBe(false);
    expect(result.current.schooljaren).toHaveLength(1);
    expect(result.current.klassen).toHaveLength(1);
  });
});

describe("useActieveSelectie, de klassen van het rapport (FB-008)", () => {
  it("kiest uit de rapportklassen en vraagt de klassen van de planning niet op", async () => {
    const { result } = gebruik("rapport");

    await waitFor(() => expect(result.current.laadt).toBe(false));
    expect(result.current.klassen.map((klas) => klas.id)).toEqual(["k3-groen"]);
    expect(result.current.klasId).toBe("k3-groen");
    const gevraagd = vi.mocked(fetch).mock.calls.map(([pad]) => String(pad));
    expect(gevraagd.some((pad) => pad.endsWith("/api/rapportklassen"))).toBe(true);
    expect(gevraagd.some((pad) => pad.endsWith("/api/klassen"))).toBe(false);
  });

  it("kiest zonder bron uit de klassen van de planning, zoals voorheen", async () => {
    const { result } = gebruik();

    await waitFor(() => expect(result.current.laadt).toBe(false));
    expect(result.current.klassen.map((klas) => klas.id)).toEqual(["k3-blauw"]);
    expect(vi.mocked(fetch).mock.calls.some(([pad]) => String(pad).endsWith("/api/rapportklassen"))).toBe(false);
  });
});
