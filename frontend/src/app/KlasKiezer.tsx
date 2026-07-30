import type { ReactNode } from "react";

import { t } from "../i18n";
import { useSchooljaren } from "./schooljaren";
import { useSelectie } from "./useSelectie";

/**
 * Choose a schooljaar and a klas (E0-10 clause 3) — the replacement for pasting a GUID into a text box,
 * which is how every screen built so far selected a class.
 *
 * **Quiet by design, after two rounds of being told it was ugly.** The first version packed both selects
 * into one bordered pill, which needed a negative margin and put each select's hit area on top of its own
 * label. The second gave each a visible label above a bordered box — correct, but it put four boxes and two
 * micro-captions in the top-right corner, which is a lot of furniture for a control you touch once a day.
 *
 * This version drops the boxes and the visible captions. The selected value *is* the label: a teacher reads
 * "2026-2027" and "L3 derde leerjaar" and knows exactly what they are, and before anything is chosen the
 * placeholder options say "Kies een schooljaar" / "Kies een klas". The `<label>`s are still there for
 * screen readers (`sr-only`), so nothing is lost programmatically — this is a visual reduction, not an
 * accessibility one. Borders appear on hover and focus, so the control still announces itself as
 * interactive when you go near it.
 *
 * Native `<select>`s rather than a Radix combobox: the lists are a handful of items for a primary school,
 * and a native select is keyboard- and screen-reader-correct on every platform, including mobile, for free
 * (NFR-2/NFR-7). Reach for the design-system component when a list needs searching.
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

  return (
    <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto">
      <Keuze id="selectie-schooljaar" label={t("selectie.schooljaarLabel")}>
        <select
          id="selectie-schooljaar"
          value={gekozenSchooljaar?.id ?? ""}
          onChange={(event) => kiesSchooljaar(event.target.value)}
          className={keuzeKlassen}
        >
          <option value="">{t("selectie.kiesSchooljaar")}</option>
          {schooljaren.map((schooljaar) => (
            <option key={schooljaar.id} value={schooljaar.id}>
              {schooljaar.naam}
            </option>
          ))}
        </select>
      </Keuze>

      <span aria-hidden="true" className="text-border">
        /
      </span>

      <Keuze id="selectie-klas" label={t("selectie.klasLabel")}>
        <select
          id="selectie-klas"
          value={klassen.some((klas) => klas.id === klasId) ? klasId : ""}
          onChange={(event) => kiesKlas(event.target.value)}
          disabled={klassen.length === 0}
          className={`${keuzeKlassen} disabled:cursor-not-allowed disabled:text-ink-zacht disabled:hover:border-transparent`}
        >
          {/* The empty-year case is stated *in* the control rather than as a sentence beside it. Dropping the
              boxes removed the room for a caption, and an earlier revision of this component simply lost the
              message — a teacher then saw a disabled dropdown with no reason given. A test caught it.

              Four inputs, four messages, deliberately not collapsed. `klassen` is empty for three different
              reasons and an earlier revision printed one sentence for all of them: it asserted "Geen klassen in
              dit schooljaar" about a schooljaar nobody had picked, on first load, which was both false and the
              first thing every teacher read. Found by opening the app, not by a test.

              The stale-bookmark case is split out on the same reasoning one level down (antagonist, E0-10
              close-out): an unresolvable `schooljaarId` in the URL is not the same event as an empty selector,
              and telling a teacher to "kies eerst een schooljaar" when their saved link named a year that has
              since been deleted asks them to redo something they believe they did, with nothing saying the link
              is dead. `gekozenSchooljaar` is falsy for both, so the raw `schooljaarId` is what distinguishes
              them. */}
          <option value="">
            {schooljaarId && !gekozenSchooljaar
              ? t("selectie.onbekendSchooljaar")
              : !gekozenSchooljaar
                ? t("selectie.eerstSchooljaar")
                : klassen.length === 0
                  ? t("selectie.geenKlassen")
                  : t("selectie.kiesKlas")}
          </option>
          {klassen.map((klas) => (
            <option key={klas.id} value={klas.id}>
              {klas.naam}
            </option>
          ))}
        </select>
      </Keuze>
    </div>
  );
}

// `appearance-none` removes the platform chevron so the control can be borderless; the chevron below
// replaces it. `min-w-0` + `max-w` keeps a long class name from pushing the header wider than a phone.
const keuzeKlassen = [
  "h-9 w-full min-w-0 max-w-[13rem] appearance-none truncate rounded-md border border-transparent",
  "bg-transparent pl-2 pr-7 text-sm font-semibold text-ink",
  "transition-colors duration-150 ease-uit hover:border-border hover:bg-card",
].join(" ");

/** A select whose value is its own label. The `<label>` stays for screen readers. */
function Keuze({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="relative min-w-0 flex-1 sm:flex-none">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-zacht"
      >
        <path d="M2 4.5 6 8.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
