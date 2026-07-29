import type { ReactNode } from "react";

import { t } from "../i18n";
import { useSchooljaren } from "./schooljaren";
import { useSelectie } from "./useSelectie";

/**
 * Choose a schooljaar and a klas (E0-10 clause 3) — the replacement for pasting a GUID into a text box,
 * which is how every screen built so far selected a class.
 *
 * **Two plain labelled selects, each in its own box.** An earlier version packed them into a single
 * bordered "one control" pill, which needed a negative margin to pull each select up under its label —
 * and that put the select's hit area 5px *on top of* the label it belonged to, stealing part of its click
 * target and clipping its descenders. The grouped look was not worth a control that misbehaves; a boring
 * field that works beats a clever one that does not.
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
    <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
      <Veld id="selectie-schooljaar" label={t("selectie.schooljaarLabel")} breedte="sm:w-40">
        <select
          id="selectie-schooljaar"
          value={gekozenSchooljaar?.id ?? ""}
          onChange={(event) => kiesSchooljaar(event.target.value)}
          className={veldKlassen}
        >
          <option value="">{t("selectie.kiesSchooljaar")}</option>
          {schooljaren.map((schooljaar) => (
            <option key={schooljaar.id} value={schooljaar.id}>
              {schooljaar.naam}
            </option>
          ))}
        </select>
      </Veld>

      <Veld id="selectie-klas" label={t("selectie.klasLabel")} breedte="sm:w-60">
        <select
          id="selectie-klas"
          value={klassen.some((klas) => klas.id === klasId) ? klasId : ""}
          onChange={(event) => kiesKlas(event.target.value)}
          disabled={klassen.length === 0}
          className={`${veldKlassen} disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-zacht`}
        >
          <option value="">{t("selectie.kiesKlas")}</option>
          {klassen.map((klas) => (
            <option key={klas.id} value={klas.id}>
              {klas.naam}
            </option>
          ))}
        </select>
      </Veld>

      {gekozenSchooljaar && klassen.length === 0 ? (
        <p className="pb-2 text-sm text-ink-zacht">{t("selectie.geenKlassen")}</p>
      ) : null}
    </div>
  );
}

// `min-w-0` keeps this from overflowing a 390px phone. With a fixed width the two selects plus their
// padding measured wider than the viewport, and because this group is the widest thing in the header its
// overflow became a horizontal scrollbar for the whole PAGE.
const veldKlassen =
  "h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm font-medium text-ink";

/** A label sitting cleanly above its control. No negative margins — that was the bug. */
function Veld({
  id,
  label,
  breedte,
  children,
}: {
  id: string;
  label: string;
  breedte: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 flex-1 ${breedte} sm:flex-none`}>
      <label className="mb-1 block text-[0.6875rem] font-medium text-ink-zacht" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
