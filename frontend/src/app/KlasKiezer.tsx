import { t } from "../i18n";
import { useSchooljaren } from "./schooljaren";
import { useSelectie } from "./useSelectie";

/**
 * Choose a schooljaar and a klas (E0-10 clause 3) — the replacement for pasting a GUID into a text box,
 * which is how every screen built so far selected a class.
 *
 * Two native `<select>`s rather than a Radix combobox: the lists are a handful of items for a primary
 * school, and a native select is keyboard- and screen-reader-correct on every platform for free
 * (NFR-2/NFR-7, WCAG 2.2 AA). Reach for the design-system component when the list needs searching.
 *
 * The class list comes from the chosen year's own `klassen`, so a class can never be shown under a year
 * that does not contain it (Art. IX.3). All copy from nl.json (Art. II.3).
 */
export function KlasKiezer() {
  const { data: schooljaren, isPending, isError } = useSchooljaren();
  const { schooljaarId, klasId, kiesSchooljaar, kiesKlas } = useSelectie();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">{t("selectie.laden")}</p>;
  }

  if (isError) {
    // `text-red-700` matches Jaarplankalender's error copy. There is no `destructive` token in
    // tailwind.config.js — `text-destructive` would emit no CSS and render as ordinary body text.
    return (
      <p role="alert" className="text-sm text-red-700">
        {t("selectie.fout")}
      </p>
    );
  }

  if (schooljaren.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("selectie.geenSchooljaren")}</p>;
  }

  // The URL may name a year that no longer exists (an old bookmark); then nothing is selected and the
  // teacher is asked to choose, rather than being shown a class list that belongs to nobody.
  const gekozenSchooljaar = schooljaren.find((schooljaar) => schooljaar.id === schooljaarId);
  const klassen = gekozenSchooljaar?.klassen ?? [];

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground" htmlFor="selectie-schooljaar">
          {t("selectie.schooljaarLabel")}
        </label>
        <select
          id="selectie-schooljaar"
          value={gekozenSchooljaar?.id ?? ""}
          onChange={(event) => kiesSchooljaar(event.target.value)}
          className="min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">{t("selectie.kiesSchooljaar")}</option>
          {schooljaren.map((schooljaar) => (
            <option key={schooljaar.id} value={schooljaar.id}>
              {schooljaar.naam}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground" htmlFor="selectie-klas">
          {t("selectie.klasLabel")}
        </label>
        <select
          id="selectie-klas"
          value={klassen.some((klas) => klas.id === klasId) ? klasId : ""}
          onChange={(event) => kiesKlas(event.target.value)}
          disabled={klassen.length === 0}
          className="min-w-56 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">{t("selectie.kiesKlas")}</option>
          {klassen.map((klas) => (
            <option key={klas.id} value={klas.id}>
              {klas.naam}
            </option>
          ))}
        </select>
      </div>

      {gekozenSchooljaar && klassen.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("selectie.geenKlassen")}</p>
      ) : null}
    </div>
  );
}
