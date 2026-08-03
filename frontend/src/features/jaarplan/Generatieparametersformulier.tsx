import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../components/ui/button";
import { t, tAantal } from "../../i18n";
import { haalThemanamen } from "./api";
import { formatteerDatum, formatteerPeriode } from "./kalenderFormat";
import { themanamenKey, useGeneratieparameters } from "./useJaarplan";
import { GENERATIEBLOKNIVEAU } from "./types";
import type { Generatieparameters, Planningsblok, VastMoment } from "./types";

/**
 * What the teacher sets before a generation run (E3-04, FR-5.4): which thema opens which period, and which dates the
 * school has already committed.
 *
 * **The settings are kept** (owner ruling, 2026-07-30). The form loads what was last used, the teacher adjusts, and
 * generating saves the new state. There is deliberately **no separate "Bewaren" button**: the settings persist as part
 * of the generation call, so one control covers one intention, and the saved settings can never disagree with the plan
 * that was generated from them. Clearing a field and generating is how you clear a setting.
 *
 * **Collapsed by default, and that is still the main design decision.** A teacher generates a year plan once or twice a
 * year, so a permanently-open two-list form would be the largest object on the anchor screen for a task almost nobody
 * is doing right now. The summary in the trigger says what is set, so a parameterised run is never a surprise, and
 * that matters more now that the settings survive: a run can use settings the teacher entered months ago.
 *
 * **One row per period, each naming its own period, and gaps are allowed.** The wire contract keys a preference on the
 * period's **start date** (see {@link Startthemakeuze}), not on its position in the array, so "a preference for period
 * 3 only" is expressible and means exactly that. Everything the earlier positional version needed is therefore gone:
 * the growing list, the clear-cascade that wiped later periods, and the rule that a gap had to be inexpressible.
 *
 * **The thema comes from a picker.** The server reports a name the school does not own as `onbekendeStartthemas`; the
 * cheapest way to make that case rare is to make mistyping impossible. A full thema-beheer screen is still E1-14.
 *
 * **"Mag er een thema bij?" has no pre-selected answer**, mirroring the server, which rejects a vast moment whose
 * `blokkeertPlaatsing` is missing. Defaulting it to "yes" would produce a run identical to one with no parameters at
 * all: a control that silently does nothing, which is the one thing this project's own rule forbids outright.
 *
 * **Settings that failed to load are never summarised as "niets ingesteld".** The summary is the only thing a teacher
 * sees while the panel is closed, and a run with no body falls back to whatever the server has stored, so claiming
 * "nothing is set" about it can be the exact opposite of what is about to happen. While the settings are unknown the
 * summary says so, the failure is stated **outside** the collapse, and the kalender refuses to generate until they
 * arrive. That is the same rule the stranded notice already follows, applied to the case that produced it.
 *
 * **While the settings are unknown the form refuses edits too, and offers a retry instead.** Gating only the generate
 * button left every field live behind a primary action that could never fire, and worse: setting one startthema in a
 * form that failed to load would post a body that *replaces* the kept settings, silently deleting a stored blocking
 * vast moment the teacher never saw. So the whole form takes the same gate ({@link
 * GeneratieparametersformulierProps.disabled}) and the failure notice carries the one control that can end the state.
 */
/**
 * Whether the **themaperiodes a kept setting names** are known, and if not, why not (E3-08 fix round 2).
 *
 * Every claim this form makes about the kept settings — the counts in the collapsed summary, the stranded partition,
 * the rows offered for editing — rests on having the *generation* tier's grid. Round 1 expressed that as a bare
 * `niveau` string and let this component infer, so two very different situations both arrived as a silent mismatch: a
 * grid that had failed to load, and one the server answered at another tier. Neither disabled anything, and the
 * summary went on counting a stranded startthema as a valid one (MAJOR-A). An explicit state makes the two visible,
 * gives each its own sentence, and lets the caller gate the run on the same value it passes here.
 *
 * - `bekend` — the generation tier's grid is in hand; every claim below is checkable.
 * - `nietGeladen` — its fetch failed (or has not landed). A retry exists, and lives next to the generate button.
 * - `nietGelezen` — the request succeeded and came back at a tier this app does not recognise. A retry would not help.
 */
export type Periodestaat = "bekend" | "nietGeladen" | "nietGelezen";

export interface GeneratieparametersformulierProps {
  /** The class whose kept settings are loaded and saved. */
  klasId: string;
  /**
   * The **generation tier's** derived grid, so each row can name the themaperiode it targets and a stranded setting can
   * be spotted. Never the board's grid: see `periodestaat`, and the note on the call site in {@link Jaarplankalender}.
   *
   * Only read when `periodestaat === "bekend"`. A kept setting keys on the generation tier's block start dates, so
   * blocks of any other tier are not the periods these settings speak about: reading them as such would flag every
   * kept preference as stranded and offer rows the server would report as vervallen.
   *
   * **This is no longer the tier on screen** (fix round 1, finding 1). The caller hands over the generation tier's grid
   * whatever the zoom shows, because whether a stored setting still names an existing period is a fact about that tier
   * and must not change with the view: read off the board's grid, the check went silent at the fine zoom and a stranded
   * preference was promoted to a valid one in the summary. What the board shows is {@link
   * GeneratieparametersformulierProps.weergaveNiveau}, and it decides presentation only.
   */
  blokken: readonly Planningsblok[];
  /** Whether `blokken` can be trusted as the themaperiodes a kept setting names. See {@link Periodestaat}. */
  periodestaat: Periodestaat;
  /**
   * Which tier the **board** is drawing (E3-08).
   *
   * Separate from `periodestaat` on purpose: this one may not decide anything the teacher is *told* about their settings, only
   * where they are edited. At the fine zoom the period rows are withheld and `parameters.anderNiveau` points at the
   * other view instead (E3-04's obligation 1), because a row is an instruction to change something and this view is not
   * where those periods are shown. The counts, the stranded partition and the request body are identical either way.
   */
  weergaveNiveau: string;
  /**
   * Raised on every **edit**, never on load. The kalender falls back to the kept settings it loaded itself while this
   * has not fired, so an untouched form sends exactly what was saved and a form still loading sends no body at all
   * (which makes the server use the saved settings too). Reporting on load instead would have pushed parent state from
   * an effect for no gain.
   */
  onWijzig: (parameters: Generatieparameters) => void;
  /**
   * No editing: a run is in flight, **or the kept settings are unknown**, **or their periods are**.
   *
   * The second case must be the *same* gate the kalender puts on its generate button, and it is passed in rather than
   * recomputed here so the two can never disagree. Two reasons, and the first is a safety argument:
   * 1. **A body replaces the kept settings wholesale.** A teacher looking at an empty form whose settings failed to
   *    load, who sets one startthema, would silently delete a stored blocking vast moment they never saw. So an
   *    editable form here would be worse than a disabled one, not better.
   * 2. **An errored query is stale, so `refetchOnWindowFocus` retries it.** If that retry succeeded, the load effect
   *    below would overwrite whatever had been typed while `onWijzig` had already reported the old edit to the parent:
   *    the screen would show the loaded settings and the run would post the typed ones. With editing gated until the
   *    settings are known, no edit can exist for the effect to clobber.
   *
   * **This gate says nothing about a change of class.** It closes only while the settings are unknown, and a class
   * switch desyncs the parent's pending edit from the loaded settings exactly when they *are* known. That is closed by
   * the page remounting this subtree on the class id, not here.
   *
   * The one control that stays live while the settings are unknown is the alert's own *Opnieuw proberen*, because a
   * failure state with no way forward is what left the earlier version telling teachers to reload the page.
   */
  disabled: boolean;
}

/** A vast moment mid-edit: `blokkeertPlaatsing` is undecided until the teacher picks, so it is nullable here. */
interface MomentInvoer {
  naam: string;
  datum: string;
  blokkeertPlaatsing: boolean | null;
}

const LEEG_MOMENT: MomentInvoer = { naam: "", datum: "", blokkeertPlaatsing: null };

/** Matches the `Naam` column the server stores, so the only UI that writes here cannot overflow it. */
const MAX_MOMENTNAAM = 200;

export function Generatieparametersformulier({
  klasId,
  blokken,
  periodestaat,
  weergaveNiveau,
  onWijzig,
  disabled,
}: GeneratieparametersformulierProps) {
  // Keyed by the period's **start date**, which is now also the wire key and the stored key. Keying on position was
  // the earlier defect: `blokken` refetches on window focus, so a beheerder shrinking the year left a choice for a
  // period that no longer existed, and it was still sent (ADR-0020 §3).
  const [startthemas, setStartthemas] = useState<Record<string, string>>({});
  const [momenten, setMomenten] = useState<MomentInvoer[]>([]);
  const [open, setOpen] = useState(false);
  const paneelId = useId();
  const vervallenTitelId = useId();

  const instellingen = useGeneratieparameters(klasId);

  // Whether the teacher has pressed *Opnieuw proberen* on this instance.
  //
  // It exists because `refetch()` on an errored query that holds **no data** puts TanStack back to `pending` rather
  // than to "errored and fetching": its `fetch` reducer resets `status` and `error` whenever `data === undefined`. So
  // `isError` goes false the instant the retry starts, and keying the notice on `isError` alone unmounted it for the
  // whole fetch — up to ten seconds with the client's own retries and backoff — leaving a gap where the only live
  // control on the screen had been. It also made the button's `isFetching` guard unobservable: the state it described
  // could not be reached while its own button was rendered.
  //
  // Never reset, and it does not need to be: it is only ever read together with `isPending`, which stops being true
  // as soon as any load succeeds.
  const [herstelGeprobeerd, setHerstelGeprobeerd] = useState(false);

  // "The kept settings are unknown, and the teacher is entitled to a way out." Failed, or a retry of a failure still
  // in flight. Not `isFetching` on its own: that is also true of the very first load, which is not a failure.
  const instellingenOnbekend = instellingen.isError || (herstelGeprobeerd && instellingen.isPending);

  // "This form knows which themaperiodes the kept settings name." False in two ways, each with its own sentence and
  // both gating the run (see {@link Periodestaat}). Round 1's version of this line asserted in a comment that it was
  // "now false only when the *server* answered another tier", which was untrue the moment the generation-tier fetch
  // itself could fail while the board showed the other tier — and an invariant comment that does not hold is how
  // MAJOR-A stayed invisible. It is a caller-supplied state now, so this file no longer has an invariant to get wrong.
  const isGeneratieNiveau = periodestaat === "bekend";

  // Whether the BOARD is at that tier, which is a question about presentation and nothing else: the rows are offered
  // here only where those periods are the ones on screen (E3-04 obligation 1). Deliberately not folded into
  // `isGeneratieNiveau` — that conflation is finding 1: it made every claim about the settings a function of the view.
  const toontGeneratieNiveau = weergaveNiveau === GENERATIEBLOKNIVEAU;

  // Gated on `open`: the collapse is supposed to save the teacher attention, and fetching the thema list on every
  // load of the anchor screen for a panel almost nobody opens would have saved pixels and no bytes.
  const themas = useQuery({
    queryKey: themanamenKey,
    queryFn: haalThemanamen,
    enabled: open,
  });

  // The grid in date order, and empty when it is not the generation tier's grid. Rows and the stranded check both
  // derive from this one list, so a tier mismatch cannot produce either.
  const geordendeBlokken = isGeneratieNiveau
    ? [...blokken].sort((a, b) => a.start.localeCompare(b.start))
    : [];

  // Load the kept settings into the form once they arrive.
  //
  // Keyed on the query's own data identity, so a refetch that returns the same object does not clobber an edit in
  // progress; and NOT gated on the grid, because a setting whose period has since vanished must still be loaded —
  // that is precisely the one the teacher has to be told about.
  const geladen = instellingen.data;
  useEffect(() => {
    if (!geladen) {
      return;
    }

    const uitStartthemas: Record<string, string> = {};
    for (const keuze of geladen.gewensteStartthemas) {
      uitStartthemas[keuze.blokStart] = keuze.themaNaam;
    }

    setStartthemas(uitStartthemas);
    setMomenten(
      geladen.vasteMomenten.map((moment) => ({
        naam: moment.naam,
        datum: moment.datum,
        blokkeertPlaatsing: moment.blokkeertPlaatsing,
      })),
    );
  }, [geladen]);

  function meld(nieuweStartthemas: Record<string, string>, nieuweMomenten: MomentInvoer[]) {
    // Only fully-answered moments are sent. A half-filled row is not an instruction yet, and sending it would earn a
    // 400 that the teacher would read as the tool being broken rather than as a row they had not finished.
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

    // Every entry carries its own period, so no flattening and no gap rule. Ordered by date for a stable request.
    const gewensteStartthemas = Object.entries(nieuweStartthemas)
      .filter(([, themaNaam]) => themaNaam.length > 0)
      .map(([blokStart, themaNaam]) => ({ blokStart, themaNaam }))
      .sort((a, b) => a.blokStart.localeCompare(b.blokStart));

    // Always an object, never `undefined`: an empty one is how a teacher clears the kept settings, where omitting the
    // body would instead make the server reuse them.
    onWijzig({ gewensteStartthemas, vasteMomenten });
  }

  function kiesStartthema(blokStart: string, naam: string) {
    const volgende = { ...startthemas };

    if (naam) {
      volgende[blokStart] = naam;
    } else {
      delete volgende[blokStart];
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

  // A kept preference whose period no longer exists: the beheerder edited the vakantiedata after it was saved, so its
  // start date is not a period boundary any more.
  //
  // Surfaced here rather than swallowed, and NOT removed on the teacher's behalf. Directie ruled on 2026-07-28 that a
  // placement pointing at a vanished period is flagged loudly and never silently relocated; a kept parameter is the
  // same fact one layer up, and persistence is what made it reachable. The setting stays in the request, so reverting
  // the vakantie edit restores it, and the run's report says the same thing.
  // Computed only against the generation tier's grid: without it this form cannot tell a stranded setting from a
  // perfectly good one, and claiming either would be a guess (see `periodestaat`). It is deliberately **not** conditioned on
  // the zoom: the partition below counts on it, and a count that changes with the view is the defect this replaces.
  const vervallen = isGeneratieNiveau
    ? Object.entries(startthemas)
        .filter(([blokStart]) => !geordendeBlokken.some((blok) => blok.start === blokStart))
        .map(([blokStart, themaNaam]) => ({ blokStart, themaNaam }))
        .sort((a, b) => a.blokStart.localeCompare(b.blokStart))
    : [];
  const vervallenStarts = new Set(vervallen.map((keuze) => keuze.blokStart));

  // Counted from what WILL BE SENT, never from what has been typed.
  //
  // The first version counted any moment with a name and a date, ignoring the blocking question. So a teacher who
  // left that unanswered, collapsed the panel and generated saw "(1 vast moment)" while the run sent nothing and the
  // report said nothing — the summary asserting an instruction was set when it was not.
  const isVolledig = (moment: MomentInvoer) =>
    moment.naam.trim().length > 0 && moment.datum.length > 0 && moment.blokkeertPlaatsing !== null;
  const isBegonnen = (moment: MomentInvoer) =>
    moment.naam.trim().length > 0 || moment.datum.length > 0 || moment.blokkeertPlaatsing !== null;

  // Stranded preferences are excluded here, because they get their own clause below. Counting them in both made one
  // kept setting read as "(1 startthema, 1 zonder periode)" — two settings where there is one. The clauses partition
  // the set; they do not overlap.
  //
  // **The partition does not depend on the zoom** (fix round 1, finding 1). While it did, the same stranded setting was
  // reported as `(1 zonder periode)` at the coarse tier and as `(1 startthema)` at the fine one, with generation
  // enabled: a teacher whose kept startthema had been orphaned by a vakantie edit zoomed in, read that one startthema
  // was set, generated, and learned otherwise only from the run's own `vervallenStartthemas`. Hiding the stranded
  // *rows* at another tier was licensed; upgrading a stranded setting to a valid one was not.
  const aantalStartthemas = Object.entries(startthemas).filter(
    ([blokStart, naam]) => naam.length > 0 && !vervallenStarts.has(blokStart),
  ).length;
  const aantalMomenten = momenten.filter(isVolledig).length;

  // Begun but not finished, so not sent. Named separately in the summary because the warning that explains it lives
  // inside the panel, and the panel is closed by default — which is exactly how the defect above hid.
  const aantalOnvolledig = momenten.filter(
    (moment) => isBegonnen(moment) && !isVolledig(moment),
  ).length;

  const ietsIngesteld =
    aantalStartthemas > 0 || aantalMomenten > 0 || aantalOnvolledig > 0 || vervallen.length > 0;

  // While the kept settings are unknown the summary says exactly that. It must never fall through to
  // "(niets ingesteld)": a run then sends no body, the server applies whatever it has stored, and a teacher with a
  // saved blocking vast moment would have read the opposite of what happened. This is the collapsed screen's only
  // statement about the run, so it is the one that has to be true.
  const samenvattingIngesteld = ietsIngesteld
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
        aantalOnvolledig > 0 &&
          tAantal(
            aantalOnvolledig,
            "parameters.samenvattingOnvolledigEnkelvoud",
            "parameters.samenvattingOnvolledig",
          ),
        vervallen.length > 0 &&
          tAantal(
            vervallen.length,
            "parameters.samenvattingVervallenEnkelvoud",
            "parameters.samenvattingVervallen",
          ),
      ]
        .filter(Boolean)
        .join(", ")})`
    : t("parameters.samenvattingLeeg");

  // **And when the periods are unknown it says that, instead of counting** (fix round 2, MAJOR-A). Without the
  // generation tier's grid the clauses above cannot partition the kept startthema's into "will be honoured" and
  // "points at a period that no longer exists" — the whole difference between them is that grid. Round 1 let the
  // partition collapse silently, so a stranded setting was reported as `(1 startthema)`: a positive claim about a
  // preference the run would discard, on the one line a teacher sees while the panel is closed. The counts of the
  // period-independent settings (vaste momenten) go with it, because generation is refused in this state anyway and
  // half a summary invites reading the missing half as zero.
  const samenvatting = instellingen.isError
    ? t("parameters.samenvattingOnbekend")
    : instellingen.isPending
      ? t("parameters.samenvattingLaden")
      : !isGeneratieNiveau
        ? t("parameters.samenvattingPeriodesOnbekend")
        : samenvattingIngesteld;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={paneelId}
        // `flex-wrap` with the summary as its own flex item: at ~390px three summary clauses beside a wrapping label
        // produced two narrow three-line columns side by side. Wrapping puts the summary on its own line instead.
        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md text-left text-sm font-semibold text-ink hover:text-petrol focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
      >
        {/* Chevron and label are ONE flex item, non-wrapping, so the glyph cannot end up alone on a line above the
            text it belongs to. That is what happened at 390px once the outer row wrapped: the label is long enough to
            be pushed to the next line on its own, leaving the arrow floating above it. `min-w-0` lets the label wrap
            inside this wrapper instead, and `shrink-0` keeps the glyph beside its first line. */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span aria-hidden="true" className="shrink-0 text-xs text-ink-zacht">
            {open ? "▾" : "▸"}
          </span>
          <span>{t("parameters.titel")}</span>
        </span>
        {/* The summary is the reason a collapsed form is safe: a teacher can tell a parameterised run from a plain
            one without opening anything. It matters more now that the settings are kept, because the run may use
            something entered long ago. Built from `tAantal` with the zero parts omitted, not from one interpolated
            sentence: the first version printed "1 startthema's", which is the plural bug this project has shipped
            four times. */}
        <span className="font-normal text-ink-zacht">{samenvatting}</span>
      </button>

      {/* Outside the collapse, for the reason the stranded notice below is: this decides what the next run does, and a
          panel that is closed by default cannot carry that. It used to live inside the panel, where a teacher read
          "(niets ingesteld)" on the trigger while the server still held a blocking vast moment the run would apply.

          **It carries the only live control on a screen that otherwise refuses everything.** Without it the failure
          state had no way forward at all: the copy said "herlaad de pagina en probeer opnieuw", which is what
          TanStack's own three retries had already done before this notice appeared. So the remedy it prescribed was
          the one already exhausted, and the escalation sentence its sibling (`kalender.genereerOnbeschikbaar`) ends
          with was missing. Now: retry the query, and tell the teacher who to tell if it keeps failing.

          **The `alert` is the sentence, not the box.** The button is a sibling of the live region rather than a child
          of it, the same separation `TeHerzien` and the stranded notice below use: a live region wrapping a control
          re-announces its whole contents on every interaction, and pressing retry changes the button's own label. */}
      {instellingenOnbekend && (
        <div className="mt-3 rounded-md bg-suggestie-geweigerd/10 px-3 py-2.5">
          <p
            role="alert"
            className="text-xs font-medium leading-snug text-suggestie-geweigerd"
          >
            {t("parameters.instellingenFout")}
          </p>
          <Button
            type="button"
            variant="outline"
            // NOT gated on `disabled`: that prop is (among other things) "the settings are unknown", which is exactly
            // the state this button exists to leave. Gated on the fetch being in flight instead, so it cannot be
            // pressed twice into two racing refetches — and now that the notice survives the retry (see
            // `herstelGeprobeerd`), that in-flight state is something a teacher can actually see.
            disabled={instellingen.isFetching}
            onClick={() => {
              setHerstelGeprobeerd(true);
              void instellingen.refetch();
            }}
            // `border-suggestie-geweigerd` is not decoration. `variant="outline"` puts `bg-card` on the panel's
            // `suggestie-geweigerd/10` wash, and that fill carries 1.19:1 — so the border is the only thing
            // delineating the control, and SC 1.4.11 wants 3:1 for it. The default `border-input` measured 2.86:1
            // here. This token measures 5.45:1 and reuses the hue the panel already spends, so it adds no second
            // chrome accent (Art. XII).
            className="mt-2 h-7 border-suggestie-geweigerd bg-card text-xs"
          >
            {instellingen.isFetching
              ? t("parameters.instellingenOpnieuwBezig")
              : t("parameters.instellingenOpnieuw")}
          </Button>
        </div>
      )}

      {/* Also outside the collapse: a stranded setting must be visible without opening anything, since it is being sent
          and the teacher is the only one who can resolve it.
          **A labelled region with one small `status` line, not one big `alert`** — the same treatment its sibling
          `TeHerzien` was changed to in E3-07, and for the same reason: it holds a button per entry, and a live region
          wrapping controls re-announces its whole contents on every interaction. Non-dismissible either way: there is
          no close control anywhere in it (directie 2026-07-28).
          **Only where the periods it talks about are on screen** (E3-04 obligation 1): its own explanation sends the
          teacher to a row below it, and its Weghalen button is the destructive half of a pair whose other half is that
          row. The *fact* is not hidden at the other tier — the summary above still counts it as `zonder themaperiode`,
          which is what finding 1 was about, and `anderNiveau` says where to deal with it. */}
      {vervallen.length > 0 && toontGeneratieNiveau && (
        <div
          role="region"
          aria-labelledby={vervallenTitelId}
          className="mt-3 rounded-md border border-attentie bg-attentie-zacht p-3"
        >
          <p role="status" className="sr-only">
            {tAantal(
              vervallen.length,
              "parameters.vervallenTitelEnkelvoud",
              "parameters.vervallenTitel",
            )}
          </p>
          <p id={vervallenTitelId} className="text-xs font-semibold text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              vervallen.length,
              "parameters.vervallenTitelEnkelvoud",
              "parameters.vervallenTitel",
            )}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {vervallen.map((keuze) => (
              <li
                key={keuze.blokStart}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink"
              >
                <span>
                  {t("parameters.vervallenRegel", {
                    thema: keuze.themaNaam,
                    datum: formatteerDatum(keuze.blokStart),
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => kiesStartthema(keuze.blokStart, "")}
                  className="h-7 text-xs"
                >
                  {t("parameters.vervallenVerwijder")}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-attentie-ink">{t("parameters.vervallenUitleg")}</p>
        </div>
      )}

      {open && (
        <div id={paneelId} className="mt-4 flex flex-col gap-6">
          <p className="text-xs leading-snug text-ink-zacht">{t("parameters.uitleg")}</p>

          {/* ---- Startthema's, one row per period ---- */}
          <fieldset className="flex flex-col gap-2" disabled={disabled}>
            <legend className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
              {t("parameters.startthemasTitel")}
            </legend>

            {/* Three reasons the rows can be absent, and round 1 answered all three with one sentence that only fits
                the first (fix round 2, MAJOR-A and MINOR-F). `anderNiveau` says "zet de weergave op Themaperiodes",
                which is a real next step when the grid is fine and the *board* is elsewhere — and an impossible one
                when the themaperiodes are what could not be had. Sending a teacher to the view that is failing is the
                loop the audit described: a view that lies and a view that refuses. */}
            {periodestaat === "nietGeladen" ? (
              // The generation tier's grid could not be fetched. The retry for it sits above this panel, next to the
              // generate button it also disabled.
              <p className="text-xs leading-snug text-ink-zacht">
                {t("parameters.periodesNietGeladen")}
              </p>
            ) : periodestaat === "nietGelezen" ? (
              // It arrived at a tier this app does not recognise, so these blocks are not the periods a kept setting
              // names and rows built from them would carry dates the server refuses. Nothing to retry.
              <p className="text-xs leading-snug text-ink-zacht">
                {t("parameters.periodesNietGelezen")}
              </p>
            ) : !toontGeneratieNiveau ? (
              // The grid is fine; the kalender is simply showing another tier, so a row here would be an instruction
              // about periods the teacher cannot see. It points at the view where they are, and states what happens to
              // the current settings meanwhile.
              <p className="text-xs leading-snug text-ink-zacht">{t("parameters.anderNiveau")}</p>
            ) : blokken.length === 0 ? (
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
              // Every period, every row live and independent. The earlier version showed one row that grew, because
              // the positional contract made a gap unexpressible; with a date key a gap simply means "no
              // preference", so there is nothing left to prevent and no disabled control to explain.
              geordendeBlokken.map((blok) => (
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
                    value={startthemas[blok.start] ?? ""}
                    disabled={disabled}
                    onChange={(event) => kiesStartthema(blok.start, event.target.value)}
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
              ))
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
                  {/* The `disabled:` variants are not cosmetic. These two are gated by the enclosing fieldset, but an
                      author-set `background-color` and `color` override the UA's own disabled rendering, so without
                      them a dead field looks exactly like a live one. That was tolerable while `disabled` only meant
                      "a run is in flight" for a few seconds; it now also means "the kept settings failed to load", a
                      state a teacher can sit in and type at. Same treatment as the startthema select above. */}
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-ink">{t("parameters.momentNaam")}</span>
                    <input
                      type="text"
                      value={moment.naam}
                      maxLength={MAX_MOMENTNAAM}
                      onChange={(event) => wijzigMoment(index, { naam: event.target.value })}
                      placeholder={t("parameters.momentNaamVoorbeeld")}
                      className="h-9 w-48 rounded-md border border-input bg-card px-2 text-xs text-ink placeholder:text-ink-zacht disabled:cursor-not-allowed disabled:text-ink-zacht"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-ink">{t("parameters.momentDatum")}</span>
                    <input
                      type="date"
                      value={moment.datum}
                      onChange={(event) => wijzigMoment(index, { datum: event.target.value })}
                      className="h-9 rounded-md border border-input bg-card px-2 text-xs text-ink disabled:cursor-not-allowed disabled:text-ink-zacht"
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

                {/* No pre-selected answer, deliberately: see the component docstring. Radios rather than a checkbox
                    precisely because a checkbox has a default and this question must not. */}
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
                    moment is not sent at all, and a teacher who typed a name and a date would otherwise have every
                    reason to think it was. */}
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
