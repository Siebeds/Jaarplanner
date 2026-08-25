import { Link } from "react-router-dom";
import { IcoonPijlRechts } from "../../components/Iconen";
import { useDekkingsvoortgang } from "../../lib/queries";
import { t } from "../../i18n";

/**
 * How much of this class's curriculum the plan covers, as one line above the agenda.
 *
 * Deliberately small. The agenda is where a teacher plans a week, and coverage is the question they
 * are eventually judged on but almost never the question in front of them: it belongs here as a
 * reminder they can act on, not as a dashboard that competes with the calendar.
 *
 * It reads the counts-only endpoint, which the server computes through the same service and the same
 * scope rules as the dekkingsoverzicht itself. So the bar and the screen it links to are one number
 * rendered twice.
 *
 * `EigenJaarFase` because that is the dekkingsoverzicht's own default. A bar measuring one scope and
 * a screen opening on another would show a teacher two different fractions for the same plan, one
 * click apart.
 */
export function Dekkingsbalk({ klasId }: { klasId: string | null }) {
  const { data, isPending } = useDekkingsvoortgang(klasId, "EigenJaarFase");

  if (!klasId) return null;

  // Withheld together with `aantalMogelijkGedekt` while a placement is stale, and then no fraction is
  // drawn at all: a bar is read as a proportion whatever is written beside it, so an unsound figure
  // has to be absent rather than annotated. The row itself stays, because the screen it links to is
  // where the reason for the blank is spelled out.
  const meetbaar = !isPending && data !== undefined && data.aantalGedekt !== null && data.isBetrouwbaar && data.aantalLeerplandoelen > 0;
  const deel = meetbaar ? (data.aantalGedekt ?? 0) / data.aantalLeerplandoelen : 0;

  /**
   * WHICH JAAR/FASEN THIS FRACTION IS ABOUT, printed beside it.
   *
   * The bar used to say "0/1288" and nothing else, and a teacher who had just linked three doelen read that as the
   * app losing their work. The doelen were linked and counted; they carried a fase this class is not measured against,
   * so they sat in `aantalBuitenBereik`. A denominator without its scope cannot be argued with, which is what made
   * the zero look like a defect instead of an answer.
   */
  const fasen = meetbaar ? data.gemetenJaarFasen : [];
  const buiten = meetbaar ? data.aantalBuitenBereik : 0;

  return (
    <Link
      to="/dekking"
      aria-label={
        !meetbaar
          ? t("dekking.balkAriaGeenCijfer")
          : buiten > 0
            ? // The out-of-scope count is spoken but not printed. It is the answer to "why is this zero
              // when I just linked something", and it belongs in the sentence rather than on a bar that
              // exists to stay out of the way. The screen this links to prints it in full.
              t("dekking.balkAriaBereik", {
                gedekt: data.aantalGedekt ?? 0,
                totaal: data.aantalLeerplandoelen,
                fasen: data.gemetenJaarFasen.join(", "),
                buiten,
              })
            : t("dekking.balkAria", { gedekt: data.aantalGedekt ?? 0, totaal: data.aantalLeerplandoelen })
      }
      className="group -mx-1 flex items-center gap-3 rounded-veld px-1 py-2 transition-colors duration-150 hover:bg-vlak-diep"
    >
      <span className="shrink-0 text-micro uppercase text-inkt-zwak transition-colors duration-150 group-hover:text-inkt-zacht">
        {t("dekking.titel")}
      </span>

      {/* The track is `lijn` rather than `vlak-diep`, which is also the row's hover fill: a track that
          disappears the moment the pointer arrives is a track that looks broken on the way in. */}
      <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-lijn">
        <span
          style={{ width: `${Math.round(deel * 100)}%` }}
          className="block h-full rounded-full bg-dekking-gedekt transition-[width] duration-300"
        />
      </span>

      {isPending ? null : meetbaar ? (
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className="mono text-[0.6875rem] text-inkt-zacht">
            {data.aantalGedekt}
            <span className="text-inkt-zwak">/{data.aantalLeerplandoelen}</span>
          </span>
          {/* Only when the class actually has a scope. A graadklas whose jaar/fase cannot be derived is
              measured against the whole curriculum, and "van " with nothing after it would be worse than
              silence. Hidden on a phone, where the row is already four elements wide. */}
          {fasen.length > 0 ? (
            <span className="hidden text-[0.6875rem] text-inkt-zwak sm:inline">
              {t("dekking.balkFasen", { fasen: fasen.join(", ") })}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="shrink-0 text-[0.6875rem] text-inkt-zacht">{t("dekking.geenCijfer")}</span>
      )}

      <IcoonPijlRechts
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-inkt-zwak transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
