/** The order codes and refs are read in: 1.2, 1.10, not 1.10, 1.2. */
export function opCode(a: string, b: string): number {
  return a.localeCompare(b, "nl", { numeric: true });
}

/**
 * Minimumdoelen in the order of their mijlpaal, then of their ref: `K-1.1.3` (end of kleuter) before `2-…` and `4-…`.
 * The ref's prefix is the mijlpaal, and a plain comparison would put every lager one before the kleuter ones.
 */
export function opMinimumdoelRef(a: string, b: string): number {
  return mijlpaalRang(a) - mijlpaalRang(b) || opCode(a, b);
}

function mijlpaalRang(ref: string): number {
  const voorvoegsel = ref.split("-")[0] ?? "";
  if (voorvoegsel.toUpperCase() === "K") return 0;
  const leerjaar = Number(voorvoegsel);
  return Number.isFinite(leerjaar) && voorvoegsel !== "" ? leerjaar : Number.MAX_SAFE_INTEGER;
}
