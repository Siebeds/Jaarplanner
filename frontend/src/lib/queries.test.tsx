import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThemasVoorKlas } from "./queries";

/**
 * `useThemasVoorKlas` hands back the same `themas` array while the data stays the same (TB-071). The subthemaplanner
 * memoises its subthema's, choice, activiteiten and voorstellen on it, and a `SortableContext` takes its items from
 * it: a new array on every render recomputed all of that on every keystroke.
 */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string) =>
      Promise.resolve(
        new Response(JSON.stringify({ id: pad.split("/")[3], naam: "herfst" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function metClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useThemasVoorKlas", () => {
  it("geeft dezelfde lijst terug zolang de thema's niet veranderen", async () => {
    const { result, rerender } = renderHook(({ ids }) => useThemasVoorKlas(ids, "k-1"), {
      wrapper: metClient(),
      initialProps: { ids: ["t-1", "t-2"] },
    });
    await waitFor(() => expect(result.current.laadt).toBe(false));
    expect(result.current.themas).toHaveLength(2);

    const eerst = result.current.themas;
    // A new id array with the same ids, as a caller that derives it during render passes on every render.
    rerender({ ids: ["t-1", "t-2"] });
    expect(result.current.themas).toBe(eerst);
  });
});
