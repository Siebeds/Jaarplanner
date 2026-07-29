import { t } from "../i18n";
import { useSchooljaren } from "./schooljaren";
import { useSelectie } from "./useSelectie";

/**
 * Choose a schooljaar and a klas (E0-10 clause 3) — the replacement for pasting a GUID into a text box,
 * which is how every screen built so far selected a class.
 *
 * **Presented as one control, not two fields.** "Which class am I planning?" is a single question, and
 * getting it wrong is the expensive mistake in this product — so the two selects sit in one raised
 * container reading left to right (year, then class), rather than as two stray form fields in a corner.
 *
 * Native `<select>`s rather than a Radix combobox: the lists are a handful of items for a primary school,
 * and a native select is keyboard- and screen-reader-correct on every platform, including mobile, for
 * free (NFR-2/NFR-7, WCAG 2.2 AA). Reach for the design-system component when a list needs searching.
 *
 * The class list comes from the chosen year's own `klassen`, so a class can never be shown under a year
 * that does not contain it (Art. IX.3). All copy from nl.json (Art. II.3).
 */
export function KlasKiezer() {
  const { data: schooljaren, isPending, isError } = useSchooljaren();
  const { schooljaarId, klasId, kiesSchooljaar, kiesKlas } = useSelectie();

  if (isPending) {
    return <p className="text-sm text-ink-zacht">{t("selectie.laden")}</p>;
  }

  if (isError) {
    // `text-suggestie-geweigerd` is the app's one error colour now — see the worklog note about the two
    // competing conventions this replaces.
    return (
      <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
        {t("selectie.fout")}
      </p>
    );
  }

  if (schooljaren.length === 0) {
    return <p className="text-sm text-ink-zacht">{t("selectie.geenSchooljaren")}</p>;
  }

  // The URL may name a year that no longer exists (an old bookmark); then nothing is selected and the
  // teacher is asked to choose, rather than being shown a class list that belongs to nobody.
  const gekozenSchooljaar = schooljaren.find((schooljaar) => schooljaar.id === schooljaarId);
  const klassen = gekozenSchooljaar?.klassen ?? [];

  // `min-w-0` + `w-full` is what stops this overflowing a 390px phone. With fixed `min-w` values the two
  // selects plus their padding measured wider than the viewport, which gave the whole PAGE a horizontal
  // scrollbar — the group is the widest thing in the header, so its overflow becomes everyone's.
  const veld =
    "h-9 w-full min-w-0 rounded-md border-0 bg-transparent pl-0 pr-7 text-sm font-semibold text-ink focus-visible:ring-offset-0";

  return (
    <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
      <div className="flex min-w-0 flex-1 items-stretch divide-x divide-border rounded-lg border border-border bg-card px-1 shadow-card sm:flex-none">
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1 sm:flex-none">
          <label className="text-[0.6875rem] font-medium text-ink-zacht" htmlFor="selectie-schooljaar">
            {t("selectie.schooljaarLabel")}
          </label>
          <select
            id="selectie-schooljaar"
            value={gekozenSchooljaar?.id ?? ""}
            onChange={(event) => kiesSchooljaar(event.target.value)}
            className={`${veld} -mt-1 sm:min-w-[7.5rem]`}
          >
            <option value="">{t("selectie.kiesSchooljaar")}</option>
            {schooljaren.map((schooljaar) => (
              <option key={schooljaar.id} value={schooljaar.id}>
                {schooljaar.naam}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-0 flex-[1.4] flex-col justify-center px-3 py-1 sm:flex-none">
          <label className="text-[0.6875rem] font-medium text-ink-zacht" htmlFor="selectie-klas">
            {t("selectie.klasLabel")}
          </label>
          <select
            id="selectie-klas"
            value={klassen.some((klas) => klas.id === klasId) ? klasId : ""}
            onChange={(event) => kiesKlas(event.target.value)}
            disabled={klassen.length === 0}
            className={`${veld} -mt-1 disabled:cursor-not-allowed disabled:text-ink-zacht sm:min-w-[11rem]`}
          >
            <option value="">{t("selectie.kiesKlas")}</option>
            {klassen.map((klas) => (
              <option key={klas.id} value={klas.id}>
                {klas.naam}
              </option>
            ))}
          </select>
        </div>
      </div>

      {gekozenSchooljaar && klassen.length === 0 ? (
        <p className="text-sm text-ink-zacht">{t("selectie.geenKlassen")}</p>
      ) : null}
    </div>
  );
}
