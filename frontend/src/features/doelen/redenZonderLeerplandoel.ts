import type { ZonderLeerplandoelReden } from "../../lib/types";
import { t, type Vertaalsleutel } from "../../i18n";

/** KOV's goal-set marks as Dutch plural nouns, for the reason sentence. An unknown mark is named as a mark. */
const DOELSET_NAAM: Record<string, Vertaalsleutel> = {
  Z: "doelen.doelsetZ",
  V: "doelen.doelsetV",
  P: "doelen.doelsetP",
  S: "doelen.doelsetS",
  "+": "doelen.doelsetPlus",
  A: "doelen.doelsetA",
};

const OPSOMMING = new Intl.ListFormat("nl", { type: "conjunction" });

/**
 * Why no loaded leerplandoel refers to a minimumdoel, as the import derived it (owner ruling 2026-09-13), or null.
 * Each sentence says what its reason proves about the applied snapshot and nothing about coverage (the E5-03 rule);
 * no reason, or a reason that names no set, says nothing at all.
 */
export function redenZonderLeerplandoel(minimumdoel: {
  zonderLeerplandoelReden: ZonderLeerplandoelReden | null;
  zonderLeerplandoelDoelsets: string[];
}): string | null {
  switch (minimumdoel.zonderLeerplandoelReden) {
    case "AlleenOvergeslagenDoelsets": {
      if (minimumdoel.zonderLeerplandoelDoelsets.length === 0) return null;
      const namen = minimumdoel.zonderLeerplandoelDoelsets.map((set) =>
        DOELSET_NAAM[set] ? t(DOELSET_NAAM[set]) : t("doelen.doelsetOnbekend", { doelset: set }),
      );
      return t("doelen.redenDoelsets", { doelsets: OPSOMMING.format(namen) });
    }
    case "GeenDoelInOpstap":
      return t("doelen.redenGeenDoel");
    case "DoelNietIngelezen":
      return t("doelen.redenNietIngelezen");
    default:
      return null;
  }
}
