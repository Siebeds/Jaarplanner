import { useSelectie } from "../../app/useSelectie";
import { t } from "../../i18n";
import { Jaarplankalender } from "./Jaarplankalender";
import { GENERATIEBLOKNIVEAU } from "./types";
import { useJaarplan, usePlanningsrooster } from "./useJaarplan";
import { usePeriodeselectie } from "./weekplanning/usePeriodeselectie";
import { Weekpaneel } from "./weekplanning/Weekpaneel";

/**
 * The jaarplan page (E3-06), which since E9-04 has two states: the year board, or **one period week by week**.
 *
 * The class comes from the shell's selector via the URL (E0-10, ADR-0021). Until E0-10 this page carried its own text
 * input for pasting a klas-id — the only way the kalender was reachable at all — and the page is now thin because
 * selecting a class stopped being its job.
 *
 * The empty-selection message lives in {@link Jaarplankalender}, which already renders `kalender.geenKlas` when no class
 * id is present; that copy now points at the selector above rather than at an input that no longer exists.
 *
 * **The `key` is load-bearing, not a list-rendering habit.** The klas selector lives in the shell *above* the
 * `<Outlet/>` and on the same route, so switching class changes a prop and remounts nothing. The kalender holds unsaved
 * teacher input for one class in component state (the pending generation parameters, E3-04), and a plain prop change
 * would carry class A's edit into class B's run: because a generation body *replaces* B's kept settings wholesale, that
 * would silently overwrite B's stored settings with A's. Keying on the class id makes that state die with the class it
 * belongs to, which is the only place this can be fixed once.
 *
 * **The drill-down replaces the board rather than sitting beside it or above it in a dialog** (E9-04). A teacher
 * planning a week needs the period header and their coverage on screen at the same time, which a modal would trap; and
 * `?periode=` in the URL means Back returns to the year and a link opens the period it names.
 */
export function JaarplanPagina() {
  const { klasId, schooljaarId } = useSelectie();
  const { periodeStart, openPeriode, sluitPeriode } = usePeriodeselectie();

  /**
   * Both reads are the ones the board already makes, so opening a period costs no request: TanStack serves them from the
   * same cache entries under the same keys. The tier is stated rather than left to the endpoint's default — a thema is
   * placed at `GENERATIEBLOKNIVEAU` and nothing here may assume a second one.
   *
   * **Gated on a period actually being open.** Hooks cannot be conditional, so the gate is the argument: with no
   * `?periode=` this page needs neither read, and firing them anyway would make every visit to the board depend on data
   * it does not render. `usePlanningsrooster` and `useJaarplan` both disable themselves on an empty id, so passing
   * `undefined` is the supported way to say "not yet".
   */
  const heeftPeriode = Boolean(periodeStart) && Boolean(klasId);
  const rooster = usePlanningsrooster(
    heeftPeriode ? schooljaarId || undefined : undefined,
    GENERATIEBLOKNIVEAU,
  );
  const jaarplan = useJaarplan(heeftPeriode ? klasId : "");

  // `blokken` is optional-chained as well as `data`. The server always sends it, but a partial payload would otherwise
  // throw inside render rather than degrade — and it did: six KlasKiezer tests crashed on `undefined.find` before this.
  const blok = rooster.data?.blokken?.find((kandidaat) => kandidaat.start === periodeStart);

  if (heeftPeriode) {
    /**
     * The period named in the URL is no longer a block boundary, or the grid has not arrived yet.
     *
     * The two are told apart, because a teacher acts differently on each: while the grid is loading there is nothing to
     * do but wait, and a bookmarked period the school has planned away needs the board. **Never silently redrawn to a
     * neighbouring period** — that is the silent relocation ADR-0020 and the directie ruling of 2026-07-28 forbid, and
     * the same answer the hand-placement and move paths give.
     */
    if (!blok) {
      return (
        <section className="w-full text-left">
          {rooster.isPending ? (
            <p role="status" className="text-sm text-ink-zacht">
              {t("weekplanning.laden")}
            </p>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
                {t("weekplanning.periodeOnbekend")}
              </p>
              <button
                type="button"
                onClick={sluitPeriode}
                className="rounded-md bg-petrol px-3 py-1.5 text-xs font-semibold text-petrol-foreground hover:bg-petrol-helder focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("weekplanning.terug")}
              </button>
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="w-full text-left">
        <Weekpaneel
          // Keyed on both, for the reason the board is keyed on the class: the panel holds "which week am I looking at"
          // in component state, and neither a class switch nor a period switch should carry a week across.
          key={`${klasId}-${blok.start}`}
          klasId={klasId}
          blok={blok}
          schooljaarStart={rooster.data!.start}
          schooljaarEind={rooster.data!.eind}
          // Only this period's placements. A stale one is excluded: it points at a date that is no longer any period's
          // start, so it is in no period at all and must not lend its thema to this one.
          plaatsingen={(jaarplan.data?.plaatsingen ?? []).filter(
            (plaatsing) => !plaatsing.isVervallen && plaatsing.blokStart === blok.start,
          )}
          onTerug={sluitPeriode}
        />
      </section>
    );
  }

  return (
    <section className="w-full text-left">
      <Jaarplankalender key={klasId} klasId={klasId} onOpenPeriode={openPeriode} />
    </section>
  );
}
