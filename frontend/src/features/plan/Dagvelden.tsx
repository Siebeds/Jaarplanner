import type { ReactNode } from "react";
import { Invoer } from "../../components/ui/Veld";
import { t } from "../../i18n";

/**
 * A planned block's day, start and end, as one row of three fields: what a drag and an edge-drag do in the grid, for
 * the keyboard (WCAG 2.2 SC 2.5.7).
 *
 * **One grid, not a wrapping row** (FB-100). The fields used to sit in a `flex-wrap` with minimum widths, and in the
 * narrow sheet the three minimums did not fit: the end hour dropped onto a full-width row of its own while the day
 * and the start stayed side by side. Fixed fractions keep the three together at every width the sheet takes, the day
 * a little wider because a date says more than a time.
 *
 * `actie` is an optional control at the end of the row (the activiteit's "Verplaats"): beside the fields where the sheet
 * is wide enough, under them where it is not, and never between them.
 */
export function Dagvelden({
  id,
  datum,
  begin,
  einde,
  vroegste,
  laatste,
  disabled,
  datumVergrendeld,
  onDatum,
  onBegin,
  onEinde,
  actie,
}: {
  /** A prefix for the three fields' ids, unique on the page. */
  id: string;
  datum: string;
  /** `HH:mm`, which is what a time field reads and writes. */
  begin: string;
  einde: string;
  vroegste?: string;
  laatste?: string;
  disabled?: boolean;
  /** The day cannot change while the other two can: an algemene fiche's hours set for its whole period (FB-101). */
  datumVergrendeld?: boolean;
  onDatum: (waarde: string) => void;
  onBegin: (waarde: string) => void;
  onEinde: (waarde: string) => void;
  actie?: ReactNode;
}) {
  return (
    <div
      className={
        actie
          ? "grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 @md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          : "grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2"
      }
    >
      <Veldje id={`${id}-dag`} label={t("dagvelden.dag")}>
        <Invoer
          id={`${id}-dag`}
          type="date"
          min={vroegste}
          max={laatste}
          value={datum}
          disabled={disabled || datumVergrendeld}
          onChange={(e) => onDatum(e.target.value)}
          className="mt-1 px-2"
        />
      </Veldje>
      <Veldje id={`${id}-begin`} label={t("dagvelden.van")}>
        <Invoer
          id={`${id}-begin`}
          type="time"
          step={900}
          value={begin}
          disabled={disabled}
          onChange={(e) => onBegin(e.target.value)}
          className="mt-1 px-2"
        />
      </Veldje>
      <Veldje id={`${id}-einde`} label={t("dagvelden.tot")}>
        <Invoer
          id={`${id}-einde`}
          type="time"
          step={900}
          value={einde}
          disabled={disabled}
          onChange={(e) => onEinde(e.target.value)}
          className="mt-1 px-2"
        />
      </Veldje>
      {actie ? <div className="col-span-3 @md:col-span-1">{actie}</div> : null}
    </div>
  );
}

function Veldje({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-micro text-inkt-zacht">
        {label}
      </label>
      {children}
    </div>
  );
}
