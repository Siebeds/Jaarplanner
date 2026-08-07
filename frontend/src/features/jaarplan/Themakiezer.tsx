import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { t } from "../../i18n";
import { ApiError } from "../../lib/api";
import { Foutmelding } from "./Themakaart";
import { formatteerOrdinalen } from "./kalenderFormat";
import type { Planningsblok } from "./types";
import { useThemanamen, useVoegPlaatsingToe } from "./useJaarplan";

export interface ThemakiezerProps {
  /** The class whose plan is being edited. */
  klasId: string;
  /** The period this control plans into. Its ordinal names the action; its start date is what gets sent. */
  blok: Planningsblok;
  /**
   * Which coarse periods each thema already occupies, by thema id, from `themaPeriodeOrdinalen`.
   *
   * Passed in rather than derived here because only the board holds the whole plan: a column knows its own
   * placements and nothing about the other eleven periods. Two things are built from it, and the second is the
   * reason it exists at all: the *"staat al in themaperiode 3"* annotation, and **disabling** the thema that is
   * already in **this** period, which the server refuses with a 400.
   *
   * *Disabling rather than omitting, since fix round 1.* Omitting it left the one confusing case silent: a teacher
   * looking at a rejected card for that thema in this very column opened the picker and found it simply absent.
   */
  alGeplaatst: ReadonlyMap<string, readonly number[]>;
}

/**
 * Puts an existing thema into one period, by hand and with no AI involved (E4-03, FR-7.2).
 *
 * **What was missing, since it explains the shape.** `Jaarplan.VoegPlaatsingToe` had exactly two callers on the
 * server, plan generation and the demo seeder, so the only way a thema ever entered a jaarplan was an AI run.
 * Moving, removing, accepting, rejecting and locking a placement all existed; *adding* one did not, which made
 * FR-7.2's "a fully hand-built plan is possible" impossible as written. This is that missing verb.
 *
 * **A native `<select>`, matching the period picker in {@link Themakaart} rather than inventing a second answer.**
 * The component library here holds a Badge and a Button and no Dialog (ADR-0017: copied in, nothing at runtime), so
 * a modal would mean owning a focus trap on the anchor screen. The platform control is already correct on touch,
 * by keyboard and to a screen reader, it type-aheads through a long list so no filter field is needed, and it is
 * what a teacher on this screen has already used once. Chosen for that, not for lack of ambition.
 *
 * **Inline in the column, not centred over the board.** The period is the one piece of context the choice depends
 * on, and it is written directly above this control in the column heading. A dialog would cover the board to ask a
 * question the board was answering.
 *
 * **Every state that cannot lead anywhere says so in words** (the E3-06 rule). A school with no thema's, a library
 * that failed to load, and a period that already holds every thema the school has are three different dead ends,
 * and each gets its own sentence instead of an empty picker or a button that can never enable.
 */
export function Themakiezer({ klasId, blok, alGeplaatst }: ThemakiezerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [keuze, setKeuze] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);

  // Gated on `open`, like the startthema picker it shares a cache entry with: the board draws up to a dozen of these
  // and a teacher opens at most one, so fetching on render would spend a request per column on nothing.
  const themas = useThemanamen(open);
  const toevoegen = useVoegPlaatsingToe(klasId);

  function sluit() {
    setOpen(false);
    setKeuze("");
    toevoegen.reset();
  }

  /**
   * Returns focus to the trigger once the panel has actually closed.
   *
   * **Not called from `sluit()`, and that is the whole point.** It was, and it silently did nothing: `setOpen(false)`
   * is batched, so at the moment `sluit()` ran the trigger was still unmounted and `trigger.current` was null. Focus
   * fell to `<body>`, and a keyboard user pressing "Annuleren" lost their place on a board that scrolls sideways —
   * exactly what the comment there claimed to prevent. **No test caught it; it was measured in a browser**, which is
   * this project's standing argument for looking at the thing.
   *
   * Guarded on the previous value so it only fires on a real open → closed transition. Without that it would run on
   * mount and every period column on the board would grab focus in turn as the plan renders.
   */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      trigger.current?.focus();
    }

    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <Button
        ref={trigger}
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        // Every period column renders one of these, so the visible label alone would give the page a dozen controls
        // called "Thema toevoegen" that each do something different (SC 2.4.6, and the same fix E1-14 made for its
        // per-subthema "Nieuwe activiteit").
        aria-label={t("kalender.plaatsToevoegenLabel", { ordinaal: blok.ordinaal })}
        // **No `aria-expanded`** (fix round 1, antagonist MINOR). It was hard-coded to `false` on an element that
        // ceases to exist the moment the value would be `true`, so it announced a toggle that never toggles. The
        // trigger is replaced by the panel rather than sitting above it, which is a different pattern from
        // `Themakaart`'s persistent disclosure; promising the collapsible one here would be a lie in every state that
        // ever renders. Focus is moved into the panel on open and back here on close, which is what actually keeps a
        // keyboard user oriented.
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">+</span> {t("kalender.plaatsToevoegen")}
      </Button>
    );
  }

  const bezig = toevoegen.isPending;
  const alHier = (themaId: string) => (alGeplaatst.get(themaId) ?? []).includes(blok.ordinaal);

  // Sorted by name in Dutch collation, so "Ijs" and "IJs" land where a teacher looks for them rather than where
  // their code points fall.
  const gesorteerd = [...(themas.data ?? [])].sort((a, b) => a.naam.localeCompare(b.naam, "nl-BE"));
  const kiesbaar = gesorteerd.filter((thema) => !alHier(thema.id));

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5">
      {themas.isPending && <p className="text-xs text-ink-zacht">{t("kalender.plaatsLaden")}</p>}

      {/* A retry the sentence can actually point at (fix round 1, antagonist MINOR). The copy said "Probeer het
          opnieuw" while the panel offered nothing but "Annuleren", so the only route was close-and-reopen and nothing
          named it: an instruction pointing at nothing, which is the E3-06 rule applied to copy. The board's own
          precedent for exactly this situation is a real button (`kalender.roosterOpnieuw`), reused here rather than
          reinvented, including its in-flight label. */}
      {themas.isError && (
        <>
          <Foutmelding>{t("kalender.plaatsThemasFout")}</Foutmelding>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={themas.isFetching}
            onClick={() => void themas.refetch()}
          >
            {themas.isFetching
              ? t("kalender.roosterOpnieuwBezig")
              : t("kalender.roosterOpnieuw")}
          </Button>
        </>
      )}

      {/* Three dead ends, three sentences. "No thema's at all" is a different problem from "this period already
          holds them all": the first is solved elsewhere in the app and says where, the second is not a problem. */}
      {themas.isSuccess && gesorteerd.length === 0 && (
        <p className="text-xs leading-snug text-ink-zacht">{t("kalender.plaatsGeenThemas")}</p>
      )}

      {themas.isSuccess && gesorteerd.length > 0 && kiesbaar.length === 0 && (
        <p className="text-xs leading-snug text-ink-zacht">{t("kalender.plaatsAllesAlHier")}</p>
      )}

      {kiesbaar.length > 0 && (
        <>
          {/* A real, visible `<label>` and nothing else. The first draft had a heading `<p>` *and* an `sr-only`
              label carrying the same sentence, so a screen reader announced it twice while sighted users read it
              once. One element, one string, correctly associated. */}
          <label htmlFor={`${id}-thema`} className="text-xs font-semibold text-ink">
            {t("kalender.plaatsKies")}
          </label>
          {/* `border-ink-zacht` for the same reason the move picker uses it: 6.08:1 is comfortably past SC 1.4.11's
              3:1 on the control that carries this whole route. */}
          <select
            id={`${id}-thema`}
            value={keuze}
            onChange={(event) => setKeuze(event.target.value)}
            disabled={bezig}
            autoFocus
            className="w-full rounded-md border border-ink-zacht bg-card px-2 py-1.5 text-xs text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-60"
          >
            <option value="">{t("kalender.plaatsKiesLeeg")}</option>
            {gesorteerd.map((thema) => {
              const hier = alHier(thema.id);
              // No need to exclude this period's own ordinal: `hier` being false is exactly the statement that it is
              // not in here, and when `hier` is true the annotation below never reads `elders`.
              const elders = alGeplaatst.get(thema.id) ?? [];

              return (
                // **Rendered and disabled, not filtered out** (fix round 1, antagonist MINOR). The first version
                // dropped the thema already in this period from the list entirely, which left the one genuinely
                // confusing case unexplained: a teacher looking at a rejected card for "Herfst" in this very column
                // opens the picker and finds Herfst simply absent. Disabling it says why, and it is what the
                // otherwise-dead `plaatsThemaKeuzeHier` key was written for. The submit button stays gated on a real
                // choice, and `plaatsAllesAlHier` still covers the case where nothing is selectable.
                <option key={thema.id} value={thema.id} disabled={hier}>
                  {/* The thema's own name is domain data, so it is rendered bare; the annotation around it is
                      authored copy and comes from nl.json (Art. II.3). The annotation is the one thing this picker
                      does that a plain list would not: it tells the teacher where the thema already sits in the year
                      before they plan it a second time by accident. */}
                  {hier
                    ? t("kalender.plaatsThemaKeuzeHier", { naam: thema.naam })
                    : elders.length === 0
                      ? thema.naam
                      : elders.length === 1
                        ? t("kalender.plaatsThemaKeuzeElders", {
                            naam: thema.naam,
                            ordinaal: elders[0],
                          })
                        : t("kalender.plaatsThemaKeuzeEldersMeervoud", {
                            naam: thema.naam,
                            ordinalen: formatteerOrdinalen(elders),
                          })}
                </option>
              );
            })}
          </select>

          {/* What the teacher gets, not a warning: nothing is destroyed by adding a thema, and a caution that does
              not apply is how teachers learn to ignore the ones that do. The fact worth stating is that this is
              recorded as their own choice and therefore survives a run.
              **Scoped to "het hele jaarplan" on purpose** (E4-06's rule): per-period regeneration is E4-05 and does
              not exist, so a sentence about "een hergeneratie" in general would be a promise nothing keeps. E4-05
              must re-read this string. */}
          <p className="text-xs leading-snug text-ink-zacht">{t("kalender.plaatsGevolg")}</p>
        </>
      )}

      <div className="mt-0.5 flex flex-wrap gap-1.5">
        {kiesbaar.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bezig || keuze.length === 0}
            onClick={() =>
              toevoegen.mutate(
                { themaId: keuze, blokStart: blok.start },
                // Closed only on success. A failure keeps the panel and its message on screen, so the teacher reads
                // why rather than watching the control vanish and having to guess whether anything happened.
                { onSuccess: sluit },
              )
            }
          >
            {bezig ? t("kalender.bezig") : t("kalender.plaatsen")}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={bezig} onClick={sluit}>
          {t("kalender.annuleren")}
        </Button>
      </div>

      {/* **Three branches, not two** (fix round 1, antagonist MINOR). 400 means the plan moved since this page loaded
          (someone else added the same thema, or the vakantiedata changed under the grid) and rereading the screen is
          the fix. **404 means the thema itself is gone**, deleted through E1-14's beheer screen while this picker held
          a cached list — a case this story's own unit test calls reachable in practice, and which the first version
          answered with "meld dit aan de beheerder", advice a teacher cannot act on for something they can fix by
          reloading. `Themakaart` already had the right precedent (`vergrendelVerdwenen`). Only what is left over means
          the tool is broken, and there telling a teacher to look again would send them round a loop that cannot
          succeed. The same split the move path makes, after it learned the hard way that branching on `isError` tells
          everyone to retry. */}
      {toevoegen.isError && (
        <Foutmelding>{plaatsFoutmelding(toevoegen.error)}</Foutmelding>
      )}
    </div>
  );
}

/**
 * Which sentence a failed hand-placement gets, keyed on the status rather than on `isError`.
 *
 * A named function per {@link Themakaart}'s `statusFoutmelding` precedent, rather than a nested ternary in the JSX:
 * the point of this mapping is that it is **four** cases and readable as four, since collapsing two of them is the
 * defect fix round 1 repaired here and the defect E3-07 repaired on the move path before that.
 */
function plaatsFoutmelding(fout: unknown): string {
  // 409 since E4-05: the period is bezet (owner ruling 2026-08-06). The column withholds this control for such a
  // period, so reaching it means the settings changed elsewhere — which is exactly why it may not fall through to
  // "meld dit aan de beheerder", the answer for a broken tool.
  if (fout instanceof ApiError && fout.status === 409) {
    return t("kalender.plaatsBezet");
  }

  if (fout instanceof ApiError && fout.status === 400) {
    return t("kalender.plaatsMislukt");
  }

  if (fout instanceof ApiError && fout.status === 404) {
    return t("kalender.plaatsThemaVerdwenen");
  }

  return t("kalender.plaatsOnbeschikbaar");
}
