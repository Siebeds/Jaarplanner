import type { ReactNode } from "react";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { t } from "../../i18n";
import { useLeerplandoel } from "../../lib/queries";
import type { DoelKoppelingWeergave } from "../../lib/types";
import { Ontkoppel } from "./Fiche";

/**
 * One linked doel on the thema page: what it SAYS, and not only its code (TB-016).
 *
 * The owner, 2026-09-14: "ik wil tekst bij de thema doelen niet gewoon de nummers, dit is niet
 * gebruiksvriendelijk". A code such as `6.5.GK2.3` is Op.stap's index, not something a teacher knows
 * by heart, so the list answered "which doelen hang here" only for someone who had the register open
 * beside it. The row now reads like the open doelsuggesties further down the same card: the doelsoort
 * mark and the code as a small line, the goal text under it at reading size.
 *
 * **Two lines of the text, never more.** The official sentences run to four lines on a phone, and a
 * list of three themadoelen that each take a paragraph stops being a list a teacher can scan. The
 * whole sentence is one press away: the row opens the doel's detail.
 *
 * **The text is fetched per row**, from the same endpoint the detail reads, so opening the detail is
 * served from the cache. That is a heavy read for two fields: the detail endpoint runs up to seven
 * queries, once per linked doel on the page (up to three themadoelen, plus the subdoelen and, since
 * FB-010, the other activiteit doelen of every open subthema chapter), and again after every write on this screen. It is accepted for now because the
 * thema's own read view, where the text belongs, is being reworked by E6-02; TB-017 moves it there.
 *
 * **The whole row is the button, and the remove control sits above it.** A stretched `::after` on the
 * button covers the row, so the empty space beside the text opens the detail too; the remove
 * control is lifted above that layer and stays a separate target, because removing a doel is the one
 * thing on this row that must never happen by accident.
 *
 * **The remove control only for whoever holds the link's row of the matrix** (E6-02, ADR-0030 §3): the caller passes
 * `onOntkoppel` only then, and without it the row still opens the detail and has nothing else to press.
 */
export function Gekoppelddoel({
  koppeling,
  ontkoppelLabel,
  ontkoppelBezig,
  onOntkoppel,
  onToon,
  voet,
}: {
  koppeling: DoelKoppelingWeergave;
  /** A line under the text, such as the activiteiten that carry this doel (FB-010). Phrasing content only. */
  voet?: ReactNode;
  ontkoppelLabel: string;
  ontkoppelBezig?: boolean;
  /** Absent without the right to remove this link: the row then only opens the detail. */
  onOntkoppel?: () => void;
  /** `knop` is this row's button, which gets focus back when the detail closes. */
  onToon: (leerplandoelCode: string, knop: HTMLElement) => void;
}) {
  const code = koppeling.leerplandoelCode;
  const { data, isPending } = useLeerplandoel(code);

  return (
    <li className="relative flex items-start gap-2 px-3 py-2.5 transition-colors duration-150 hover:bg-inkt/[0.035]">
      <button
        type="button"
        onClick={(event) => onToon(code, event.currentTarget)}
        className="min-w-0 flex-1 text-left after:absolute after:inset-0"
      >
        {/* THE STATUS SITS ON THE CODE LINE, not in a column of its own beside the text. As a third
            column it took seventy pixels from every line of the goal text, and inside a subthema card
            at 390, which is already narrowed by its own two controls, that left the text a column of
            sixty pixels and the status on top of the code. Here it wraps under the code when the line
            is short, and the sentence below keeps the row's full width. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {data ? <Doelsoortmerk soort={data.doelsoort} /> : null}
          <span className="mono text-micro font-medium text-inkt-zacht">{code}</span>
          {/* A doel Op.stap has dropped stays linked and keeps its text, so the row is where a teacher
              has to see that it needs reviewing (Art. III.4), not only the detail. Same mark and words
              as the detail's. */}
          {data?.nietMeerInOpstap ? (
            <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
          <Statusmerk status={koppeling.status} className="ml-auto" />
        </span>

        {/* If the doel cannot be loaded the row keeps its code; the detail shows the load error. */}
        {data ? (
          <span className="mt-1 line-clamp-2 text-body text-inkt">{data.tekst}</span>
        ) : isPending ? (
          // A span, not `Laadvlak`: that one is a `div`, and a button may only hold phrasing content.
          <span aria-hidden="true" className="mt-1.5 block h-4 w-3/4 animate-pulse rounded-veld bg-vlak-diep" />
        ) : null}
        {voet ? <span className="mt-1.5 block">{voet}</span> : null}
      </button>

      {onOntkoppel ? (
        <span className="relative z-10 -my-1.5 flex">
          <Ontkoppel label={ontkoppelLabel} bezig={ontkoppelBezig} onClick={onOntkoppel} />
        </span>
      ) : null}
    </li>
  );
}
