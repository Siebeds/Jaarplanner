import { Link } from "react-router-dom";
import { IcoonThemas } from "../../components/Iconen";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";
import { themapaginaPad } from "../themas/themapagina";
import type { Subthemareeks } from "./subthemareeksen";

type Thema = { id: string; naam: string };

/**
 * The thema's and subthema's running in the days on screen, above the grid: the keyboard's way to the themapagina
 * (FB-037, ADR-0042).
 *
 * The bands in the grid take a pointer there, but they are `aria-hidden`, out of the tab order and 16 pixels tall, which
 * they may only be because a control that meets the target size does the same on this page. That control is here: each
 * thema in view as a link, followed by the runs of its subthema's, each a link to its chapter with its days beside it.
 *
 * **A row of links and nothing else** (ADR-0044). What the hoeken hold while a subthema runs is in the side panel, not
 * here, so the row is text on the page: no card and no button to compete with the plan under it.
 *
 * **One row per run the grid already draws**, from the same `subthemareeksen` the strips in the day headings come from,
 * so the row cannot name a subthema the grid does not show.
 */
export function Subthemabalk({
  themas,
  reeksen,
}: {
  /** The thema's of the themaperiodes touching the days on screen, in the order their periodes start. */
  themas: readonly Thema[];
  /** The runs touching the days on screen, in the order they start. */
  reeksen: readonly Subthemareeks[];
}) {
  const groepen = perThema(themas, reeksen);
  if (groepen.length === 0) return null;

  return (
    // Named for what it holds: with no run in view it holds only thema's, and says so.
    <ul
      aria-label={t(reeksen.length > 0 ? "subthemabalk.label" : "subthemabalk.labelThemas")}
      className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1"
    >
      {groepen.flatMap(({ thema, runs }) => [
        // A thema starts a line of its own on a phone, so its runs read as under it.
        <li key={`thema-${thema.id}`} className="w-full sm:w-auto">
          <Link
            to={themapaginaPad(thema.id)}
            aria-label={t("subthemabalk.naarThema", { naam: thema.naam })}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-veld px-1 text-meta font-medium text-inkt underline-offset-4 hover:underline"
          >
            <IcoonThemas aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zacht" />
            {thema.naam}
          </Link>
        </li>,
        ...runs.map((reeks) => (
          <li key={`${reeks.subthemaId}-${reeks.van}`} className="flex items-baseline gap-1.5">
            {/* The name is the link and the days are beside it, outside it, so the link's name contains its visible
                label (SC 2.5.3) without a date read out in front of every chapter. */}
            <Link
              to={themapaginaPad(reeks.themaId, reeks.subthemaId)}
              aria-label={t("subthemabalk.naarSubthema", { naam: reeks.subthemaNaam })}
              className="inline-flex min-h-8 items-center rounded-veld px-1 text-meta text-inkt underline-offset-4 hover:underline"
            >
              {reeks.subthemaNaam}
            </Link>
            <span className="text-micro text-inkt-zwak">{periodeTekst(reeks.van, reeks.tot)}</span>
          </li>
        )),
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
