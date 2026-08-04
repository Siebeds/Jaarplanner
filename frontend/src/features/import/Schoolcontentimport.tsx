import { useId, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { t, tAantal, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import { SJABLOON_URL } from "./api";
import { Bestandkiezer } from "./Bestandkiezer";
import { Schoolcontentdiff } from "./Schoolcontentdiff";
import { Opmerkingen, Rijproblemen } from "./Serverberichten";
import { Verdicten, type Verdictenpaar } from "./Verdicten";
import { useImporteerSchoolcontent, useVoorbeeldSchoolcontent } from "./useImport";
import type {
  BedreigdeBeslissing,
  KoppelingNiveau,
  SchoolcontentImportAntwoord,
  SchoolcontentImportModus,
} from "./types";

/**
 * The teacher-facing school-content import (E1-13 clauses 1–5, FR-1.1…1.5).
 *
 * **The result dominates, not the form.** The form is used for two seconds and the verdict is read for
 * minutes, so the upload controls are one compact block and everything below them is the answer. A large
 * upload hero with a small outcome beneath it would give the most space to the least information.
 *
 * **Two verdicts, never one.** See `Verdicten`: `isBestandGeldig` (it parsed) and `isVolledigVerwerkt`
 * (nothing was dropped) are separate truths, and a file that parses perfectly while silently discarding a
 * typo'd goal code has to read as a warning rather than as a success (clause 3).
 *
 * **The destructive choice lives in the result, not in the form** (clause 5, Art. IV.2). Only a preview knows
 * that, say, four teacher decisions are threatened, so offering "discard them" beside the file picker would be
 * offering a control whose consequence is unknown. It is rendered only when there is something to discard,
 * unchecked, with the count and the consequence in its own label, directly above the commit button. Unchecked
 * means the decisions survive, which is also the server's default: the flag is never pre-ticked.
 *
 * **Staleness is the defect this component is shaped around.** A commit button may only exist for a preview of
 * *this* file in *this* mode. Changing either drops the preview outright rather than leaving it on screen next
 * to a button that would do something else, and both inputs are frozen while a request is in flight so an
 * answer can never arrive for inputs that have since changed. That is E3-04's audit finding 1 and E1-16's
 * finding 1 in a new flow, and it is the most likely way this screen would ship a lie.
 *
 * **The sjabloon is a plain link** (FR-1.5). `GET …/sjabloon` answers a binary `.xlsx` with its own filename;
 * an `<a href download>` hands that to the browser's own download machinery, which a fetch-and-blob detour
 * would only re-implement.
 */
export function Schoolcontentimport() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [modus, setModus] = useState<SchoolcontentImportModus>("Toevoegen");
  const [beslissingenVerwijderen, setBeslissingenVerwijderen] = useState(false);
  const titelId = useId();

  const voorbeeld = useVoorbeeldSchoolcontent();
  const commit = useImporteerSchoolcontent();

  const bezig = voorbeeld.isPending || commit.isPending;

  // The committed result wins over the preview: it is what actually happened. `kijkNa` clears the commit
  // first, so this precedence only ever chooses between a commit and the preview it came from.
  const uitkomst: SchoolcontentImportAntwoord | undefined = commit.data ?? voorbeeld.data;
  const fout = commit.error ?? voorbeeld.error;

  /**
   * The threatened decisions **currently on screen** (Art. IV.2).
   *
   * One value feeds both the panel and the wire, so the destructive flag cannot travel while nothing on screen
   * represents it. Resetting the checkbox in `kijkNa` alone would not be enough: the reader ticks the box, the
   * threatened set becomes empty between two runs (a second tab, another teacher; FR-10 makes this app
   * explicitly multi-user), the panel unmounts, and a flag ticked for a list that no longer exists would still
   * be sent. The test-runner destroyed two `Aanvaard` themadoelen exactly that way. Both halves are needed:
   * either one alone leaves the hole open.
   */
  const bedreigdeBeslissingen: readonly BedreigdeBeslissing[] =
    uitkomst && !uitkomst.toegepast ? uitkomst.diff.bedreigdeBeslissingen : [];
  const magVerwijderen = beslissingenVerwijderen && bedreigdeBeslissingen.length > 0;

  /**
   * Nothing in this file would be read, so a commit would write nothing (the E3-06 rule: never ship a control
   * that does nothing). The server sets `overgeslagen` when it found no usable rows at all; a file that is
   * merely *unchanged* is a different thing and stays committable, because re-importing an unchanged file is a
   * legitimate no-op the diff already describes in words.
   */
  const nietsDoorTeVoeren = uitkomst?.diff.overgeslagen === true;

  /**
   * Forget the outcome on screen, because it no longer describes what the reader is looking at.
   *
   * Dropping it beats keeping it: an outcome belongs to one file in one mode in one run, and a screen that
   * shows last file's diff above a button that would import this file is asserting something it cannot know.
   * The opt-in resets too, since it counts a list of threatened decisions that no longer exists.
   *
   * **Called on a new run as well as on a changed input**, which is the fix for the defect this component
   * shipped with: `commit.data` used to win over `voorbeeld.data` by fixed precedence and was never cleared,
   * so after an import the form stayed enabled, *Bestand nakijken* fired a real preview, and the answer was
   * discarded in favour of the previous commit's past-tense panel. Choosing "drop everything when a run
   * starts" over "compare which mutation answered last" is deliberate: the invariant becomes *at most one
   * run's outcome is ever on screen, and it is the run the reader last asked for*, held in one function,
   * rather than a precedence rule every future reader has to re-derive correctly.
   *
   * **The loss this causes is ruled and accepted, not overlooked (owner, 2026-08-03).** Clearing before the new
   * run answers means a report the reader still needed — the Art. IV.2 panel here, the FR-2.5 `verdwenen` report
   * on the Op.stap half — is gone for good if the second call fails. That was weighed against a screen that
   * keeps showing another run's report, and this side was chosen. Do not reinstate a recency rule to "fix" it.
   */
  function vergeetUitkomst() {
    voorbeeld.reset();
    commit.reset();
    setBeslissingenVerwijderen(false);
  }

  function kiesBestand(nieuw: File | null) {
    setBestand(nieuw);
    vergeetUitkomst();
  }

  function kiesModus(nieuw: SchoolcontentImportModus) {
    setModus(nieuw);
    vergeetUitkomst();
  }

  function kijkNa(event: React.FormEvent) {
    event.preventDefault();

    if (!bestand) {
      return;
    }

    // A new run starts from nothing on screen, including after a commit: see `vergeetUitkomst`.
    vergeetUitkomst();

    // The preview always reads the file non-destructively, whatever the checkbox below says. With the flag on,
    // the server discards the threatened links instead of reporting them, so `bedreigdeBeslissingen` would come
    // back empty and the preview could no longer state what is at stake. See `SchoolcontentInvoer`.
    voorbeeld.mutate({ bestand, modus, menselijkeBeslissingenVerwijderen: false });
  }

  function voerDoor() {
    if (!bestand) {
      return;
    }

    commit.mutate({ bestand, modus, menselijkeBeslissingenVerwijderen: magVerwijderen });
  }

  return (
    <section
      aria-labelledby={titelId}
      className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
    >
      <h3 id={titelId} className="text-lg font-bold text-ink">
        {t("import.schoolcontent.titel")}
      </h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-zacht">
        {t("import.schoolcontent.uitleg")}
      </p>

      {/* FR-1.5, above the picker because it is what you need *before* you have a file to pick. Not a Button
          with an onClick: a download is a navigation, so it stays an anchor and keeps middle-click, "save
          link as" and the browser's own progress. */}
      <p className="mt-3 text-sm">
        <a
          href={SJABLOON_URL}
          download
          className="font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
        >
          {t("import.schoolcontent.sjabloon")}
        </a>{" "}
        <span className="text-ink-zacht">{t("import.schoolcontent.sjabloonUitleg")}</span>
      </p>

      <form onSubmit={kijkNa} className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
        <Bestandkiezer
          label={t("import.schoolcontent.bestandLabel")}
          bestand={bestand}
          onKies={kiesBestand}
          // Frozen while a request is in flight, so an answer can never land for a file that has since
          // changed. `reset()` detaches this component from the running mutation, but not letting the race
          // start is the property worth having rather than relying on that.
          disabled={bezig}
        />

        <fieldset disabled={bezig} className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-ink">
            {t("import.schoolcontent.modusLabel")}
          </legend>

          {/*
            `Toevoegen` is pre-selected, which is a deliberate departure from E3-04's "no pre-selected answer"
            rule rather than an oversight. There, the default was the outcome with no signal at all, so
            defaulting it would have been a control that silently did nothing. Here the default is the
            non-destructive option *and* the server's own default, and on a first-ever import the two modes do
            exactly the same thing, which makes the question meaningless to ask before anything exists. What
            the rule does still bind is the labels: each option states what it does to content that already
            exists, in its own label, so the choice is legible without prose above it.
          */}
          {(
            [
              ["Toevoegen", "import.schoolcontent.modusToevoegen"],
              ["Bijwerken", "import.schoolcontent.modusBijwerken"],
            ] as const satisfies readonly (readonly [SchoolcontentImportModus, TranslationKey])[]
          ).map(([waarde, labelKey]) => (
            <label key={waarde} className="flex items-start gap-2.5 text-sm text-ink">
              <input
                type="radio"
                name="schoolcontent-modus"
                value={waarde}
                checked={modus === waarde}
                onChange={() => kiesModus(waarde)}
                className="mt-1 shrink-0"
              />
              <span className="leading-snug">{t(labelKey)}</span>
            </label>
          ))}
        </fieldset>

        <div>
          <Button type="submit" disabled={!bestand || bezig}>
            {voorbeeld.isPending
              ? t("import.schoolcontent.nakijkenBezig")
              : t("import.schoolcontent.nakijken")}
          </Button>
          <p className="mt-1.5 text-xs text-ink-zacht">
            {t("import.schoolcontent.nakijkenUitleg")}
          </p>
        </div>
      </form>

      {/*
        Branching on the status, never on `isError` alone. A 400 is the uploader's to fix and the server's Dutch
        `detail` is the only place the specific reason lives (no file, not an .xlsx, an unreadable workbook);
        anything else is the tool being broken, and telling a teacher to check their file for that would send
        them into a fix they cannot make. The fallback exists because a `detail` can always be absent: a proxy
        can replace any body (see `apiFetch`).

        **The copy differs by path, because "er is niets gewijzigd" is only knowable on one of them.** On a
        preview it is trivially true. On a commit it is a guess: a 200 whose body cannot be parsed (which
        `apiFetch` raises as a `SyntaxError`, not an `ApiError`), a gateway 502/504 arriving after the save, or a
        dropped connection all land here *after* the write happened. With the Art. IV.2 opt-in ticked that
        sentence would tell a teacher nothing changed while their aanvaard/manueel decisions had just been
        discarded. A 400 keeps one string for both paths, because request validation runs before any write.
      */}
      {fout ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
        >
          {fout instanceof ApiError && fout.status === 400
            ? (fout.detail ?? t("import.schoolcontent.foutBestandOnbekend"))
            : t(commit.error ? "import.onbeschikbaarNaDoorvoeren" : "import.onbeschikbaar")}
        </p>
      ) : null}

      {/*
        The live region is mounted **empty, with the section**, and filled when a run finishes: a
        `role="status"` element that enters the DOM already populated is frequently not announced at all, which
        would silence the entire verdict. It wraps `Verdicten` and nothing else, because `Verdicten` holds no
        interactive elements — a live region around the commit button and the opt-in would re-announce the whole
        outcome on every keystroke and every tick, which is exactly why E3-07 restructured `TeHerzien`.
      */}
      <div role="status" className={uitkomst ? "mt-4" : undefined}>
        {uitkomst ? <Verdicten verdicten={verdicten(uitkomst)} /> : null}
      </div>

      {uitkomst ? (
        <div className="mt-3 flex flex-col gap-3">
          <Rijproblemen problemen={uitkomst.problemen} />

          <Opmerkingen
            opmerkingen={uitkomst.diff.opmerkingen}
            titelEnkelvoud="import.schoolcontent.opmerkingenTitelEnkelvoud"
            titel="import.schoolcontent.opmerkingenTitel"
          />

          <Schoolcontentdiff diff={uitkomst.diff} toegepast={uitkomst.toegepast} />

          {uitkomst.toegepast ? (
            // The commit's own answer, so this is a statement of fact rather than of intent. No commit control
            // is rendered beside it: pressing it again would be a second import of the same file.
            <p className="rounded-md bg-petrol-wash px-3.5 py-2.5 text-sm font-semibold text-petrol">
              {t("import.schoolcontent.doorgevoerd")}
            </p>
          ) : nietsDoorTeVoeren ? (
            // No commit control at all: this file yielded no usable rows, so importing it would write nothing.
            // Offering the button anyway is a control that does nothing (the E3-06 rule), and the "Import
            // doorvoeren / De import is doorgevoerd" pair would then report a successful import of nothing.
            <p className="text-sm leading-snug text-ink-zacht">
              {t("import.schoolcontent.nietsDoorTeVoeren")}
            </p>
          ) : (
            <>
              {bedreigdeBeslissingen.length > 0 ? (
                <Bedreigdebeslissingen
                  beslissingen={bedreigdeBeslissingen}
                  verwijderen={beslissingenVerwijderen}
                  onWijzig={setBeslissingenVerwijderen}
                  disabled={bezig}
                />
              ) : null}

              <div>
                {/* The consequence before the control that causes it, not after. */}
                <p className="mb-1.5 text-xs leading-snug text-ink-zacht">
                  {t("import.schoolcontent.doorvoerenUitleg")}
                </p>
                <Button type="button" onClick={voerDoor} disabled={bezig}>
                  {commit.isPending
                    ? t("import.schoolcontent.doorvoerenBezig")
                    : t("import.schoolcontent.doorvoeren")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The two verdicts for a school-content run.
 *
 * Both are always stated, each from its own field, each with its own count. `isVolledigVerwerkt` is *not*
 * derived from `isBestandGeldig` here even though the server's own definition makes the second imply the
 * first: recomputing the relationship in the UI is how the two would start disagreeing with the payload.
 *
 * **The second verdict's tense follows `toegepast`.** A preview has overwritten nothing, so telling a teacher
 * "alles is overgenomen" before they pressed doorvoeren would be the screen claiming an import that has not
 * happened. Only the *labels* are tenseless, because they are topics rather than assertions: a label that read
 * "Niets viel weg" could not head the verdict that something did.
 */
function verdicten(uitkomst: SchoolcontentImportAntwoord): Verdictenpaar {
  const aantalVerlies = uitkomst.diff.opmerkingen.length;
  const gedaan = uitkomst.toegepast;

  return [
    {
      // Parsing happened on both paths, so this verdict needs no tense at all.
      goed: uitkomst.isBestandGeldig,
      label: t("import.verdict.gelezen"),
      uitleg: uitkomst.isBestandGeldig
        ? t("import.verdict.gelezenGoed")
        : tAantal(
            uitkomst.problemen.length,
            "import.verdict.gelezenFoutEnkelvoud",
            "import.verdict.gelezenFout",
          ),
      ernst: "fout",
    },
    {
      goed: uitkomst.isVolledigVerwerkt,
      label: t("import.verdict.volledig"),
      uitleg: uitkomst.isVolledigVerwerkt
        ? t(gedaan ? "import.verdict.volledigGoedGedaan" : "import.verdict.volledigGoedVoorbeeld")
        : aantalVerlies > 0
          ? tAantal(
              aantalVerlies,
              gedaan
                ? "import.verdict.volledigVerliesGedaanEnkelvoud"
                : "import.verdict.volledigVerliesVoorbeeldEnkelvoud",
              gedaan ? "import.verdict.volledigVerliesGedaan" : "import.verdict.volledigVerliesVoorbeeld",
            )
          : // `isVolledigVerwerkt` is false whenever the file did not parse cleanly, even with no opmerkingen
            // at all: the rejected rows are themselves the content that did not land. Without this branch the
            // second verdict would read "0 stukken inhoud", which is both ungrammatical and false.
            t(
              gedaan
                ? "import.verdict.volledigDoorProblemenGedaan"
                : "import.verdict.volledigDoorProblemenVoorbeeld",
            ),
      ernst: "waarschuwing",
    },
  ];
}

/** The Dutch word for the layer a threatened link lives in (Art. IX.2). */
const NIVEAUWOORD: Record<KoppelingNiveau, TranslationKey> = {
  Themadoel: "koppelingNiveau.themadoel",
  Subdoel: "koppelingNiveau.subdoel",
  Activiteit: "koppelingNiveau.activiteit",
};

/**
 * The Art. IV.2 warning, and the one control that can override it (clause 5).
 *
 * The links listed here are the teacher's own decisions (`aanvaard`/`geweigerd`/`manueel`) that the new file
 * no longer carries. The server **keeps** them unless told otherwise, so this list describes a risk rather
 * than a loss, and the copy says so before the checkbox rather than after it.
 *
 * **The checkbox is never pre-ticked and never re-runs the preview.** Re-previewing with the flag on would come
 * back with an empty `bedreigdeBeslissingen`, which would unmount the very list the checkbox refers to: a
 * control that erases its own justification. So the preview stays the non-destructive reading and the flag
 * travels only with the commit, which is exactly what its label states.
 *
 * **A `region` with a small `status` line, not one big `alert`** — the treatment E3-07 changed `TeHerzien` to,
 * for the same reason: this block holds a form control, and a live region wrapping controls re-announces its
 * whole contents on every interaction.
 */
function Bedreigdebeslissingen({
  beslissingen,
  verwijderen,
  onWijzig,
  disabled,
}: {
  beslissingen: readonly BedreigdeBeslissing[];
  verwijderen: boolean;
  onWijzig: (verwijderen: boolean) => void;
  disabled: boolean;
}) {
  const titelId = useId();
  const keuzeId = useId();

  const titel = tAantal(
    beslissingen.length,
    "import.bedreigd.titelEnkelvoud",
    "import.bedreigd.titel",
  );

  return (
    <section
      role="region"
      aria-labelledby={titelId}
      className="rounded-md border border-attentie bg-attentie-zacht p-3.5"
    >
      <p role="status" className="sr-only">
        {titel}
      </p>
      <h4 id={titelId} className="text-sm font-semibold text-attentie-ink">
        <span aria-hidden="true">▲</span> {titel}
      </h4>
      <p className="mt-1 text-xs leading-snug text-attentie-ink">{t("import.bedreigd.uitleg")}</p>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {beslissingen.map((beslissing, index) => (
          <li
            // A code can be threatened at more than one level and on more than one piece of content, and none
            // of the three fields is unique on its own, so the index completes the key.
            key={`${beslissing.niveau}-${beslissing.contentNaam}-${beslissing.leerplandoelCode}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
          >
            <span className="font-mono text-xs font-semibold text-ink" data-cijfers>
              {beslissing.leerplandoelCode}
            </span>
            <span className="text-ink">{beslissing.contentNaam}</span>
            <span className="text-xs text-ink-zacht">{t(NIVEAUWOORD[beslissing.niveau])}</span>
            <Badge variant={statusVariant(beslissing.status)}>
              {t(`suggestieStatus.${statusVariant(beslissing.status)}`)}
            </Badge>
          </li>
        ))}
      </ul>

      <label
        htmlFor={keuzeId}
        className="mt-3 flex items-start gap-2.5 border-t border-attentie/40 pt-3 text-sm text-attentie-ink"
      >
        <input
          id={keuzeId}
          type="checkbox"
          checked={verwijderen}
          disabled={disabled}
          onChange={(event) => onWijzig(event.target.checked)}
          className="mt-1 shrink-0"
        />
        {/* The count and the consequence are in the label itself, so the control cannot be read without them. */}
        <span className="font-medium leading-snug">
          {tAantal(
            beslissingen.length,
            "import.bedreigd.verwijderEnkelvoud",
            "import.bedreigd.verwijder",
          )}
        </span>
      </label>
    </section>
  );
}

/** The status token/catalogue key for a `KoppelingStatus` as the API names it (PascalCase on the wire). */
function statusVariant(status: BedreigdeBeslissing["status"]) {
  return status.toLowerCase() as "voorgesteld" | "aanvaard" | "geweigerd" | "manueel";
}
