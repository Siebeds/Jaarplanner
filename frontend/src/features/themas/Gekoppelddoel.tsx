import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Statusmerk } from "../../components/ui/Statusmerk";
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
 * served from the cache. The thema's own read view does not carry it, and adding it there collides
 * with the E6-02 work on that service; see the ticket. A thema holds two or three themadoelen and a
 * handful of subdoelen per subthema, which is what makes one request per doel acceptable.
 *
 * **The whole row is the button, and the remove control sits above it.** A stretched `::after` on the
 * button covers the row, so the empty space beside the text opens the detail too; the remove
 * control is lifted above that layer and stays a separate target, because removing a doel is the one
 * thing on this row that must never happen by accident.
 */
export function Gekoppelddoel({
  koppeling,
  ontkoppelLabel,
  ontkoppelBezig,
  onOntkoppel,
  onToon,
}: {
  koppeling: DoelKoppelingWeergave;
  ontkoppelLabel: string;
  ontkoppelBezig?: boolean;
  onOntkoppel: () => void;
  onToon: (leerplandoelCode: string) => void;
}) {
  const code = koppeling.leerplandoelCode;
  const { data, isPending } = useLeerplandoel(code);

  return (
    <li className="relative flex items-start gap-2 px-3 py-2.5 transition-colors duration-150 hover:bg-inkt/[0.035]">
      <button
        type="button"
        onClick={() => onToon(code)}
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
          <Statusmerk status={koppeling.status} className="ml-auto" />
        </span>

        {/* A doel the register no longer knows keeps its code and nothing else: the row still opens
            the detail, which says why there is nothing to show. */}
        {data ? (
          <span className="mt-1 line-clamp-2 text-body text-inkt">{data.tekst}</span>
        ) : isPending ? (
          // A span, not `Laadvlak`: that one is a `div`, and a button may only hold phrasing content.
          <span aria-hidden="true" className="mt-1.5 block h-4 w-3/4 animate-pulse rounded-veld bg-vlak-diep" />
        ) : null}
      </button>

      <span className="relative z-10 -my-1.5 flex">
        <Ontkoppel label={ontkoppelLabel} bezig={ontkoppelBezig} onClick={onOntkoppel} />
      </span>
    </li>
  );
}
