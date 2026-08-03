import { useEffect, useId, useState } from "react";

import { doelsoortBadgeSoort } from "../../components/doelsoort";
import { t } from "../../i18n";
import { actieveDimensies, zonderDimensie } from "./doelenfilter";
import type { DoelenFacetten, Doelenfilter, DoelsoortNaam } from "./types";

/**
 * The register's filters (E1-16 clause 2): one search field over code and free text, plus discipline,
 * `(domein, subdomein)`, doelsoort and jaar/fase.
 *
 * **Every option comes from the data** (`facetten`), never from a hard-coded enum. Three open Art. XIV
 * decisions live in exactly these lists: which disciplines are in scope, whether `leergebied`/Wereldoriëntatie
 * is surfaced, and whether jaar/fase reads 1K/2K/3K or JK/K2/K3. A compiled-in list would answer all three
 * silently and then disagree with the database.
 *
 * **Subdomein is nested under domein**, and disabled until a domein is chosen. Subdomein names are not
 * globally unique (Art. VII.0), so an unqualified subdomein filter would mix unrelated goals: Muzische
 * vorming repeats *Bouwstenen* under Muziek, Beeld, Drama and Dans.
 *
 * **The active filters render as removable chips with one "wis alles", and there is no prose explaining the
 * filters.** A select whose label is above it does not need a sentence telling a teacher what a select is.
 *
 * **`facetten` is optional, and that is the whole point of the degraded mode.** The option lists need the
 * server; searching, seeing which filters are active and clearing them do not. When the facets request fails
 * while a filter is active — the realistic case being a shared link like `/doelen?domein=Natuur` — the panel
 * used to disappear entirely, so a teacher saw a narrowed register with no chip, no "wis alle filters" and a
 * count line reading "2 van 2 doelen getoond" for a view they could only escape through the URL bar
 * (antagonist finding, round 2). Now the search field and the chips stay and the missing half says so.
 */
export function Doelenfilters({
  filter,
  facetten,
  onWijzig,
}: {
  filter: Doelenfilter;
  /** Absent when the facets request failed: the selects are then omitted, everything else keeps working. */
  facetten?: DoelenFacetten;
  onWijzig: (filter: Doelenfilter) => void;
}) {
  const id = useId();
  const dimensies = actieveDimensies(filter);
  const gekozenDomein = facetten?.domeinen.find((d) => d.domein === filter.domein);

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-card sm:p-4">
      <Zoekveld waarde={filter.zoek ?? ""} onZoek={(zoek) => onWijzig({ ...filter, zoek })} />

      {/*
        The attentie language, not muted grey: this is the only report of the fault now that the page-level
        alert is gone, and a grey line under a search box reads as a hint rather than as "a part of this screen
        is missing". `attentie-ink` on `attentie-zacht` measures 9.37:1 (E3-04 measured it in a browser).
      */}
      {facetten ? null : (
        <p
          role="status"
          className="mt-3 rounded-md bg-attentie-zacht px-3 py-2 text-xs font-medium text-attentie-ink"
        >
          {t("doelen.keuzelijstenOnbeschikbaar")}
        </p>
      )}

      {/*
        Five tracks at xl, so the five selects sit on one row: a 4-column grid left "Jaar of fase" alone on a
        second row, which read as a stray control rather than as part of the set. Two columns at phone width
        rather than one, because a single column made the filter panel taller than the viewport and pushed
        every doel below the fold: on a naslagwerk the data has to dominate, and the chrome was winning.

        `min-w-0` on each cell is load-bearing, not tidying. A `1fr` track is `minmax(auto, 1fr)`, and a
        `<select>`'s min-content width is its widest option, so a long option ("Nederlands en communicatie
        (50)") would stretch its track and push the grid past the viewport. That is the same blowout that
        stretched a period column to 600px of white in E3-06.
      */}
      {facetten ? (
        <div
          role="group"
          aria-label={t("doelen.filtersLabel")}
          className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 xl:grid-cols-5"
        >
          <Keuze
            id={`${id}-discipline`}
            label={t("doelen.disciplineLabel")}
            waarde={filter.discipline ?? ""}
            onKies={(discipline) => onWijzig({ ...filter, discipline: discipline || undefined })}
            opties={facetten.disciplines.map((d) => ({
              waarde: d.nummer,
              // A discipline whose `disciplines` row is missing still has to be selectable, so it falls back to
              // its number rather than vanishing from the filter (Art. III.1: we do not invent a name).
              label: t("doelen.optieMetAantal", { naam: d.naam ?? d.nummer, aantal: d.aantal }),
            }))}
          />

          <Keuze
            id={`${id}-domein`}
            label={t("doelen.domeinLabel")}
            waarde={filter.domein ?? ""}
            onKies={(domein) =>
              // Changing the domein drops the subdomein: the old one almost certainly does not exist under the
              // new domein, and if a name happens to repeat it would mean something different (Art. VII.0).
              onWijzig({ ...filter, domein: domein || undefined, subdomein: undefined })
            }
            opties={facetten.domeinen.map((d) => ({
              waarde: d.domein,
              label: t("doelen.optieMetAantal", { naam: d.domein, aantal: d.aantal }),
            }))}
          />

          <Keuze
            id={`${id}-subdomein`}
            label={t("doelen.subdomeinLabel")}
            waarde={filter.subdomein ?? ""}
            onKies={(subdomein) => onWijzig({ ...filter, subdomein: subdomein || undefined })}
            isUitgeschakeld={!gekozenDomein}
            legeOptie={gekozenDomein ? t("doelen.alleOptie") : t("doelen.eerstDomein")}
            opties={(gekozenDomein?.subdomeinen ?? []).map((s) => ({
              waarde: s.subdomein,
              label: t("doelen.optieMetAantal", { naam: s.subdomein, aantal: s.aantal }),
            }))}
          />

          <Keuze
            id={`${id}-doelsoort`}
            label={t("doelen.doelsoortLabel")}
            waarde={filter.doelsoort ?? ""}
            onKies={(waarde) =>
              onWijzig({ ...filter, doelsoort: (waarde || undefined) as DoelsoortNaam | undefined })
            }
            opties={facetten.doelsoorten.map((d) => ({
              waarde: d.doelsoort,
              label: t("doelen.optieMetAantal", {
                naam: t(`doelsoort.${badgeKey(d.doelsoort)}`),
                aantal: d.aantal,
              }),
            }))}
          />

          <Keuze
            id={`${id}-jaarfase`}
            label={t("doelen.jaarFaseLabel")}
            waarde={filter.jaarFase ?? ""}
            onKies={(jaarFase) => onWijzig({ ...filter, jaarFase: jaarFase || undefined })}
            opties={facetten.jaarFasen.map((j) => ({
              waarde: j.jaarFase,
              label: t("doelen.optieMetAantal", { naam: j.jaarFase, aantal: j.aantal }),
            }))}
          />
        </div>
      ) : null}

      {dimensies.length > 0 ? (
        <ul className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {dimensies.map((dimensie) => (
            <li key={dimensie}>
              <button
                type="button"
                onClick={() => onWijzig(zonderDimensie(filter, dimensie))}
                aria-label={t("doelen.chipVerwijder", { waarde: chipTekst(filter, dimensie, facetten) })}
                className="inline-flex items-center gap-1.5 rounded-full bg-petrol-wash px-2.5 py-1 text-xs font-medium text-petrol transition-colors duration-150 ease-uit hover:bg-petrol hover:text-petrol-foreground"
              >
                {chipTekst(filter, dimensie, facetten)}
                <span aria-hidden="true">&times;</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onWijzig({})}
              className="rounded-md px-2 py-1 text-xs font-semibold text-ink-zacht underline decoration-border underline-offset-2 transition-colors duration-150 ease-uit hover:text-ink"
            >
              {t("doelen.wisAlles")}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The search field, as a real form.
 *
 * Submitting rather than searching per keystroke is deliberate: every keystroke would be a database query
 * over thousands of rows *and* a URL write, and the URL is the shareable source of truth (ADR-0021), so a
 * ten-character code would leave ten near-identical entries behind it. A teacher looking a code up presses
 * Enter, which a `<form>` does natively.
 *
 * The local state is re-synced when the filter changes from outside (a chip removed, "wis alles", the browser
 * Back button), so the field never shows a term that is no longer filtering anything.
 */
function Zoekveld({ waarde, onZoek }: { waarde: string; onZoek: (zoek: string | undefined) => void }) {
  const id = useId();
  const [ingetypt, setIngetypt] = useState(waarde);

  useEffect(() => setIngetypt(waarde), [waarde]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onZoek(ingetypt.trim() || undefined);
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-xs font-semibold text-ink-zacht">
          {t("doelen.zoekLabel")}
        </label>
        <input
          id={id}
          type="search"
          value={ingetypt}
          onChange={(event) => setIngetypt(event.target.value)}
          placeholder={t("doelen.zoekPlaceholder")}
          className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-zacht"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-md bg-petrol px-4 py-2 text-sm font-semibold text-petrol-foreground transition-colors duration-150 ease-uit hover:bg-petrol-helder"
      >
        {t("doelen.zoeken")}
      </button>
    </form>
  );
}

/** A labelled `<select>` whose blank option means "no filter on this dimension". */
function Keuze({
  id,
  label,
  waarde,
  opties,
  onKies,
  isUitgeschakeld = false,
  legeOptie,
}: {
  id: string;
  label: string;
  waarde: string;
  opties: { waarde: string; label: string }[];
  onKies: (waarde: string) => void;
  isUitgeschakeld?: boolean;
  legeOptie?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block truncate text-xs font-semibold text-ink-zacht">
        {label}
      </label>
      <select
        id={id}
        value={waarde}
        disabled={isUitgeschakeld}
        onChange={(event) => onKies(event.target.value)}
        // `w-full` plus the cell's `min-w-0` is what keeps a long option from widening the grid track.
        className="mt-1 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm text-ink disabled:bg-muted disabled:text-ink-zacht"
      >
        <option value="">{legeOptie ?? t("doelen.alleOptie")}</option>
        {opties.map((optie) => (
          <option key={optie.waarde} value={optie.waarde}>
            {optie.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The chip's own text per dimension, so a chip says which filter it is and not just its value.
 *
 * **The discipline chip names the discipline, not its number.** The select offers "Nederlands en communicatie
 * (50)" while the chip used to read "Discipline: 1", and its remove-label read `Filter "Discipline: 1"
 * verwijderen`: for a teacher, "9.2" identifies nothing. The name is already in the facets, so the number was a
 * choice rather than a constraint. It falls back to the number when the facets are absent (the degraded mode
 * above) or when a discipline has no `disciplines` row, which is the same fallback the select makes and for the
 * same reason: Art. III.1 forbids inventing a name.
 */
function chipTekst(
  filter: Doelenfilter,
  dimensie: keyof Doelenfilter,
  facetten?: DoelenFacetten,
): string {
  const waarde = filter[dimensie] ?? "";

  switch (dimensie) {
    case "zoek":
      return t("doelen.chipZoek", { waarde });
    case "discipline":
      return t("doelen.chipDiscipline", {
        waarde: facetten?.disciplines.find((d) => d.nummer === waarde)?.naam ?? waarde,
      });
    case "domein":
      return t("doelen.chipDomein", { waarde });
    case "subdomein":
      return t("doelen.chipSubdomein", { waarde });
    case "doelsoort":
      return t("doelen.chipDoelsoort", { waarde: t(`doelsoort.${badgeKey(waarde as DoelsoortNaam)}`) });
    case "jaarFase":
      return t("doelen.chipJaarFase", { waarde });
  }
}

/**
 * The catalogue key for a doelsoort. A tiny wrapper rather than inlining the table at four call sites,
 * because the wire form ("Minimumdoel") and the catalogue key ("md") differ, and confusing them renders a
 * visible key where a Dutch label belongs.
 */
function badgeKey(doelsoort: DoelsoortNaam) {
  return doelsoortBadgeSoort[doelsoort];
}
