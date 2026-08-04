import { useId, useRef, useState } from "react";

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
   * reason it exists at all: the *"staat al in themaperiode 3"* annotation, and withholding the thema that is
   * already in **this** period, which the server refuses with a 400.
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

    // Focus goes back to the control that opened this, or it would land on <body> and a keyboard user would lose
    // their place on a horizontally scrolling board.
    trigger.current?.focus();
  }

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
        aria-expanded={false}
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

      {themas.isError && <Foutmelding>{t("kalender.plaatsThemasFout")}</Foutmelding>}

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
            {kiesbaar.map((thema) => {
              const elders = alGeplaatst.get(thema.id) ?? [];

              return (
                <option key={thema.id} value={thema.id}>
                  {/* The thema's own name is domain data, so it is rendered bare; the annotation around it is
                      authored copy and comes from nl.json (Art. II.3). The annotation is the one thing this picker
                      does that a plain list would not: it tells the teacher where the thema already sits in the year
                      before they plan it a second time by accident. */}
                  {elders.length === 0
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

      {/* 400 means the plan moved since this page loaded (someone else added the same thema, or the vakantiedata
          changed under the grid) and rereading the screen is the fix. Anything else means the tool is broken, and
          telling a teacher to look again would send them round a loop that cannot succeed. The same split the move
          path makes, after it learned the hard way that branching on `isError` tells everyone to retry. */}
      {toevoegen.isError && (
        <Foutmelding>
          {toevoegen.error instanceof ApiError && toevoegen.error.status === 400
            ? t("kalender.plaatsMislukt")
            : t("kalender.plaatsOnbeschikbaar")}
        </Foutmelding>
      )}
    </div>
  );
}
