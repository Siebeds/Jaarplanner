import { t } from "../../i18n";
import type { Dekkingsvooruitzicht } from "./types";

/**
 * What the run just proposed **would** cover once the teacher accepts it (E3-03, FR-5.3), inside the same panel as
 * the spreading report.
 *
 * **The one thing this block must never do is read as dekking.** A freshly generated plan covers nothing: every
 * placement is a proposal, and only a placement the teacher stands behind counts as taught (Art. IV.1/V.1). So the
 * decided figure is shown first and the ceiling second, and the sentence underneath says in words that these numbers
 * are a prospect rather than proof. Showing the ceiling alone would present the AI's proposal as coverage, which is
 * precisely what Art. V.2 forbids and what the whole accept/reject flow exists to prevent.
 *
 * **No verdict, no target, no percentage**, for the three reasons that each belong to a different story: nothing in
 * the functional analysis defines how much coverage is enough (the same argument that keeps `Spreidingsrapport`
 * threshold-free); the dekkingspercentage belongs to E5-03 and a second one computed here could drift from it; and a
 * bar would invite a teacher to accept a plan to make a number go up.
 *
 * **The scope is named rather than counted.** `aantalBuitenBereik` is deliberately not rendered: the obligation to
 * state how many goals a narrowed denominator leaves out sits on the screen that offers the whole-curriculum switch
 * (E5-02), and repeating the figure here without the control would be a number a teacher cannot act on. Saying which
 * jaar/fase was measured is the disclosure this panel owes.
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
    aantalLeerplandoelen,
    gemetenJaarFasen,
  } = vooruitzicht;

  // The scope always shows, in every branch: it is the sentence that keeps a small denominator honest, and the
  // branches below are exactly the states where a reader most needs to know what "everything" meant.
  const bereikRegel =
    gemetenJaarFasen.length > 0
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
        <p className="mt-1.5 text-xs text-ink-zacht">{t("kalender.dekkingOnbetrouwbaar")}</p>
      ) : aantalLeerplandoelen === 0 ? (
        /* 0 of 0 is "we cannot measure this class yet", never "alles gedekt" — the one reading of this state that
           would be actively misleading, and the reason it gets its own sentence instead of "0 van 0". */
        <p className="mt-1.5 text-xs text-ink-zacht">{t("kalender.dekkingGeenDoelen")}</p>
      ) : (
        <>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-ink" data-vooruitzicht>
            <li>
              {t("kalender.dekkingNu", { gedekt: aantalGedekt, totaal: aantalLeerplandoelen })}
            </li>

            {/* The line this block exists for, so it carries the weight. Weight rather than colour: the palette is
                spoken for by doelsoort and status (Art. XII), and a new hue here would compete with the signals the
                calendar beside it is sending. */}
            <li className="font-semibold">
              {t("kalender.dekkingMogelijk", {
                mogelijk: aantalMogelijkGedekt,
                totaal: aantalLeerplandoelen,
              })}
            </li>

            {/* The gap accepting cannot close. Shown only when there is one, and deliberately without the attention
                colour the te-vol line uses: this is a fact about the school's own thema's, not something that went
                wrong with the run.

                The count sits at the END of the sentence with no noun after it, which is the shape
                `catalogus.test.ts` asks for rather than a way around it: no Dutch noun inflects here, so there is no
                plural to get wrong at 1. */}
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
