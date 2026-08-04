import { Link, useLocation } from "react-router-dom";

import { t, tAantal } from "../../i18n";
import { useThemaBibliotheek } from "./useThemas";

/**
 * The school-wide thema list (E1-14 over E1-11's bibliotheek, FR-3.1/3.3).
 *
 * **It reads the bibliotheek, not the full thema tree.** The bibliotheek endpoint returns only the school-wide
 * layer, so no class's subthema's can reach this list even by accident (Art. IX.2, no cross-class bleed), and
 * it carries `aantalAfgeleideKlassen` so uptake is visible without exposing what any class wrote.
 *
 * **Three numbers per row, and each one answers a question a teacher actually has:** how long the thema runs,
 * how many themadoelen anchor it (with the 2-or-3 advice when it is off), and how many classes built on it.
 * Anything else belongs on the detail.
 *
 * The advice marker is `attentie`-toned **and** carries words. Colour alone is never a signal here (Art. XII,
 * WCAG 2.2 AA), and this one especially: it is advice, not an error, so it has to read as advice.
 */
export interface ThemalijstProps {
  /** The thema currently open, so the list can mark it. */
  gekozenThemaId?: string;
}

export function Themalijst({ gekozenThemaId }: ThemalijstProps) {
  const { data: themas, isPending, isError } = useThemaBibliotheek();
  // Keeps `?klas=` and `?schooljaar=` on every link: the detail's class-scoped half reads them, and dropping
  // them here would silently reset the teacher's class the moment they open a thema.
  const { search } = useLocation();

  if (isPending) {
    return <p className="text-sm text-ink-zacht">{t("themabeheer.laden")}</p>;
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
        {t("themabeheer.fout")}
      </p>
    );
  }

  if (themas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/70 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-ink">{t("themabeheer.leegTitel")}</p>
        <p className="mt-1 text-sm text-ink-zacht">{t("themabeheer.leegUitleg")}</p>
      </div>
    );
  }

  return (
    <ul aria-label={t("themabeheer.lijstLabel")} className="flex flex-col gap-2">
      {themas.map((thema) => {
        const gekozen = thema.id === gekozenThemaId;
        const aantalDoelen = thema.themadoelen.length;

        return (
          <li key={thema.id}>
            <Link
              to={{ pathname: `/themas/${thema.id}`, search }}
              aria-current={gekozen ? "true" : undefined}
              className={[
                "block rounded-lg border bg-card px-4 py-3 shadow-card transition-colors hover:border-petrol",
                gekozen ? "border-petrol ring-1 ring-petrol" : "border-border",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-base font-semibold text-ink">{thema.naam}</span>
                <span className="shrink-0 text-xs font-medium text-ink-zacht">
                  {tAantal(thema.duurWeken, "themabeheer.duurEnkelvoud", "themabeheer.duur")}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-zacht">
                <span>
                  {aantalDoelen === 0
                    ? t("themabeheer.themadoelenGeen")
                    : tAantal(aantalDoelen, "themabeheer.themadoelenEnkelvoud", "themabeheer.themadoelen")}
                </span>

                {/* The server's own answer to the guideline (`heeftVoldoendeThemadoelen`), rendered as advice.
                    Never a block: Art. IX.2's 2 to 3 is pedagogical, and E1-14 requires it surfaced rather
                    than enforced. */}
                {thema.heeftVoldoendeThemadoelen ? null : (
                  <span className="rounded-sm bg-attentie-zacht px-1.5 py-0.5 font-semibold text-attentie-ink">
                    {t("themabeheer.adviesKort")}
                  </span>
                )}

                <span>
                  {thema.aantalAfgeleideKlassen === 0
                    ? t("themabeheer.klassenGeen")
                    : tAantal(
                        thema.aantalAfgeleideKlassen,
                        "themabeheer.klassenEnkelvoud",
                        "themabeheer.klassen",
                      )}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
