import type { DoelKoppelingWeergave, KoppelingStatus, SubthemaWeergave } from "../../lib/types";

/** An activiteit as a subdoel row names it. */
export interface Drager {
  id: string;
  naam: string;
}

/**
 * Which of a subthema's subdoelen its activiteiten already work out, and what the activiteiten offer besides (FB-010).
 *
 * **Only a decided link counts** (`Aanvaard` or `Manueel`), on either side. It is the rule dekking uses (Art. V.1), and a
 * proposed link on an activiteit is not yet something the class does. A subdoel that is not decided still gets its
 * dragers listed, but it is left out of the "x van y" figure and never marked as a gap: it is not a subdoel yet.
 *
 * **This says nothing about dekking** either, for the reason `themabalans.ts` gives: no plan is known here. It counts
 * which leerplandoelen the subthema's own activiteiten carry, and nothing else. Only this subthema's activiteiten are
 * read, because the subthema holds for its whole leeftijd (Art. IX.2).
 *
 * Derived from the subthema the screen already holds, so it can never disagree with the lists rendered beside it.
 */
export interface Subthemabalans {
  /** Per subdoel id, the activiteiten carrying the same leerplandoel, in the subthema's order. */
  dragersPerSubdoel: ReadonlyMap<string, Drager[]>;
  /** Decided subdoelen: the "y" of "x van y subdoelen in een activiteit". */
  beslisteSubdoelen: number;
  /** Decided subdoelen at least one activiteit carries: the "x". */
  beslistInActiviteit: number;
  /** Leerplandoelen decided on an activiteit that are no subdoel of this subthema, by code. */
  andereDoelen: { koppeling: DoelKoppelingWeergave; dragers: Drager[] }[];
}

/** Whether a link is decided, the only kind that counts here. */
export const beslist = (status: KoppelingStatus) => status === "Aanvaard" || status === "Manueel";

export function subthemabalans(subthema: SubthemaWeergave): Subthemabalans {
  const dragersPerCode = new Map<string, Drager[]>();
  const eersteKoppeling = new Map<string, DoelKoppelingWeergave>();

  for (const activiteit of subthema.activiteiten) {
    for (const koppeling of activiteit.doelkoppelingen) {
      if (!beslist(koppeling.status)) continue;
      const code = koppeling.leerplandoelCode;
      const dragers = dragersPerCode.get(code) ?? [];
      if (!dragers.some((d) => d.id === activiteit.id)) dragers.push({ id: activiteit.id, naam: activiteit.naam });
      dragersPerCode.set(code, dragers);
      if (!eersteKoppeling.has(code)) eersteKoppeling.set(code, koppeling);
    }
  }

  const dragersPerSubdoel = new Map(
    subthema.subdoelen.map((s) => [s.id, dragersPerCode.get(s.koppeling.leerplandoelCode) ?? []]),
  );
  const besliste = subthema.subdoelen.filter((s) => beslist(s.koppeling.status));
  const subdoelCodes = new Set(subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode));

  return {
    dragersPerSubdoel,
    beslisteSubdoelen: besliste.length,
    beslistInActiviteit: besliste.filter((s) => (dragersPerSubdoel.get(s.id)?.length ?? 0) > 0).length,
    andereDoelen: [...eersteKoppeling.entries()]
      .filter(([code]) => !subdoelCodes.has(code))
      .sort(([a], [b]) => a.localeCompare(b, "nl", { numeric: true }))
      .map(([code, koppeling]) => ({ koppeling, dragers: dragersPerCode.get(code) ?? [] })),
  };
}
