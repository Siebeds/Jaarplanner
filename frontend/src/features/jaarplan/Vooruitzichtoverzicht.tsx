import { t, tAantal } from "../../i18n";
import type { Dekkingsvooruitzicht } from "./types";

/**
 * What the plan would cover once the teacher accepts the proposals standing in it (E3-03, FR-5.3), inside the same
 * panel as the spreading report.
 *
 * **The one thing this block must never do is read as dekking.** A freshly generated plan covers nothing: every
 * placement is a proposal, and only a placement the teacher stands behind counts as taught (Art. IV.1/V.1). So the
 * decided figure is shown first and the ceiling second, and the sentence underneath says in words that these numbers
 * are a prospect rather than proof. Showing the ceiling alone would present the AI's proposal as coverage, which is
 * precisely what Art. V.2 forbids and what the whole accept/reject flow exists to prevent.
 *
 * **The figures are a snapshot of the moment of generation.** They come from the generation response, which nothing
 * invalidates, while `usePlanMutatie` drops the dekking cache on every placement edit — so after one acceptance the
 * live coverage line elsewhere on this screen has moved and these have not. Two coverage statements about one class,
 * disagreeing, is the E4-06 "one card says two things" defect promoted to the figure a directie reads.
 *
 * **Handling that is the panel's job, not this block's** (antagonist round 2): `Spreidingsoverzicht` withholds every
 * plan-measured block behind one notice, because the spreiding lines are just as present-tense about the plan as
 * these figures are. This component therefore renders figures or nothing, and never has to say why.
 *
 * **No verdict, no target, no percentage**, for three reasons that each belong to a different story: nothing in the
 * functional analysis defines how much coverage is enough (the same argument that keeps `Spreidingsrapport`
 * threshold-free); the dekkingspercentage belongs to E5-03 and a second one computed here could drift from it; and a
 * bar would invite a teacher to accept a plan to make a number go up.
 *
 * **The scope is named rather than counted, and that is now an owner ruling rather than this component's judgement**
 * (2026-08-06, on antagonist round 3's QUESTION). `aantalBuitenBereik` is deliberately not rendered: the obligation
 * to state how many goals a narrowed denominator leaves out sits on the screen that offers the whole-curriculum
 * switch (E5-02), and repeating the figure here without the control would be a number a teacher cannot act on.
 * Saying which jaar/fase was measured is the disclosure this panel owes, and since the kalender's own kleuterjaar
 * chooser now reaches this computation, the scope named here is the one the teacher chose. The cost the owner
 * accepted, stated so nobody has to rediscover it and stated in the form the code actually implements: **on every
 * `EigenJaarFase` class**, not only a narrowed kleutergroep, this panel prints a denominator that silently excludes
 * every other year's doelen, and says which scope it used without saying how much that leaves out. The figure itself
 * (`aantalBuitenBereik`) travels on the payload and is rendered by `Dekkingsamenvatting` on E5-02's screen, beside
 * the control that can widen it.
 */
export interface VooruitzichtoverzichtProps {
  vooruitzicht: Dekkingsvooruitzicht;
}

export function Vooruitzichtoverzicht({ vooruitzicht }: VooruitzichtoverzichtProps) {
  const {
    isBetrouwbaar,
    aantalGedekt,
    aantalMogelijkGedekt,
    aantalOnbereikbaar,
    aantalOnopgelosteVervallenPlaatsingen,
    aantalLeerplandoelen,
    gemetenJaarFasen,
    isTerugvalNaarHeelCurriculum,
  } = vooruitzicht;

  // The scope shows in every branch: it is the sentence that keeps a small denominator honest, and the branches below
  // are exactly the states where a reader most needs to know what "everything" meant. The fallback reads the FLAG
  // rather than inferring it from an empty list, so it can say why the scope is what it is (and so a test of it is
  // not a test of `gemetenJaarFasen.length` wearing a different name).
  const bereikRegel = isTerugvalNaarHeelCurriculum
    ? t("kalender.dekkingGemetenTerugval")
    : gemetenJaarFasen.length > 0
      ? t("kalender.dekkingGemeten", { fasen: gemetenJaarFasen.join(", ") })
      : t("kalender.dekkingGemetenAlles");

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
        {t("kalender.dekkingTitel")}
      </h3>

      {!isBetrouwbaar || aantalGedekt === null || aantalMogelijkGedekt === null ? (
        /* The directie ruling of 2026-07-28: while a placement points at a period that no longer exists, no figure
           is shown at all. The null checks are not defensive noise, they are what makes it impossible to render a
           total that was withheld: the server sends no number, so there is none to print. */
        <p className="mt-1.5 text-xs text-ink-zacht">
          {/* Counted and named as PLACEMENTS, which is what the server counts (antagonist round 2). A thema may sit
              in two periods, so "2 thema's staan buiten een themaperiode" would be a claim about one thema. The
              sibling `herzienTitel` says "thema's" for the same fact; that divergence is deliberate and noted on the
              story, because being right here is worth more than matching a sentence that is loose. */}
          {tAantal(
            aantalOnopgelosteVervallenPlaatsingen,
            "kalender.dekkingOnbetrouwbaarEnkelvoud",
            "kalender.dekkingOnbetrouwbaar",
            { aantal: aantalOnopgelosteVervallenPlaatsingen },
          )}
        </p>
      ) : aantalLeerplandoelen === 0 ? (
        /* 0 of 0 is "we cannot measure this class yet", never "alles gedekt" — the one reading of this state that
           would be actively misleading.

           Branched on the scope, like `bereikRegel` below it. The jaar/fase wording was borrowed from the sibling
           `geenDoelenInJaar` without the guard that makes it true there (it only renders when a jaar/fase is
           chosen), so with the whole curriculum in scope it said "voor dit jaar" directly above "gemeten tegen alle
           ingeladen leerplandoelen". */
        <p className="mt-1.5 text-xs text-ink-zacht">
          {t(gemetenJaarFasen.length > 0 ? "kalender.dekkingGeenDoelen" : "kalender.dekkingGeenDoelenAlles")}
        </p>
      ) : (
        <>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-ink" data-vooruitzicht>
            <li>
              {t("kalender.dekkingNu", { gedekt: aantalGedekt, totaal: aantalLeerplandoelen })}
            </li>

            {/* The line this block exists for, so it carries the weight. Weight rather than colour: the palette is
                spoken for by doelsoort and status (Art. XII), and a new hue here would compete with the signals the
                calendar beside it is sending.

                **"alle voorstellen" means the placements on this board, and the owner ruled the local reading
                sufficient** (2026-08-06, on antagonist round 3's QUESTION). The audit's point was real: a
                *doelsuggestie* is called a voorstel throughout this product too, and an unaccepted one does NOT raise
                this ceiling (round 1's MAJOR 1, pinned by
                `Een_nog_niet_aanvaarde_doelsuggestie_verhoogt_het_plafond_niet`). The sentence was left unqualified
                anyway rather than lengthened to "alle voorstellen op deze kalender", because it sits inside the
                generation panel on the kalender with the cards it counts directly beside it. Recorded rather than
                left implicit: this is a ruled-on ambiguity, not one nobody noticed. */}
            <li className="font-semibold">
              {t("kalender.dekkingMogelijk", {
                mogelijk: aantalMogelijkGedekt,
                totaal: aantalLeerplandoelen,
              })}
            </li>

            {/* What accepting the plan's proposals still would not reach.

                It says exactly that, and no longer says these doelen sit in no planned thema — which was false in
                the ordinary state right after AI matching, because a placed thema can carry a doel through a
                doelsuggestie nobody has accepted yet, and only accepted links count (antagonist round 1).

                Shown only when there is one, and deliberately without the attention colour the te-vol line uses:
                this is a fact about the school's own content, not something that went wrong with the run. The count
                sits at the END with no noun after it, which is the shape `catalogus.test.ts` asks for rather than a
                way around it: no Dutch noun inflects here, so there is no plural to get wrong at 1. */}
            {aantalOnbereikbaar !== null && aantalOnbereikbaar > 0 && (
              <li>{t("kalender.dekkingOnbereikbaar", { onbereikbaar: aantalOnbereikbaar })}</li>
            )}
          </ul>

          <p className="mt-2.5 text-xs italic text-ink-zacht">{t("kalender.dekkingUitleg")}</p>
        </>
      )}

      <p className="mt-1.5 text-xs text-ink-zacht">{bereikRegel}</p>
    </div>
  );
}
