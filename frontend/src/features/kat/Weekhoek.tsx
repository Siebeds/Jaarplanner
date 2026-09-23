import { useRef, type ReactNode } from "react";
import { Ballon } from "./Ballon";
import { useMeldHoek } from "./katplek";
import { houdingklasse } from "./houding";
import { LiggendeKat } from "./Tekening";
import { useChuck, useChuckZichtbaar } from "./useChuck";
import { useLevenInRust } from "./useLoopje";
import { gevaarzin } from "./zinnen";

/**
 * The corner of the week strip, where Chuck lies when a goal of this klas is at risk (FB-071, ADR-0059 K5). His
 * basket in the header is empty then: there is exactly one Chuck on screen.
 *
 * He lies in a row of his own above the grid, his belly on its top edge, with his balloon above him like a comic's
 * (owner, 2026-09-23). The row exists only while he is there, so he never covers a day, an hour or a block.
 */
export function Weekhoek({ klasId, actief, children }: { klasId: string | null; actief: boolean; children: ReactNode }) {
  useMeldHoek(actief ? klasId : null);
  const zichtbaar = useChuckZichtbaar();
  return (
    <>
      {zichtbaar && actief ? <Hoekkat /> : null}
      {children}
    </>
  );
}

function Hoekkat() {
  const { houding, opDeHoek } = useChuck();
  const kat = useRef<SVGSVGElement>(null);
  useLevenInRust(kat, opDeHoek);
  if (!opDeHoek || !houding.gevaar) return null;
  return (
    <div className="flex flex-col items-end gap-2.5">
      <Ballon staart="onder" pop className="max-w-[40ch]">
        {gevaarzin(houding.gevaar)}
      </Ballon>
      {/* The drawing's lowest point is its belly at y 146 of 176: the negative margin sets that on the grid's edge. */}
      <LiggendeKat ref={kat} className={`${houdingklasse("gevaar")} pointer-events-none relative z-10 -mb-[11px] mr-1 w-[92px] shrink-0`} />
    </div>
  );
}
