import { IcoonHoek } from "../../components/Iconen";
import { valtBinnen } from "../../lib/datum";
import { cn } from "../../lib/cn";
import type { HoekplaatsingWeergave } from "./gegevens";

/**
 * Which hoeken are running on this day, as a strip along the edge of the day cell.
 *
 * **The same shape as `Subthemastroken`, on purpose, and told apart by a glyph rather than a hue.**
 * A hoek run and a subthema run are both "a stretch of days", so drawing them differently would make
 * the calendar teach two visual languages for one idea. What separates them has to be something other
 * than colour, because Art. XII has none left to spend and because a tint alone is not a distinction
 * anyone can name. So a hoek strip carries the corner glyph, at ten pixels, in front of its name.
 *
 * **Outlined where a subthema strip is filled.** The second, weaker cue, and it encodes something
 * true: a subthema is what the class is working on, a hoek is where. The corner should not shout over
 * the content.
 *
 * `aria-hidden`, like its sibling: the day's own button already names what is running on it, and two
 * readings of one fact across forty cells is what makes a calendar unusable with a screen reader.
 */
export function Hoekstroken({
  plaatsingen,
  datum,
  dicht,
  className,
}: {
  plaatsingen: readonly HoekplaatsingWeergave[];
  datum: string;
  /** The month cell, where a strip has to survive on about 112 pixels of height. */
  dicht?: boolean;
  className?: string;
}) {
  const lopend = plaatsingen.filter((p) => valtBinnen(datum, p.van, p.tot));
  if (lopend.length === 0) return null;

  // One strip plus a count from three onwards, the same rule the subthema strips use: a cell that
  // spends half its height on strips has stopped being a day, and nothing is lost because the day's
  // own button lists them all.
  const zichtbaar = lopend.length > 2 ? lopend.slice(0, 1) : lopend;
  const rest = lopend.length - zichtbaar.length;

  return (
    <div aria-hidden="true" className={cn("pointer-events-none flex flex-col gap-px", className)}>
      {zichtbaar.map((plaatsing) => (
        <Strook
          key={plaatsing.id}
          isStart={plaatsing.van === datum}
          dicht={dicht}
          tekst={plaatsing.hoekNaam}
        />
      ))}
      {rest > 0 ? <Strook isStart={false} dicht={dicht} tekst={`+${rest}`} /> : null}
    </div>
  );
}

/**
 * One strip.
 *
 * The left edge is the structure, the same way the subthema strips do it: a solid tick means the run
 * BEGINS on this day, and a run already going gets the same two pixels in the surface colour, so the
 * labels of every strip in a week line up on one pixel column. Without that the eye reads the shift
 * rather than the tick.
 */
function Strook({ isStart, dicht, tekst }: { isStart: boolean; dicht?: boolean; tekst: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-hidden border-y border-lijn bg-kaart",
        dicht ? "h-4 px-1" : "h-5 px-1.5",
      )}
    >
      <span
        className={cn("h-2.5 w-0.5 shrink-0 rounded-full", isStart ? "bg-inkt-zwak" : "bg-transparent")}
      />
      <IcoonHoek aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-inkt-zwak" />
      <span className={cn("truncate text-inkt-zacht", dicht ? "text-[0.625rem]" : "text-micro")}>{tekst}</span>
    </div>
  );
}
