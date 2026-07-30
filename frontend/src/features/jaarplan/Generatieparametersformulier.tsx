import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../components/ui/button";
import { t, tAantal } from "../../i18n";
import { haalThemanamen } from "./api";
import { formatteerPeriode } from "./kalenderFormat";
import type { Generatieparameters, Planningsblok, VastMoment } from "./types";

/**
 * What the teacher sets before a generation run (E3-04, FR-5.4): which thema opens which period, and which dates
 * the school has already committed.
 *
 * **Collapsed by default, and that is the main design decision.** A teacher generates a year plan once or twice a
 * year, so a permanently-open two-list form would be the largest object on the anchor screen for a task almost
 * nobody is doing right now — against *overzichtelijk*, and against the rule that the data dominates. Generating
 * without parameters stays a single click; the form is one disclosure away and its summary says whether anything
 * is set, so it is never a surprise that a run used them.
 *
 * **Startthema's are rendered as one row per period, not as a list of names.** The server contract is positional:
 * the i-th name targets the i-th block. A bare reorderable list would leave that meaning invisible and let a
 * teacher believe they had expressed a set of preferences. Showing "Periode 1 · 1 sep – 1 okt → [thema]" makes the
 * position *be* the label, and it is the reason this form needs the derived grid rather than only the thema names.
 *
 * **The thema comes from a picker.** The server reports a name the school does not own as `onbekendeStartthemas`;
 * the cheapest way to make that case unreachable is to make mistyping impossible. A full thema-beheer screen is
 * still E1-14 — this needs only the names.
 *
 * **"Mag er een thema bij?" has no pre-selected answer**, mirroring the server, which rejects a vast moment whose
 * `blokkeertPlaatsing` is missing. Defaulting it to "yes" would produce a run identical to one with no parameters
 * at all: a control that silently does nothing, which is the one thing this project's own rule forbids outright.
 */
export interface GeneratieparametersformulierProps {
  /** The derived grid, so each startthema row can name the period it targets. */
  blokken: readonly Planningsblok[];
  /** Raised on every edit; the kalender holds the value and sends it with the run. */
  onWijzig: (parameters: Generatieparameters | undefined) => void;
  /** Disabled while a run is in flight, so parameters cannot change under a request. */
  disabled: boolean;
}

/** A vast moment mid-edit: `blokkeertPlaatsing` is undecided until the teacher picks, so it is nullable here. */
interface MomentInvoer {
  naam: string;
  datum: string;
  blokkeertPlaatsing: boolean | null;
}

const LEEG_MOMENT: MomentInvoer = { naam: "", datum: "", blokkeertPlaatsing: null };

export function Generatieparametersformulier({
  blokken,
  onWijzig,
  disabled,
}: GeneratieparametersformulierProps) {
  // Startthema per period index. A sparse map rather than an array so "period 3 only" is expressible without
  // inventing empty entries for 1 and 2 — the server drops blanks, but the UI should not have to rely on that.
  const [startthemas, setStartthemas] = useState<Record<number, string>>({});
  const [momenten, setMomenten] = useState<MomentInvoer[]>([]);
  const [open, setOpen] = useState(false);
  const titelId = useId();

  const themas = useQuery({ queryKey: ["themanamen"], queryFn: haalThemanamen });

  function meld(
    nieuweStartthemas: Record<number, string>,
    nieuweMomenten: MomentInvoer[],
  ) {
    // Only fully-answered moments are sent. A half-filled row is not an instruction yet, and sending it would
    // earn a 400 that the teacher would read as the tool being broken rather than as a row they had not finished.
    const vasteMomenten: VastMoment[] = nieuweMomenten
      .filter(
        (moment): moment is MomentInvoer & { blokkeertPlaatsing: boolean } =>
          moment.naam.trim().length > 0 &&
          moment.datum.length > 0 &&
          moment.blokkeertPlaatsing !== null,
      )
      .map((moment) => ({
        naam: moment.naam.trim(),
        datum: moment.datum,
        blokkeertPlaatsing: moment.blokkeertPlaatsing,
      }));

    // Contiguous from period 1, because the server reads position as the target block. A gap would silently
    // shift every later choice one period earlier, so a teacher who set only period 3 must not have it read
    // as period 1.
    const gewensteStartthemas: string[] = [];
    for (let i = 0; i < blokken.length; i++) {
      const keuze = nieuweStartthemas[i];
      if (!keuze) {
        break;
      }
      gewensteStartthemas.push(keuze);
    }

    const leeg = gewensteStartthemas.length === 0 && vasteMomenten.length === 0;
    onWijzig(leeg ? undefined : { gewensteStartthemas, vasteMomenten });
  }

  function kiesStartthema(index: number, naam: string) {
    const volgende = { ...startthemas };
    if (naam) {
      volgende[index] = naam;
    } else {
      // Clearing a period clears the ones after it too. The server reads position as the target block, so a
      // cleared row in the middle would truncate the list and silently drop every later choice from the request
      // while still showing it on screen. Taking them away visibly is the honest version of the same rule.
      for (const key of Object.keys(volgende)) {
        if (Number(key) >= index) {
          delete volgende[Number(key)];
        }
      }
    }

    setStartthemas(volgende);
    meld(volgende, momenten);
  }

  function wijzigMoment(index: number, wijziging: Partial<MomentInvoer>) {
    const volgende = momenten.map((moment, i) =>
      i === index ? { ...moment, ...wijziging } : moment,
    );

    setMomenten(volgende);
    meld(startthemas, volgende);
  }

  function voegMomentToe() {
    setMomenten([...momenten, { ...LEEG_MOMENT }]);
  }

  function verwijderMoment(index: number) {
    const volgende = momenten.filter((_, i) => i !== index);
    setMomenten(volgende);
    meld(startthemas, volgende);
  }

  const aantalStartthemas = Object.keys(startthemas).length;
  const aantalMomenten = momenten.filter(
    (moment) => moment.naam.trim().length > 0 && moment.datum.length > 0,
  ).length;
  const ietsIngesteld = aantalStartthemas > 0 || aantalMomenten > 0;

  const samenvatting = ietsIngesteld
    ? `(${[
        aantalStartthemas > 0 &&
          tAantal(
            aantalStartthemas,
            "parameters.samenvattingStartthemaEnkelvoud",
            "parameters.samenvattingStartthema",
          ),
        aantalMomenten > 0 &&
          tAantal(
            aantalMomenten,
            "parameters.samenvattingMomentEnkelvoud",
            "parameters.samenvattingMoment",
          ),
      ]
        .filter(Boolean)
        .join(", ")})`
    : t("parameters.samenvattingLeeg");

  // The first period without a choice. Everything after it is unreachable, because the server reads position as
  // the target block and a gap would shift every later choice one period earlier.
  const eersteOpenIndex = (() => {
    for (let i = 0; i < blokken.length; i++) {
      if (!startthemas[i]) {
        return i;
      }
    }
    return blokken.length;
  })();

  // Show the chosen rows plus ONE open row, and grow as the teacher fills them.
  //
  // Rendering all seven periods was the first version, and looking at it settled the question: six disabled
  // selects stacked under one live one is a column of dead controls for a task where a teacher realistically
  // names one or two thema's, and a disabled control reads as broken rather than as not-yet-reachable. Growing
  // the list also makes the top-to-bottom rule self-evident, so the sentence explaining it could go — prose is
  // the first thing to cut.
  const zichtbareRijen = blokken.slice(0, Math.min(eersteOpenIndex + 1, blokken.length));

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md text-sm font-semibold text-ink hover:text-petrol focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
      >
        <span aria-hidden="true" className="text-xs text-ink-zacht">
          {open ? "▾" : "▸"}
        </span>
        {t("parameters.titel")}
        {/* The summary is the reason a collapsed form is safe: a teacher can tell a parameterised run from a
            plain one without opening anything.
            Built from `tAantal` and with the zero parts omitted, not from one interpolated sentence. The first
            version printed "1 startthema's, 1 vaste momenten" — wrong Dutch for the commonest count, and the
            third time this project has shipped that exact plural bug. A count in user-facing copy goes through
            the helper. */}
        <span className="font-normal text-ink-zacht">{samenvatting}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-6" aria-labelledby={titelId}>
          <p id={titelId} className="text-xs leading-snug text-ink-zacht">
            {t("parameters.uitleg")}
          </p>

          {/* ---- Startthema's, one row per period ---- */}
          <fieldset className="flex flex-col gap-2" disabled={disabled}>
            <legend className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
              {t("parameters.startthemasTitel")}
            </legend>

            {blokken.length === 0 ? (
              <p className="text-xs text-ink-zacht">{t("parameters.geenPeriodes")}</p>
            ) : themas.isPending ? (
              <p className="text-xs text-ink-zacht">{t("parameters.themasLaden")}</p>
            ) : themas.isError ? (
              <p role="alert" className="text-xs font-medium text-suggestie-geweigerd">
                {t("parameters.themasFout")}
              </p>
            ) : themas.data.length === 0 ? (
              <p className="text-xs text-ink-zacht">{t("parameters.geenThemas")}</p>
            ) : (
              <>
                {zichtbareRijen.map((blok, index) => (
                  <label
                    key={blok.start}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                  >
                    <span className="min-w-[9.5rem] text-ink">
                      {t("parameters.periodeLabel", { ordinaal: blok.ordinaal })}{" "}
                      <span className="text-ink-zacht">
                        {formatteerPeriode(blok.start, blok.eind)}
                      </span>
                    </span>
                    <select
                      value={startthemas[index] ?? ""}
                      disabled={disabled}
                      onChange={(event) => kiesStartthema(index, event.target.value)}
                      className="h-9 min-w-[12rem] rounded-md border border-input bg-card px-2 text-xs text-ink disabled:cursor-not-allowed disabled:text-ink-zacht"
                    >
                      <option value="">{t("parameters.geenVoorkeur")}</option>
                      {themas.data.map((thema) => (
                        <option key={thema.id} value={thema.naam}>
                          {thema.naam}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}

                {/* Only worth saying once every period is named; until then the growing list says it. */}
                {eersteOpenIndex >= blokken.length && (
                  <p className="text-xs text-ink-zacht">{t("parameters.startthemasAlleGevuld")}</p>
                )}
              </>
            )}
          </fieldset>

          {/* ---- Vaste momenten ---- */}
          <fieldset className="flex flex-col gap-3" disabled={disabled}>
            <legend className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
              {t("parameters.momentenTitel")}
            </legend>

            <p className="text-xs leading-snug text-ink-zacht">{t("parameters.momentenUitleg")}</p>

            {momenten.map((moment, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-md border border-border bg-paper p-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-ink">{t("parameters.momentNaam")}</span>
                    <input
                      type="text"
                      value={moment.naam}
                      onChange={(event) => wijzigMoment(index, { naam: event.target.value })}
                      placeholder={t("parameters.momentNaamVoorbeeld")}
                      className="h-9 w-48 rounded-md border border-input bg-card px-2 text-xs text-ink placeholder:text-ink-zacht"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-ink">{t("parameters.momentDatum")}</span>
                    <input
                      type="date"
                      value={moment.datum}
                      onChange={(event) => wijzigMoment(index, { datum: event.target.value })}
                      className="h-9 rounded-md border border-input bg-card px-2 text-xs text-ink"
                    />
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => verwijderMoment(index)}
                    className="h-9 text-xs"
                  >
                    {t("parameters.momentVerwijder")}
                  </Button>
                </div>

                {/* No pre-selected answer, deliberately: see the component docstring. Radios rather than a
                    checkbox precisely because a checkbox has a default and this question must not. */}
                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <legend className="text-xs text-ink">{t("parameters.momentBlokkeert")}</legend>
                  <label className="flex items-center gap-1.5 text-xs text-ink">
                    <input
                      type="radio"
                      name={`blokkeert-${index}`}
                      checked={moment.blokkeertPlaatsing === false}
                      onChange={() => wijzigMoment(index, { blokkeertPlaatsing: false })}
                    />
                    {t("parameters.momentMagThema")}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink">
                    <input
                      type="radio"
                      name={`blokkeert-${index}`}
                      checked={moment.blokkeertPlaatsing === true}
                      onChange={() => wijzigMoment(index, { blokkeertPlaatsing: true })}
                    />
                    {t("parameters.momentGeenThema")}
                  </label>
                </fieldset>

                {/* Stated in visible text, not left to a silently-dropped row: an unanswered question means this
                    moment is not sent at all, and a teacher who typed a name and a date would otherwise have
                    every reason to think it was. */}
                {moment.blokkeertPlaatsing === null &&
                  moment.naam.trim().length > 0 &&
                  moment.datum.length > 0 && (
                    <p className="text-xs font-medium text-attentie-ink">
                      <span aria-hidden="true">▲</span> {t("parameters.momentOnbeslist")}
                    </p>
                  )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={voegMomentToe}
              className="self-start text-xs"
            >
              {t("parameters.momentToevoegen")}
            </Button>
          </fieldset>
        </div>
      )}
    </div>
  );
}
