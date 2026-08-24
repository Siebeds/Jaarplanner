import type { Blokspreiding, Planningsblok } from "../../lib/types";
import { dagenTussen, maandKort } from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The school year as one strip: every planning period side by side, each as wide as it is long.
 *
 * This is the signature of the application, and it is the same figure as the mark in the wordmark.
 * It exists because the year is the spine of this tool and a vertical list of periods hides the one
 * thing a teacher is actually judging: whether the load is spread. Side by side, in proportion, an
 * overfull period is visible before you read a single number.
 *
 * Each segment carries three things at once: how long the period is (its width), how full it is
 * (the fill), and whether it is overfull (the fill turns to the attention colour AND the segment
 * gets a rule under it, since colour never carries a state on its own here).
 */
export function Schooljaarlint({
  blokken,
  spreiding,
  gekozenBlokStart,
  onKies,
}: {
  blokken: Planningsblok[];
  spreiding: Blokspreiding[];
  gekozenBlokStart: string | null;
  onKies: (blokStart: string) => void;
}) {
  if (blokken.length === 0) return null;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      <ul className="flex min-w-[36rem] items-stretch gap-1">
        {blokken.map((blok) => {
          const last = spreiding.find((vak) => vak.start === blok.start);
          const bezet = last && last.beschikbareWeken > 0 ? last.benodigdeWeken / last.beschikbareWeken : 0;
          const overbelast = last?.isOverbelast ?? false;
          const gekozen = gekozenBlokStart === blok.start;

          return (
            <li key={blok.start} style={{ flexGrow: dagenTussen(blok.start, blok.eind) }} className="min-w-16">
              <button
                type="button"
                onClick={() => onKies(blok.start)}
                aria-current={gekozen ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-veld border px-2 py-2 text-left transition-colors duration-150",
                  gekozen ? "border-inkt bg-vlak-diep" : "border-lijn bg-kaart hover:border-lijn-veld",
                )}
              >
                <span className="flex items-baseline justify-between gap-1">
                  <span className="text-micro uppercase text-inkt-zwak">{maandKort(blok.start)}</span>
                  <span className="mono text-[0.625rem] text-inkt-zwak">{blok.ordinaal}</span>
                </span>

                {/* The load. A well rather than a bar on its own, so an empty period reads as empty
                    instead of as missing. */}
                <span className="flex h-1.5 overflow-hidden rounded-full bg-vlak-diep">
                  <span
                    aria-hidden="true"
                    style={{ width: `${Math.min(100, Math.round(bezet * 100))}%` }}
                    className={cn("h-full rounded-full", overbelast ? "bg-attentie" : "bg-inkt")}
                  />
                </span>

                <span className="mono text-[0.625rem] text-inkt-zacht">
                  {last ? `${last.benodigdeWeken}/${last.beschikbareWeken}` : "0"}
                </span>

                {overbelast ? (
                  <span className="rounded bg-attentie-zacht px-1 text-[0.625rem] font-medium text-attentie-inkt">
                    {t("plan.tevol")}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
