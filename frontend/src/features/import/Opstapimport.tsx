import { useId, useState } from "react";

import { Button } from "../../components/ui/button";
import { t, tAantal, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import { OPSTAP_WEIGERINGSOORT } from "./api";
import { Bestandkiezer } from "./Bestandkiezer";
import { Opstapdiff, Verdwenen } from "./Opstapdiff";
import { Opmerkingen } from "./Serverberichten";
import { Verdicten, type Verdictenpaar } from "./Verdicten";
import { useImporteerOpstap, useVoorbeeldOpstap } from "./useImport";
import type { OpstapImportAntwoord, OpstapRijProbleem } from "./types";

/**
 * The Op.stap curriculum (re-)import and its review report (E1-13 clause 6, FR-2.1/FR-2.5).
 *
 * **This is the quieter half of the page, and it says so.** It is reference-data administration (Art. VI.1), so
 * the audience is directie rather than a teacher, and it is stated in visible text. It is deliberately **not**
 * gated: the API is unauthenticated today (E6-01/E6-02, gated by E7-11) and `routes.ts` records the intent, so
 * a client-side gate would be theatre over an open endpoint.
 *
 * **Two refusals that mean opposite things, and the screen must not merge them.** The endpoint answers 409 for
 * both "the application is not ready for this file yet" (the decreed minimumdoelen are not loaded, i.e. the
 * open **E1-12**) and "this file belongs to another discipline". While E1-12 is open it is almost always the
 * first, because a real per-discipline file mixes MD and G rows and its concordance keys refuse. Rendered as a
 * row-level file fault, a directie member can only conclude that the file they just downloaded from Op.stap is
 * broken, and the next thing they do is download it again. So a refusal gets its **own** panel, headed as a
 * system state, framed by a sentence from `nl.json` saying it is not about the rows, and carrying the server's
 * Dutch `detail` — which is where the named next step lives, and the only place the missing refs or the
 * offending codes are known (Art. II.3 as amended 2026-07-30).
 *
 * **And the frame is keyed on *which* 409 it is** (`OPSTAP_WEIGERINGSOORT`, over the response's RFC 7807
 * `type`). It was not, in the first round of this story, and the result was two contradictory sentences one
 * above the other: the frame said the application could not read the file yet while the server's own `detail`
 * two lines below said to check whether the file belongs to discipline N. The two refusals have *opposite
 * owners* — one waits on E1-12, the other is fixed by the uploader in ten seconds — so one frame cannot serve
 * both, and the backend grew a discriminator rather than the screen string-matching Dutch prose.
 *
 * **The row problems are secondary, and their English stays English.** `problemen[].reden` is an operator
 * diagnostic about the *official* file: nobody using this application can fix a malformed row in a file the
 * school downloaded, which is the mirror image of the school-content importer's Dutch `melding` describing a row
 * the teacher wrote themselves. Translating it would be inventing Dutch for an audience that cannot act. So it
 * sits under a Dutch heading that says these are technical details for whoever maintains the tool, never as the
 * primary sentence, and never phrased as something the reader did wrong.
 */
/**
 * **This section is beheerder-only; the route it lives on is not** (FA §3.2, Art. VI.1).
 *
 * §3.2 has two different rows: *Leerdoelen inladen/vernieuwen (overheidsbron)* = Beheerder, and *Thema's/
 * activiteiten invoeren* = Beheerder **and** Leerkracht. `/import` carries both flows, so one flag on the route
 * cannot express it — and E1-13 originally set `magBeheerder: true` there, which would have made the first real
 * role filter (E6-02) hide the school-content import from exactly the users FR-1.1 grants it to. The route flag
 * is now `false` and the beheerder marking lives here, beside the visible sentence that says the same thing
 * (`import.opstap.publiek`), so the words and the machine-readable fact agree.
 *
 * **E6-02 gates this section, not the route.** Nothing filters on it today, for the same reason nothing filters
 * on `routes.ts`'s flag: the API is unauthenticated (E6-01, gated by E7-11), so a client-side gate over an open
 * endpoint would be theatre. This constant exists so that story has one thing to find rather than a comment to
 * interpret. Whether the *whole* import screen should instead be directie-only is a change to §3.2 and belongs
 * in the functional analysis, not in a nav flag.
 */
export const OPSTAP_SECTIE_ALLEEN_BEHEERDER = true;

export function Opstapimport() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [discipline, setDiscipline] = useState("");
  const titelId = useId();
  const disciplineId = useId();

  const voorbeeld = useVoorbeeldOpstap();
  const commit = useImporteerOpstap();

  const bezig = voorbeeld.isPending || commit.isPending;

  /**
   * Same rule as the school-content half: an outcome belongs to one file, one discipline and one run, or to
   * nothing. Called when a new run starts too, not only when an input changes — without that, `commit.data`
   * won by fixed precedence forever, so re-checking after an import fired a real preview and then threw away
   * **the FR-2.5 review report** in favour of the previous commit's panel. That report is the whole of clause 6.
   */
  function vergeetUitkomst() {
    voorbeeld.reset();
    commit.reset();
  }

  function kiesBestand(nieuw: File | null) {
    setBestand(nieuw);
    vergeetUitkomst();
  }

  function wijzigDiscipline(nieuw: string) {
    setDiscipline(nieuw);
    vergeetUitkomst();
  }

  const disciplineNummer = discipline.trim();
  const kanNakijken = Boolean(bestand) && disciplineNummer.length > 0 && !bezig;

  function kijkNa(event: React.FormEvent) {
    event.preventDefault();

    if (!bestand || disciplineNummer.length === 0) {
      return;
    }

    vergeetUitkomst();
    voorbeeld.mutate({ bestand, disciplineNummer });
  }

  function voerDoor() {
    if (!bestand || disciplineNummer.length === 0) {
      return;
    }

    commit.mutate({ bestand, disciplineNummer });
  }

  const uitkomst: OpstapImportAntwoord | undefined = commit.data ?? voorbeeld.data;
  const fout = commit.error ?? voorbeeld.error;

  // 409 is a refusal of the file as a whole rather than a fault in its rows, and it is the one that needs its
  // own frame. A 400 (an unknown discipline number, a missing or non-xlsx file) is the uploader's own request to
  // correct, so it takes the ordinary alert.
  const isWeigering = fout instanceof ApiError && fout.status === 409;
  const isAanvraagfout = fout instanceof ApiError && fout.status === 400;

  /** Nothing would be read from this file, so "Doelen inlezen" would write nothing (the E3-06 rule). */
  const nietsInTeLezen = uitkomst?.diff.overgeslagen === true;

  /**
   * Which framing sentence the refusal gets: matched on the discriminator, never defaulted to one of the two
   * specific claims.
   *
   * An unrecognised or absent `type` means *we could not tell*, and gets copy that asserts only what a 409
   * always guarantees (the file was refused as a whole, nothing changed). Defaulting to either specific frame
   * is how a proxy-replaced body, or a refusal a future story adds, would end up printing a confident sentence
   * about a cause nobody established.
   *
   * Only the generic frame states "er is niets gewijzigd", and that asymmetry is deliberate: both specific
   * refusals already say it in their own `detail` (`OpstapImportFout`), and a frame repeating the sentence
   * printed two lines under it is the duplicated prose this project's design rule cuts first. Seen on screen at
   * 1440 in the fix round's browser pass, which is the only way that kind of duplication shows up. The generic
   * frame keeps it because there may be no `detail` at all on that path.
   */
  const weigeringUitleg = ((): TranslationKey => {
    const soort = fout instanceof ApiError ? fout.type : undefined;

    if (soort === OPSTAP_WEIGERINGSOORT.ontbrekendeMinimumdoelen) {
      return "import.opstap.geweigerdSysteemUitleg";
    }

    if (soort === OPSTAP_WEIGERINGSOORT.codeInAndereDiscipline) {
      return "import.opstap.geweigerdDisciplineUitleg";
    }

    return "import.opstap.geweigerdAlgemeenUitleg";
  })();

  return (
    <section
      aria-labelledby={titelId}
      // Quieter than the school-content card by background rather than by a second accent hue: `paper-diep` is
      // the app's own recessed surface, so the dominant section keeps the raised card and this one sits back.
      className="rounded-lg border border-border bg-paper-diep p-4 sm:p-6"
    >
      <h3 id={titelId} className="text-lg font-bold text-ink">
        {t("import.opstap.titel")}
      </h3>
      {/* The audience, in visible text. Not a role gate, and not a tooltip (E3-06). */}
      <p className="mt-1 text-sm font-semibold text-ink">{t("import.opstap.publiek")}</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-zacht">
        {t("import.opstap.uitleg")}
      </p>

      {/*
        The E1-12 prerequisite, stated **before** the reader spends a discipline number and an upload on it
        (the E3-06 rule: an unbuilt destination says so in visible text). While the decreed minimumdoelen have
        no source, every real per-discipline file mixes MD and G rows and is refused with a 409, so the only
        way a beheerder learned this was by failing. The 409 panel further down stays: it is the *reactive*
        half and it names which refs are missing.

        **This notice goes when E1-12 lands** — it is a statement about the state of the data, not about the
        flow. Whoever imports the decreed minimumdoelen removes `import.opstap.voorwaarde` and this block, and
        the 409 path then becomes the rare case it should always have been.
      */}
      <p className="mt-2 max-w-2xl rounded-md border border-attentie bg-attentie-zacht px-3 py-2 text-sm leading-snug text-attentie-ink">
        {t("import.opstap.voorwaarde")}
      </p>

      {/*
        The form sits in its own `bg-card` block rather than directly on the section's recessed surface, and the
        reason is a measurement rather than taste. `--input` is documented (in `index.css`) as 3.40:1 on card and
        3.21:1 on paper, with an explicit instruction to measure both surfaces before changing it. On
        `paper-diep` it measures **3.01:1** in a real browser: it clears SC 1.4.11's 3:1 floor for a control
        boundary by one hundredth, which is the "too thin to cite as evidence later" case E7-10 recorded. Putting
        the controls back on card keeps the pairing that was actually measured, and the section stays visibly
        quieter than the school-content card above it through its recessed background and the absence of a shadow.
      */}
      <form
        onSubmit={kijkNa}
        className="mt-4 flex flex-col gap-4 rounded-md border border-border bg-card p-3.5"
      >
        <div>
          <label htmlFor={disciplineId} className="block text-sm font-semibold text-ink">
            {t("import.opstap.disciplineLabel")}
          </label>
          <p className="mt-0.5 text-xs leading-snug text-ink-zacht">
            {t("import.opstap.disciplineUitleg")}
          </p>
          <input
            id={disciplineId}
            type="text"
            value={discipline}
            disabled={bezig}
            onChange={(event) => wijzigDiscipline(event.target.value)}
            placeholder={t("import.opstap.disciplinePlaceholder")}
            // `inputMode` stays default text: a discipline number can be "9.2", which a numeric keypad on a
            // phone makes harder rather than easier.
            className="mt-1.5 h-11 w-full max-w-[10rem] rounded-md border border-input bg-card px-3 text-sm text-ink placeholder:text-ink-zacht disabled:cursor-not-allowed disabled:text-ink-zacht"
          />
        </div>

        <Bestandkiezer
          label={t("import.opstap.bestandLabel")}
          bestand={bestand}
          onKies={kiesBestand}
          disabled={bezig}
        />

        <div>
          <Button type="submit" variant="outline" disabled={!kanNakijken}>
            {voorbeeld.isPending ? t("import.opstap.nakijkenBezig") : t("import.opstap.nakijken")}
          </Button>
          <p className="mt-1.5 text-xs text-ink-zacht">{t("import.opstap.nakijkenUitleg")}</p>
        </div>
      </form>

      {/*
        The refusal panel: the file refused as a whole, kept visually and verbally apart from the row problems
        below. The server's Dutch `detail` carries the specific reason and the next step ("laad eerst de
        decretale minimumdoelen in", or "controleer of dit bestand bij discipline X hoort"); the framing sentence
        above it is ours and is chosen by `weigeringUitleg`, so it can no longer contradict the `detail` printed
        under it. The fallback exists because a body can always be replaced by a proxy.
      */}
      {isWeigering ? (
        <section
          role="alert"
          className="mt-4 rounded-md border border-attentie bg-attentie-zacht p-3.5"
        >
          <h4 className="text-sm font-semibold text-attentie-ink">
            {t("import.opstap.geweigerdTitel")}
          </h4>
          <p className="mt-1 text-sm leading-snug text-attentie-ink">{t(weigeringUitleg)}</p>
          <p className="mt-2 text-sm leading-snug text-ink">
            {(fout as ApiError).detail ?? t("import.opstap.geweigerdZonderReden")}
          </p>
        </section>
      ) : fout ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
        >
          {isAanvraagfout
            ? ((fout as ApiError).detail ?? t("import.opstap.foutAanvraagOnbekend"))
            : // "Er is niets gewijzigd" is knowable on a preview and a guess on a commit: an unparseable 200,
              // a gateway 502/504 after the save, or a dropped connection all land here after the write.
              // See `Schoolcontentimport` for the full reasoning; one string cannot serve both paths.
              t(commit.error ? "import.onbeschikbaarNaDoorvoeren" : "import.onbeschikbaar")}
        </p>
      ) : null}

      {/* Mounted empty with the section so the verdict is actually announced; holds no controls. */}
      <div role="status" className={uitkomst ? "mt-4" : undefined}>
        {uitkomst ? <Verdicten verdicten={verdicten(uitkomst)} /> : null}
      </div>

      {uitkomst ? (
        <div className="mt-3 flex flex-col gap-3">
          <Opmerkingen
            opmerkingen={uitkomst.diff.opmerkingen}
            titelEnkelvoud="import.opstap.opmerkingenTitelEnkelvoud"
            titel="import.opstap.opmerkingenTitel"
          />

          <Opstapdiff diff={uitkomst.diff} toegepast={uitkomst.toegepast} />

          <Verdwenen diff={uitkomst.diff} />

          <Rijproblemen problemen={uitkomst.problemen} />

          {uitkomst.toegepast ? (
            <p className="rounded-md bg-petrol-wash px-3.5 py-2.5 text-sm font-semibold text-petrol">
              {t("import.opstap.doorgevoerd")}
            </p>
          ) : nietsInTeLezen ? (
            // Nothing would be read (no usable rows, or the discipline is outside the configured selection), so
            // "Doelen inlezen" would write nothing and then report "De doelen zijn ingelezen" (the E3-06 rule).
            // The opmerking above already says which of the two it is.
            <p className="text-sm leading-snug text-ink-zacht">{t("import.opstap.nietsInTeLezen")}</p>
          ) : (
            <div>
              <p className="mb-1.5 text-xs leading-snug text-ink-zacht">
                {t("import.opstap.doorvoerenUitleg")}
              </p>
              <Button type="button" onClick={voerDoor} disabled={bezig}>
                {commit.isPending
                  ? t("import.opstap.doorvoerenBezig")
                  : t("import.opstap.doorvoeren")}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The two verdicts for an Op.stap run.
 *
 * The first verdict's copy is shared with the school-content half, because "were all rows readable" means the
 * same thing on both sides. The second is its own: on this side content is not "overgenomen" but *ingelezen*,
 * and a skip notice is why.
 */
function verdicten(uitkomst: OpstapImportAntwoord): Verdictenpaar {
  const aantalOpmerkingen = uitkomst.diff.opmerkingen.length;
  const gedaan = uitkomst.toegepast;

  return [
    {
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
        ? t(gedaan ? "import.opstap.volledigGoedGedaan" : "import.opstap.volledigGoedVoorbeeld")
        : aantalOpmerkingen > 0
          ? tAantal(
              aantalOpmerkingen,
              gedaan
                ? "import.opstap.volledigNotitiesGedaanEnkelvoud"
                : "import.opstap.volledigNotitiesVoorbeeldEnkelvoud",
              gedaan
                ? "import.opstap.volledigNotitiesGedaan"
                : "import.opstap.volledigNotitiesVoorbeeld",
            )
          : t(
              gedaan
                ? "import.verdict.volledigDoorProblemenGedaan"
                : "import.verdict.volledigDoorProblemenVoorbeeld",
            ),
      ernst: "waarschuwing",
    },
  ];
}

/** How many row problems are listed before the remainder becomes a count. */
const MAX_RIJPROBLEMEN = 20;

/**
 * The rows of the official file that could not be mapped, as **secondary technical detail**.
 *
 * Separate from `Serverberichten.Rijproblemen` on purpose, and not merged with it: that component renders Dutch
 * a teacher wrote and can fix, and this one renders English about a file nobody here authored. One component
 * serving both would have to lie about one of the two audiences (Art. II.3).
 *
 * Presented as information for whoever maintains the tool, in a recessed block below the review report, and
 * never as a rejection of what the reader did.
 */
function Rijproblemen({ problemen }: { problemen: readonly OpstapRijProbleem[] }) {
  if (problemen.length === 0) {
    return null;
  }

  const getoond = problemen.slice(0, MAX_RIJPROBLEMEN);
  const rest = problemen.length - getoond.length;

  return (
    <section className="rounded-md border border-border bg-card p-3.5">
      <h4 className="text-sm font-semibold text-ink">
        {tAantal(
          problemen.length,
          "import.opstap.rijproblemenTitelEnkelvoud",
          "import.opstap.rijproblemenTitel",
        )}
      </h4>
      <p className="mt-1 text-xs leading-snug text-ink-zacht">
        {t("import.opstap.rijproblemenUitleg")}
      </p>

      <ul className="mt-2 flex flex-col gap-1">
        {getoond.map((probleem, index) => (
          <li
            // A row can carry more than one problem and `code` may be null, so the index completes the key.
            key={`${probleem.rijNummer}-${probleem.code ?? ""}-${index}`}
            className="flex flex-col gap-0.5 text-xs sm:flex-row sm:gap-2"
          >
            <span className="shrink-0 font-mono font-semibold text-ink-zacht" data-cijfers>
              {t("import.rij", { nummer: probleem.rijNummer })}
              {probleem.code ? ` · ${probleem.code}` : ""}
            </span>
            {/* English, deliberately and permanently: see the component docstring. `lang` is set so a screen
                reader switches voice instead of reading English with Dutch phonemes. */}
            <span lang="en" className="min-w-0 font-mono text-ink">
              {probleem.reden}
            </span>
          </li>
        ))}
      </ul>

      {rest > 0 ? (
        <p className="mt-2 text-xs text-ink-zacht">
          {tAantal(rest, "import.nogMeerEnkelvoud", "import.nogMeer")}
        </p>
      ) : null}
    </section>
  );
}
