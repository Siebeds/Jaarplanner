import { t } from "../../i18n";
import { dekkingExportUrl } from "./api";
import type { Dekkingsbereik } from "./types";

/**
 * The download link for the coverage export (E5-06, FR-9.5, FR-11.2): the dekkingsoverzicht as proof of coverage.
 *
 * **A plain anchor, not a Button with an onClick**, exactly as the import sjabloon is (FR-1.5): a download is a
 * navigation, so handing the URL to the browser keeps its own progress, its own cancel, "link opslaan als" and
 * middle-click. The server names the file, so nothing here does.
 *
 * **It lives in the page header rather than in the summary card, and that placement is the one real design decision
 * in this component.** The summary card's right column holds the three controls that decide what is measured
 * (bereik, jaar/fase, doelsoort). Putting the download there would sit it directly under the **doelsoort filter it
 * deliberately ignores** (owner ruling 2026-08-06: the export is always the full set in scope), and adjacency reads
 * as relationship. This repo's record is that two controls next to each other meaning different things is not a
 * cosmetic problem: it is how E4-06 came to tell a teacher that locking was why a thema survived, and how E3-07 came
 * to invite a teacher to pick a period one paragraph above saying they could not. The list header was rejected for
 * the same reason, one step worse, because the gaps-only toggle is right there. The page header is where a
 * page-level action belongs, it is reachable without scrolling past a few hundred rows, and it is adjacent to no
 * control at all.
 *
 * **The explanation is unconditional, and that is deliberate rather than lazy.** The first draft rendered it only
 * when something was filtered out, which is the shape the E5-03 rule warns about: a conditional sentence may assert
 * only what its own render condition guarantees, and "ook de doelen die je nu niet ziet" is false in a reachable
 * case (a scope holding exactly one doelsoort, filtered to that doelsoort, hides nothing). *"Wat je hier ook filtert
 * of verbergt"* is true in every state, and it happens to be the warning precisely when a teacher needs one. Saying
 * one true thing always beats saying a sharper thing sometimes.
 *
 * The same statement is written **inside** the workbook as well. That is not duplication for its own sake: the file
 * outlives the screen it came from, and a reader who opens it next month has no screen to compare it against.
 */
export interface DekkingexportProps {
  klasId: string;
  /** The scope the document will be built over: the same two values the screen is currently showing. */
  bereik: Dekkingsbereik;
  gekozenJaarFase: string | null;
}

export function Dekkingexport({ klasId, bereik, gekozenJaarFase }: DekkingexportProps) {
  return (
    // Link and explanation in one paragraph, the sjabloon's proven shape. It also keeps the link inline in a
    // sentence, which is the case WCAG 2.2 SC 2.5.8 exempts from the 24px target minimum; a bare standalone link at
    // 14px would not be exempt and would need padding to reach it.
    <p className="max-w-prose text-sm sm:max-w-xs sm:text-right">
      <a
        href={dekkingExportUrl(klasId, bereik, gekozenJaarFase)}
        download
        className="font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
      >
        {t("dekking.export")}
      </a>{" "}
      <span className="text-ink-zacht">{t("dekking.exportUitleg")}</span>
    </p>
  );
}
