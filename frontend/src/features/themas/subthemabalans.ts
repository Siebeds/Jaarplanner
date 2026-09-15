import type { DoelKoppelingWeergave, KoppelingStatus, SubthemaWeergave } from "../../lib/types";

/** An activiteit as a subdoel row names it. */
export interface Drager {
  id: string;
  naam: string;
}

/**
 * Which of a subthema's subdoelen its activiteiten already work out, and what the activiteiten offer besides (FB-010).
 *
 * **On the activiteit side only a decided link counts** (`Aanvaard` or `Manueel`): it is the rule dekking uses
 * (Art. V.1), and a proposed link on an activiteit is not yet something the class does.
 *
 * **Every subdoel the chapter lists counts in the figure**, whatever its status, so "x van y subdoelen" counts the same
 * rows the chapter shows under one heading. Only the "Nog geen activiteit" mark is kept for a decided subdoel (see
 * `beslist`): an undecided one is not yet a subdoel to work out. Today every subdoel is created `Manueel`, so the two
 * readings agree; they must still never disagree on screen.
 *
 * **This says nothing about dekking** either, for the reason `themabalans.ts` gives: no plan is known here. It counts
 * which leerplandoelen the subthema's own activiteiten carry, and nothing else. Only this subthema's shared activiteiten
 * are read, because the subthema holds for its whole leeftijd (Art. IX.2). If personal activiteiten (FB-015) ever arrive
 * in the same array, this is the place that decides whether they count; the ticket's default is that they do not.
 *
 * Derived from the subthema the screen already holds, so it can never disagree with the lists rendered beside it.
 */
export interface Subthemabalans {
  /** Per subdoel id, the activiteiten carrying the same leerplandoel, in the subthema's order. */
  dragersPerSubdoel: ReadonlyMap<string, Drager[]>;
  /** Subdoelen at least one activiteit carries: the "x" of "x van y subdoelen in een activiteit". */
  subdoelenInActiviteit: number;
  /** Leerplandoelen decided on an activiteit that are no subdoel of this subthema, by code. */
  andereDoelen: { koppeling: DoelKoppelingWeergave; dragers: Drager[] }[];
}

/** Whether a link is decided, the only kind of activiteit link that counts here. */
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
  const subdoelCodes = new Set(subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode));

  return {
    dragersPerSubdoel,
    subdoelenInActiviteit: subthema.subdoelen.filter((s) => (dragersPerSubdoel.get(s.id)?.length ?? 0) > 0).length,
    andereDoelen: [...eersteKoppeling.entries()]
      .filter(([code]) => !subdoelCodes.has(code))
      .sort(([a], [b]) => a.localeCompare(b, "nl", { numeric: true }))
      .map(([code, koppeling]) => ({ koppeling, dragers: dragersPerCode.get(code) ?? [] })),
  };
}
