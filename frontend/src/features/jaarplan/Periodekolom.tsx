import { useDroppable } from "@dnd-kit/core";

import { t, tAantal } from "../../i18n";
import { Themakaart, type Verplaatsstaat } from "./Themakaart";
import { Themakiezer } from "./Themakiezer";
import {
  PERIODELABEL,
  benodigdeWekenNa,
  formatteerPeriode,
  isTeVolMet,
  wekenInBlok,
} from "./kalenderFormat";
import type {
  Blokspreiding,
  Planningsblok,
  Planningsblokniveau,
  Themaplaatsing,
} from "./types";

/** One column of the board. Fixed width, so every period is equally readable. */
export interface PeriodekolomProps {
  blok: Planningsblok;
  plaatsingen: Themaplaatsing[];
  /** The class whose plan this is, threaded to the cards' edit actions. */
  klasId: string;
  /** Every period of the year, so a card's panel can offer them as move targets. */
  blokken: readonly Planningsblok[];
  /** The tier this column belongs to (E3-08), which decides what it is called and what it says about its parent. */
  niveau: Planningsblokniveau;
  /**
   * Whether a thema can be moved onto this board at all, and if not, why not (E3-08). See {@link Verplaatsstaat}.
   *
   * Not `kan` at the fine tier, and **the reason is what a drop would mean, not what the endpoint would answer.** The
   * endpoint argument is the weaker one and only two thirds true: `VerplaatsPlaatsingAsync` resolves a target against
   * the generation tier's blocks, so most subthemaperiode starts are refused with *"… is geen begin van een periode in
   * dit schooljaar."* — but each parent's **first** sub-block starts on the parent's own start date, so 7 of a real
   * year's 19 fine columns are perfectly valid targets. Those 7 are exactly why the affordance is withheld: a drop
   * there moves the thema into the **whole** themaperiode, so the control would be honest about the request and
   * dishonest about the effect. A teacher aiming at a fortnight would record five weeks and see nothing say so.
   *
   * Hence no grip and no picker rather than a disabled one per column, with the board saying once in visible text
   * where moving does work (the E3-06 rule: an unavailable destination is stated, not hidden in a tooltip) — and
   * saying, in the `niveauOnbekend` degrade, that it does not know where that is.
   */
  verplaatsstaat: Verplaatsstaat;
  /**
   * Whether the **themaperiode this column belongs to** holds a thema (E3-08 fix round 1).
   *
   * Always false at the coarse tier, where a column *is* its own themaperiode and its own placements are the whole
   * truth. At the fine tier it decides which of two things an empty well says, and the distinction is not cosmetic:
   * a sub-column of a filled themaperiode is a fortnight in which the class **is** teaching that thema, so
   * "Nog niets gepland" there is false about the plan. What the tool genuinely does not know is which weeks of the
   * parent the thema occupies, and that is a different sentence.
   */
  ouderIsIngepland: boolean;
  /**
   * Which coarse periods each thema already occupies, by thema id (E4-03). Threaded straight through to
   * {@link Themakiezer}; see its prop docs for what the two consumers of it are.
   *
   * Computed once for the whole board rather than per column, because it is a fact about the *plan* and a column
   * only ever sees its own placements.
   */
  alGeplaatst: ReadonlyMap<string, readonly number[]>;
  /**
   * How full this period is, as the server measured it (E3-09): the weeks its thema's need against the weeks it
   * offers. `undefined` at the fine tier, where the load belongs to the parent themaperiode and is summarised once
   * above the board rather than repeated across up to nineteen sub-columns (owner ruling, 2026-07-31).
   *
   * The column never decides te vol itself. It used to, by counting thema's against a provisional threshold, and that
   * count disagreed with the server's arithmetic on every period holding three short thema's.
   */
  belasting: Blokspreiding | undefined;
}

/**
 * A planning period as a board column (owner's choice, 2026-07-29).
 *
 * **This is the approved E3-10 picture, minus the two things that broke it.** The wireframe put the periods
 * side by side left to right with the vakanties as literal gaps, which is right: the year has a direction,
 * and a teacher reads it that way. Two properties of the first build made it unusable, and both are gone:
 *
 * - *Proportional widths* made a 4-week period too narrow to read a thema name in. Proportionality now lives
 *   in the {@link Jaarspine} strip above, which is the view that is actually good at it; columns here are
 *   equal width so every period is equally legible.
 * - *Stretching.* Flex `items-stretch` sized every column to the tallest, so one period with three thema's
 *   left its six neighbours as tall empty troughs. The board uses `items-start`.
 *
 * **At the fine tier it is a subthemaperiode and says which themaperiode it belongs to (E3-08).** Everything else
 * about the column is identical, deliberately: same width, same card, same empty well. A `Themaplaatsing` keys on a
 * *themaperiode* start (ADR-0020 §3) and nothing in the model records which weeks inside that period a thema
 * occupies, so the card is rendered **once**, in the sub-block whose start equals the placement's `blokStart` — the
 * parent's first one. It is not repeated across the parent's other sub-blocks and no "runs through here"
 * continuation is drawn, because both would assert an extent the data does not contain. The board says why once above
 * itself rather than in every column.
 *
 * **What those sibling columns are empty *of* is a card, not a plan** ({@link PeriodekolomProps.ouderIsIngepland}).
 * They carried "Nog niets gepland" in round 1, and that is false about a class that is teaching its parent's thema
 * that fortnight: the picture was honest about the data and misleading about the plan. A sibling of a filled
 * themaperiode now says it belongs to one, which also keeps it distinguishable from a genuinely empty period's
 * sub-column.
 *
 * **It is the drop target (E3-07).** While a card is over it the column fills with the petrol wash and says
 * "Hierheen verplaatsen" in words, because a colour change alone carries nothing (Art. XII, WCAG 2.2 AA).
 *
 * **And it answers "is there room here?" during the gesture, not after the drop.** A period the incoming thema would
 * tip over says so while the card hovers it, in the same weeks the flag itself uses. That is the one place this screen
 * spends any boldness: a teacher rearranging a year is asking exactly that question, and every other tool makes them
 * drop first and read the consequence afterwards. It is phrased as a consequence, never a refusal, because nothing is
 * blocked: a period may be te vol if the teacher decides it should be (Art. IV.1).
 *
 * **What "te vol" means is the server's answer, not this column's** (owner ruling, 2026-07-31, E3-09): the placed
 * thema's need more weeks than the period offers. Until E3-09 this file counted thema's against a provisional 3, which
 * called three two-week thema's in a 6-week period over-full and said nothing about two six-week ones that genuinely
 * do not fit.
 */
export function Periodekolom({
  blok,
  plaatsingen,
  klasId,
  blokken,
  niveau,
  verplaatsstaat,
  ouderIsIngepland,
  alGeplaatst,
  belasting,
}: PeriodekolomProps) {
  const teVol = belasting?.isOverbelast ?? false;

  // Disabled rather than absent at the fine tier: hooks cannot be conditional, and dnd-kit's own `disabled` is the
  // supported way to say "this is not a landing place". Nothing is draggable there either, so this is belt and braces.
  const { setNodeRef, isOver, active } = useDroppable({
    id: blok.start,
    data: { blok },
    disabled: verplaatsstaat !== "kan",
  });

  // Only meaningful while something is being dragged, and only for a card coming from *elsewhere*: a thema
  // dropped back into its own period changes nothing, so warning about it would be noise.
  const sleependeKaart = active?.data.current?.plaatsing as Themaplaatsing | undefined;
  const komtVanElders = Boolean(sleependeKaart) && sleependeKaart!.blokStart !== blok.start;
  const isDoelwit = isOver && komtVanElders;

  // The prediction, in the dragged thema's own weeks rather than "one more thema". Adding 1 to a count was the old
  // threshold's arithmetic, and it promised something the flag after the drop would then contradict: a 6-week thema
  // dropped into a 6-week period holding one 2-week thema is te vol immediately, which "one more thema" never saw.
  const benodigdNa = isDoelwit
    ? benodigdeWekenNa(belasting, sleependeKaart?.duurWeken ?? 0)
    : undefined;
  const wordtTeVol =
    benodigdNa !== undefined && belasting !== undefined
      ? isTeVolMet(belasting.beschikbareWeken, benodigdNa)
      : false;

  return (
    <li className="flex w-72 shrink-0 flex-col">
      <div
        className={[
          "rounded-t-lg border border-b-0 px-3.5 py-3",
          teVol || wordtTeVol ? "border-attentie bg-attentie-zacht" : "border-border bg-card",
        ].join(" ")}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">
            {/* Paired by {@link PERIODELABEL} rather than by a ternary (fix round 4), so this heading and the strip's
                sr-only ordinal above it cannot come to call one block by two names. */}
            {t(PERIODELABEL[niveau], { ordinaal: blok.ordinaal })}
          </h3>
          <span className="shrink-0 text-xs font-medium text-ink-zacht" data-cijfers>
            {/* Through `tAantal` since the figure became a whole number (E3-09): "1 weken" is now reachable, on the
                short block a long mid-year closure can leave behind, and it was not while this rendered "1,0 weken".
                Worth naming because `catalogus.test.ts` could not have caught it — that guard fires on `{aantal}`, and
                this key interpolated `{weken}`. Renamed to `{aantal}` so the guard covers it from here on. */}
            {tAantal(
              wekenInBlok(blok.aantalOpenDagen),
              "kalender.wekenEnkelvoud",
              "kalender.weken",
            )}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-zacht">
          <time dateTime={blok.start}>{formatteerPeriode(blok.start, blok.eind)}</time>
        </p>

        {/* Which themaperiode this column is part of, straight from the server's `ouderOrdinaal` — the field exists
            for exactly this. It is the fact that makes the fine view readable: a thema sits at the start of its
            themaperiode, so without naming the parent, the neighbouring empty columns look like a plan with holes
            in it rather than the inside of one period. Guarded on null so a coarse block never grows a stray line. */}
        {niveau === "Subthemaperiode" && blok.ouderOrdinaal !== null && (
          <p className="mt-1 text-xs font-medium text-petrol">
            {t("kalender.binnenThemaperiode", { ordinaal: blok.ouderOrdinaal })}
          </p>
        )}

        {teVol && belasting !== undefined && (
          // Icon AND word, never colour alone (Art. XII, FR-6.4). The *explanation* of what "te vol" means
          // is shown once above the board rather than repeated in every flagged column — the same disclosure
          // seven times over is what made the first version unreadable.
          //
          // It states the two weeks figures rather than a count of thema's, because those are what a teacher can act
          // on: "5 weken nodig, 4 beschikbaar" says how much has to move, where "te vol: 3 thema's" said only that
          // something was wrong and misnamed the reason.
          <p className="mt-2 text-xs font-semibold text-attentie-ink" data-cijfers>
            <span aria-hidden="true">▲</span>{" "}
            {/* Through `tAantal` on the AVAILABLE figure (antagonist MAJOR, fix round 1). This sentence carries two
                counts and only one of them can reach 1 in a reachable state: `beschikbareWeken` is 1 on the short block
                a long mid-year closure leaves behind, which this story's own `wekenInBlok(7) === 1` test documents, so
                it printed *"in 1 weken"*. `benodigdeWeken` reaches 1 only when `beschikbareWeken` is 0, which needs a
                block of no open days at all, so it is left in the plural form rather than given a fourth key.
                **Not "a state nothing can produce"**, which is what this comment claimed until antagonist round 2 checked
                the derivation: `Lesperiodes()` splits only on period-breaking closures and `VerdeelGelijkmatig` always
                emits at least one block per stretch, so a one-day stretch between two vakanties covered by a vrije dag
                *would* yield a block of zero open days and print *"1 weken thema's in 0 weken"*. What is true is that
                nothing in the product can author such a schooljaar until **E6-03**, which is how the sibling zero-block
                cases on this screen are already phrased. */}
            {tAantal(belasting.beschikbareWeken, "kalender.teVolEenWeek", "kalender.teVol", {
              nodig: belasting.benodigdeWeken,
              beschikbaar: belasting.beschikbareWeken,
            })}
          </p>
        )}

        {/* The consequence of the drop the teacher is about to make, stated before they make it, in the same two
            figures the flag uses. Only when it is not already flagged, so the column does not say the same thing
            twice. */}
        {wordtTeVol && !teVol && belasting !== undefined && (
          <p className="mt-2 text-xs font-semibold text-attentie-ink" data-cijfers>
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              belasting.beschikbareWeken,
              "kalender.wordtTeVolEenWeek",
              "kalender.wordtTeVol",
              { nodig: benodigdNa!, beschikbaar: belasting.beschikbareWeken },
            )}
          </p>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-1 flex-col gap-2 rounded-b-lg border border-t-0 p-2.5 transition-colors duration-150",
          isDoelwit ? "bg-petrol-wash" : "bg-paper/70",
          teVol || wordtTeVol ? "border-attentie" : isDoelwit ? "border-petrol" : "border-border",
        ].join(" ")}
      >
        {plaatsingen.length === 0 ? (
          // A recessed dashed well rather than a line of italic text: it reads as "there is room here",
          // which is what an empty period means, and it is the drop target's resting state.
          //
          // Two sentences, one per case (see `ouderIsIngepland`). "Nog niets gepland" is a claim about the plan, so it
          // is only made where it is true; inside a filled themaperiode the well states what this fortnight is part of.
          //
          // The second sentence states **membership, not settledness** (fix round 2, MINOR-C). It read "Deel van een
          // ingeplande themaperiode", and `geplandeIn` excludes only `Geweigerd` — so a themaperiode holding one
          // unreviewed `Voorgesteld` proposal called itself *ingepland* in these columns, which hold no card and
          // therefore no status chip to qualify it. It was the first full sentence in the product asserting a settled
          // plan where Art. IV says nothing is final until a teacher says so. The key keeps its name; the claim does
          // not. (`Geweigerd`-only parents still correctly read "Nog niets gepland" — that path is untouched.)
          <p className="flex min-h-[5rem] items-center justify-center rounded-md border border-dashed border-border bg-paper-diep/50 px-3 text-center text-xs text-ink-zacht">
            {t(ouderIsIngepland ? "kalender.subperiodeIngepland" : "kalender.legeperiode")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plaatsingen.map((plaatsing) => (
              <li key={plaatsing.id}>
                <Themakaart
                  plaatsing={plaatsing}
                  klasId={klasId}
                  blokken={blokken}
                  verplaatsstaat={verplaatsstaat}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Planning a thema into this period by hand (E4-03, FR-7.2).

            **Gated on the same `verplaatsstaat` the grip and the move picker use, deliberately reusing that answer
            rather than deriving a second one.** The reasoning transfers exactly: a `Themaplaatsing` keys on a
            *themaperiode* start (ADR-0020 §3), so at the fine tier this control would record five weeks where the
            teacher aimed at a fortnight. That is the same "honest about the request, dishonest about the effect"
            problem documented on {@link PeriodekolomProps.verplaatsstaat}, and the board says once above itself
            where hand-planning does work, instead of a disabled button in nineteen columns.

            Below the cards and the empty well, as a footer: the well already reads "there is room here", and the
            action belongs after the content it adds to rather than above it. Hidden while a card hovers, so the
            landing sentence below is the only thing the column says during a drag. */}
        {verplaatsstaat === "kan" && !isDoelwit && (
          <Themakiezer klasId={klasId} blok={blok} alGeplaatst={alGeplaatst} />
        )}

        {/* Words, not just a colour wash: the fill says "something is happening here", the sentence says what.
            Rendered last so it reads as the landing place, below the cards already in the period. */}
        {isDoelwit && (
          <p className="rounded-md border border-dashed border-petrol bg-card/80 px-3 py-2 text-center text-xs font-semibold text-petrol">
            {t("kalender.hierheen")}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * A vakantie, as a literal gap in the board.
 *
 * Carried over from the approved wireframe and kept deliberately narrow: no teaching happens here, so there
 * is nothing to plan into it. The name is rendered vertically because a 40px column cannot hold
 * "Krokusvakantie" horizontally, and it is **visible text rather than a `title`** — a hover-only label is
 * invisible on touch and unread by most screen readers (E3-06). This is also the only place the vakantie
 * names appear now; the spine above shows the gaps but not the words, so removing this would lose them.
 */
export function Vakantiegat({ naam }: { naam: string }) {
  return (
    // A dashed rule rather than a filled slab: as a grey block it was heavier than the period columns it
    // separates, and next to a short column it read as a tall empty thing you might be able to plan into.
    <li className="flex w-9 shrink-0 justify-center self-stretch border-l border-dashed border-border">
      <span className="whitespace-nowrap pt-2 text-[0.6875rem] font-medium tracking-wide text-ink-zacht [writing-mode:vertical-rl]">
        {naam}
      </span>
    </li>
  );
}
