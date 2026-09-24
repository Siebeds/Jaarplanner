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
 * **The text comes with the link** (TB-017): a thema read carries each link's text, doelsoort and Op.stap
 * flag, so the row asks the server nothing and the doel's detail, a heavy read of up to seven queries, is
 * fetched only when the row is pressed. A link without them (a write's answer, or a code a form holds
 * before Bewaren) still reads the doel itself, from the endpoint the detail uses.
 *
 * **The whole row is the button, and the remove control sits above it.** A stretched `::after` on the
 * button covers the row, so the empty space beside the text opens the detail too; the remove
 * control is lifted above that layer and stays a separate target, because removing a doel is the one
 * thing on this row that must never happen by accident.
 *
 * **The remove control only for whoever holds the link's row of the matrix** (E6-02, ADR-0030 §3): the caller passes
 * `onOntkoppel` only then, and without it the row still opens the detail and has nothing else to press.
 *
 * **No status on a doel that is not stored yet** (TB-025): a new activiteit holds its codes until Bewaren, and a
 * status printed before the server wrote one would state a fact the row does not have.
 */
export function Gekoppelddoel({
  koppeling,
  ontkoppelLabel,
  ontkoppelBezig,
  onOntkoppel,
  onToon,
  voet,
}: {
  /** Without `status` while the doel is only held by a form that has not been saved. */
  koppeling: Pick<DoelKoppelingWeergave, "leerplandoelCode"> &
    Partial<Pick<DoelKoppelingWeergave, "status" | "tekst" | "doelsoort" | "nietMeerInOpstap">>;
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
  // All three fields or none: a thema read fills them together (TB-017), and only then is the row's own read skipped.
  const meegestuurd =
    typeof koppeling.tekst === "string" && koppeling.doelsoort != null && typeof koppeling.nietMeerInOpstap === "boolean"
      ? { tekst: koppeling.tekst, doelsoort: koppeling.doelsoort, nietMeerInOpstap: koppeling.nietMeerInOpstap }
      : null;
  const gelezen = useLeerplandoel(meegestuurd ? null : code);
  const data = meegestuurd ?? gelezen.data;
  const isPending = meegestuurd ? false : gelezen.isPending;

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
          {koppeling.status ? <Statusmerk status={koppeling.status} className="ml-auto" /> : null}
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
