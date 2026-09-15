import { Link } from "react-router-dom";
import { IcoonHoek, IcoonThemas } from "../../components/Iconen";
import { periode as periodeTekst } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import type { SubthemaperiodeVerrijkingen } from "../hoeken/gegevens";
import { themapaginaPad } from "../themas/themapagina";
import type { Subthemareeks } from "./subthemareeksen";

type Thema = { id: string; naam: string };

/**
 * The subthema's running in the days on screen, above the grid, each with a preview of what the klas's hoeken hold
 * while it runs (owner, 2026-09-15, FB-020: "klik op subthema, vul hoekenverrijking in, zie hoekenverrijking preview in
 * subthemabar op agenda").
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
 *
 * **It is also the keyboard's way to the themapagina** (FB-037, ADR-0042). The strips in the grid take a pointer there,
 * but they are `aria-hidden`, out of the tab order and 16 pixels tall, which they may only be because a control that
 * meets the target size does the same on this page. That control is here: each thema in view as a link, followed by its
 * runs, and on each run a link to its chapter, BESIDE the button that opens the verrijkingen rather than inside it. Both
 * links carry the mark the menu gives Thema's, the destination they lead to.
 */
export function Subthemabalk({
  themas,
  reeksen,
  verrijkingen,
  geladen,
  hoeken,
  magPlannen,
  onOpen,
}: {
  /** The thema's of the themaperiodes touching the days on screen, in the order their periodes start. */
  themas: readonly Thema[];
  /** The runs touching the days on screen, in the order they start. */
  reeksen: readonly Subthemareeks[];
  verrijkingen: readonly SubthemaperiodeVerrijkingen[];
  /** Whether the verrijkingen above and the hoeken below both come from reads that succeeded. */
  geladen: boolean;
  /** The klas's corners, to name the first one in the preview and to keep their order. */
  hoeken: readonly { id: string; naam: string }[];
  magPlannen: boolean;
  onOpen: (reeks: Subthemareeks) => void;
}) {
  const groepen = perThema(themas, reeksen);
  if (groepen.length === 0) return null;

  return (
    // Named for what it holds: with no run in view it holds only thema's, and says so.
    <ul
      aria-label={t(reeksen.length > 0 ? "subthemabalk.label" : "subthemabalk.labelThemas")}
      className="mb-3 flex flex-wrap items-stretch gap-2"
    >
      {groepen.flatMap(({ thema, runs }) => [
        <li key={`thema-${thema.id}`} className="flex w-full items-center sm:w-auto">
          <Link
            to={themapaginaPad(thema.id)}
            aria-label={t("subthemabalk.naarThema", { naam: thema.naam })}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-veld px-1 text-meta font-medium text-inkt underline-offset-4 hover:underline"
          >
            <IcoonThemas aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zacht" />
            {thema.naam}
          </Link>
        </li>,
        ...runs.map((reeks) => {
          const periode = reeks.periodeId
            ? verrijkingen.find((p) => p.subthemaperiodeId === reeks.periodeId)
            : undefined;
          // In the klas's own order of corners, so the preview names the same hoek the sheet lists first.
          const gevuld = hoeken.flatMap((hoek) => {
            const verrijking = periode?.verrijkingen.find((v) => v.hoekId === hoek.id);
            return verrijking ? [{ naam: hoek.naam, tekst: verrijking.tekst }] : [];
          });
          const zeker = geladen || reeks.periodeId === undefined;
          const naarSubthema = t("subthemabalk.naarSubthema", { naam: reeks.subthemaNaam });

          return (
            <li key={`${reeks.subthemaId}-${reeks.van}`} className="relative w-full sm:w-72">
              <button
                type="button"
                onClick={() => onOpen(reeks)}
                className="flex h-full w-full flex-col gap-0.5 rounded-veld border border-lijn bg-kaart py-2 pl-3 pr-10 text-left transition-colors duration-150 hover:border-accent"
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
              <Link
                to={themapaginaPad(reeks.themaId, reeks.subthemaId)}
                aria-label={naarSubthema}
                title={naarSubthema}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
              >
                <IcoonThemas aria-hidden="true" className="h-4 w-4" />
              </Link>
            </li>
          );
        }),
      ])}
    </ul>
  );
}

/**
 * Each thema in view with the runs of its subthema's, in the order the thema's come, and each group's runs in the order
 * they start.
 *
 * A run whose thema is in no periode on screen (an activiteit planned between two periodes) still gets its thema, from
 * the run itself, at the end: every run is listed under the thema whose page it opens.
 */
function perThema(themas: readonly Thema[], reeksen: readonly Subthemareeks[]): { thema: Thema; runs: Subthemareeks[] }[] {
  const alle = [...themas];
  for (const reeks of reeksen) {
    if (!alle.some((thema) => thema.id === reeks.themaId)) alle.push({ id: reeks.themaId, naam: reeks.themaNaam });
  }
  return alle.map((thema) => ({ thema, runs: reeksen.filter((reeks) => reeks.themaId === thema.id) }));
}
