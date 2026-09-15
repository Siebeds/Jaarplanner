import { IcoonHoek } from "../../components/Iconen";
import { periode as periodeTekst } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import type { SubthemaperiodeVerrijkingen } from "../hoeken/gegevens";
import type { Subthemareeks } from "./subthemareeksen";

/**
 * The subthema's running in the days on screen, above the time grid, each with a preview of what the klas's hoeken
 * hold while it runs (owner, 2026-09-15, FB-020: "klik op subthema, vul hoekenverrijking in, zie hoekenverrijking
 * preview in subthemabar op agenda").
 *
 * **One row per run the grid already draws**, from the same `subthemareeksen` the strips in the day headings come from,
 * so the balk cannot name a subthema the grid does not show. A run the agenda drew from its activiteiten alone has no
 * stored window yet; its row opens the same sheet, which says so and stores the window on the first save.
 *
 * **A button, and quiet.** The balk sits above the plan and must not compete with it: card surface, a hairline, the
 * accent only on hover as on every other control in this toolbar. The preview is one line: how many hoeken have a
 * verrijking, then the first one's text, cut where the row ends.
 *
 * **Each branch of the preview says only what it knows.** "Nog geen hoekverrijking" needs a read that succeeded (or a
 * run with no window, which cannot have one); while the read is out, a reader sees the neutral label instead.
 */
export function Subthemabalk({
  reeksen,
  verrijkingen,
  geladen,
  hoeken,
  magPlannen,
  onOpen,
}: {
  /** The runs touching the days on screen, in the order they start. */
  reeksen: readonly Subthemareeks[];
  verrijkingen: readonly SubthemaperiodeVerrijkingen[];
  /** Whether the verrijkingen above come from a read that succeeded. */
  geladen: boolean;
  /** The klas's corners, to name the first one in the preview and to keep their order. */
  hoeken: readonly { id: string; naam: string }[];
  magPlannen: boolean;
  onOpen: (reeks: Subthemareeks) => void;
}) {
  if (reeksen.length === 0) return null;

  return (
    <ul aria-label={t("subthemabalk.label")} className="mb-3 flex flex-wrap gap-2">
      {reeksen.map((reeks) => {
        const periode = reeks.periodeId
          ? verrijkingen.find((p) => p.subthemaperiodeId === reeks.periodeId)
          : undefined;
        // In the klas's own order of corners, so the preview names the same hoek the sheet lists first.
        const gevuld = hoeken.flatMap((hoek) => {
          const verrijking = periode?.verrijkingen.find((v) => v.hoekId === hoek.id);
          return verrijking ? [{ naam: hoek.naam, tekst: verrijking.tekst }] : [];
        });
        const zeker = geladen || reeks.periodeId === undefined;

        return (
          <li key={`${reeks.subthemaId}-${reeks.van}`} className="w-full sm:w-72">
            <button
              type="button"
              onClick={() => onOpen(reeks)}
              className="flex w-full flex-col gap-0.5 rounded-veld border border-lijn bg-kaart px-3 py-2 text-left transition-colors duration-150 hover:border-accent"
            >
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-meta font-medium text-inkt">{reeks.subthemaNaam}</span>
                <span className="text-micro text-inkt-zwak">{periodeTekst(reeks.van, reeks.tot)}</span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-micro text-inkt-zacht">
                <IcoonHoek aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {gevuld.length > 0 ? (
                  <>
                    <span className="shrink-0">
                      {telWoord(gevuld.length, "subthemabalk.verrijktEen", "subthemabalk.verrijktAantal")}
                    </span>
                    <span className="min-w-0 truncate text-inkt">
                      {gevuld[0].naam}: {gevuld[0].tekst}
                    </span>
                  </>
                ) : magPlannen ? (
                  <span>{t("subthemabalk.invullen")}</span>
                ) : zeker ? (
                  <span>{t("subthemabalk.geen")}</span>
                ) : (
                  <span>{t("subthemabalk.bekijken")}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
