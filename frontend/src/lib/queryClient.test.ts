import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { maakQueryClient } from "./queryClient";

/**
 * A refused write refetches what is on screen (E6-02 slice 4), so a control that went stale because rights or the
 * resource changed while the page was open goes away. Any other failure leaves the cache alone.
 */
async function faal(fout: unknown) {
  const client = maakQueryClient();
  const ververs = vi.spyOn(client, "invalidateQueries");
  const mutatie = client.getMutationCache().build(client, { mutationFn: () => Promise.reject(fout) });
  await mutatie.execute(undefined).catch(() => {});
  return ververs;
}

describe("de query client", () => {
  it("haalt alles opnieuw op na een 403, de rechten van /api/ik inbegrepen", async () => {
    const ververs = await faal(new ApiError(403, "geweigerd", "Je hebt geen toegang tot deze actie."));
    expect(ververs).toHaveBeenCalledWith();
  });

  it("laat de cache met rust na een andere fout", async () => {
    expect(await faal(new ApiError(400, "ongeldig"))).not.toHaveBeenCalled();
    expect(await faal(new Error("netwerk"))).not.toHaveBeenCalled();
  });
});
