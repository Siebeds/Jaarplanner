import { useDraggable } from "@dnd-kit/core";
import { useId, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { t, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import { formatteerDatum, formatteerPeriode } from "./kalenderFormat";
import type { Planningsblok, Themaplaatsing } from "./types";
import {
  useVerplaatsPlaatsing,
  useVerwijderPlaatsing,
  useWijzigPlaatsingStatus,
} from "./useJaarplan";

/**
 * One thema on the board (E3-06 card, E3-07 interaction).
 *
 * **Compact by design.** On a board the card competes for a 288px column, and the first version put the
 * thema name, a status chip, a goal count and a full motivation paragraph in every one — seven of those on
 * screen read as a wall of prose. The motivation is clamped to two lines here; the full text belongs on the
 * thema detail page (**E1-14**).
 *
 * **Two routes to every action, because one of them is required by law.** WCAG 2.2 adds SC 2.5.7 *Dragging
 * Movements*: any function achieved by dragging needs a single-pointer alternative. So the grip is not *the*
 * interaction, it is the mouse shortcut for it — the "Aanpassen" panel below does the same work with a period
 * picker, which also happens to be the only route that works on a touch screen, by keyboard, and for a teacher
 * who never discovers that cards can be dragged at all.
 *
 * **The grip is deliberately not focusable and hidden from assistive tech.** dnd-kit's own `attributes` would
 * make it a `role="button"` tab stop driven by its KeyboardSensor, whose default arrow-key movement steps by
 * pixels — across a horizontally scrolling ribbon of unequal columns that is not an interaction anyone can
 * follow. A tab stop that lifts a card and cannot reliably put it down is worse than no tab stop: it is the
 * "control that does nothing" this project banned after E3-06. The accessible route is the panel, so the grip
 * is decoration for pointer users and says so to a screen reader.
 *
 * **The doelsoort mix from the wireframe (`MD 4 · G 6 · + 1`) is still deliberately absent.** The jaarplan API
 * returns `doelcodes` but not each code's doelsoort, so the mix cannot be computed here without inventing it.
 *
 * **The count says *gekoppeld*, never *gedekt*.** Under Art. V.1 a doel is only *gedekt* once its thema is
 * placed in the plan, so for a **stale** placement the count proves nothing about coverage and the card says
 * so instead of printing a number.
 */
/**
 * Whether this board can give a thema another themaperiode, and if not, why not (E3-08 fix round 3).
 *
 * A plain boolean for three rounds, and the collapse is what the owner ruled on: `false` meant both *"the board shows
 * subthemaperiodes, so pick a period in the themaperiode view"* and *"the tool could not read this board's tier at
 * all"*. The sentence written for the first was therefore shown for the second, where it names the view the teacher is
 * already looking at. Same shape as `Periodestaat` and for the same reason: **one derived state per cause, each with
 * its own sentence**, so a state cannot silently borrow copy written about another.
 *
 * - `kan` — this board's columns are the tier a placement keys on, so the grip and the period picker are offered.
 * - `anderNiveau` — the board shows the finer tier. Moving works, in the themaperiode view; nothing is broken.
 * - `niveauOnbekend` — the server answered a tier this app does not recognise. Moving is withheld and **no view may be
 *   promised**, because there is no view this app knows these columns belong to.
 *
 * What it deliberately does *not* encode is the placement's own status. A rejected placement cannot be moved at either
 * tier (the server refuses it, since a move would silently grant dekking), and that is a fact about the card rather
 * than about the board — so it is read off `plaatsing.status` where it is needed, not folded in here. Folding the two
 * together is what produced the defect: a rejected card at the fine tier was sent to a view that withholds the picker
 * from it as well.
 */
export type Verplaatsstaat = "kan" | "anderNiveau" | "niveauOnbekend";

export interface ThemakaartProps {
  plaatsing: Themaplaatsing;
  /** The class whose plan this is — the edits post against it. */
  klasId: string;
  /** Every period of the year, so the panel can offer them as move targets. */
  blokken: readonly Planningsblok[];
  /**
   * Whether moving is possible on the board this card is on, and if not, why not (E3-08). See {@link Verplaatsstaat}.
   *
   * Not `kan` at the subthemaperiode zoom, so the grip and the period picker are **absent** rather than
   * present-and-failing. The reason is not that the server refuses those dates — a third of them it accepts, because
   * each parent's first sub-block starts on the parent's own start date. It is that a drop on one of those moves the
   * thema into the **whole** themaperiode while the teacher aimed at a fortnight: the affordance would be honest about
   * the request and dishonest about the effect. See {@link PeriodekolomProps.verplaatsstaat} for the full argument.
   *
   * Everything else on the card stays: taking a thema out of its themaperiode and reversing a rejection are unaffected
   * by the tier, since neither names a block. The delete confirmation names the **themaperiode** and its ordinal
   * explicitly, which is what keeps it unambiguous here — `blokOrdinaal` is the coarse ordinal, so at this tier a card
   * sitting in *Subthemaperiode 9* must not be asked about "periode 3" as if the column and the object were one thing.
   */
  verplaatsstaat: Verplaatsstaat;
}

export function Themakaart({ plaatsing, klasId, blokken, verplaatsstaat }: ThemakaartProps) {
  const [paneelOpen, setPaneelOpen] = useState(false);
  const paneelId = useId();

  // A rejected placement is not draggable at all. Moving it would convert the rejection to `Manueel`, which is
  // the one transition here that changes dekking (Art. V.1) — the server refuses it, and offering a grip that
  // always fails would be a control that does nothing. Reversing a rejection stays the explained, explicit
  // decision in the panel below.
  //
  // Nor is anything draggable on a board whose columns the server will not accept as a target (E3-08).
  const kanSlepen = verplaatsstaat === "kan" && plaatsing.status !== "Geweigerd";

  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: plaatsing.id,
    data: { plaatsing },
    disabled: !kanSlepen,
  });

  const aantal = plaatsing.doelcodes.length;
  const koppeling = plaatsing.isVervallen
    ? t("kalender.dekkingOnbekend")
    : aantal === 0
      ? t("kalender.geenDoelen")
      : aantal === 1
        ? t("kalender.eenDoelGekoppeld")
        : t("kalender.doelenGekoppeld", { aantal });

  return (
    <article
      ref={setNodeRef}
      className={[
        "rounded-md border border-border bg-card p-3 shadow-card",
        // The source card stays put and dims while its DragOverlay copy follows the cursor. Moving this one
        // would have it clipped by the board's `overflow-x-auto` the moment it left its column.
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          {/* Pointer-only affordance: see the class note. `touch-none` stops the browser claiming the gesture
              as a scroll before dnd-kit sees it.

              dnd-kit's `attributes` are deliberately NOT spread here. They carry `role="button"`, `tabIndex=0`,
              `aria-roledescription="draggable"` and (mid-drag) `aria-pressed` — the first two are overridden
              below, but the ARIA ones would remain on a `role="presentation"` node, which is invalid ARIA that
              only passes axe because `aria-hidden` excludes the subtree from evaluation. Spreading only
              `listeners` is the honest expression of "this is decoration that happens to accept a pointer". */}
          {kanSlepen && (
            <span
              {...listeners}
              aria-hidden="true"
              tabIndex={-1}
              role="presentation"
              className="mt-0.5 shrink-0 cursor-grab touch-none select-none px-0.5 text-ink-zacht active:cursor-grabbing"
            >
              ⠿
            </span>
          )}
          <h4 className="min-w-0 text-sm font-semibold leading-snug text-ink">{plaatsing.themaNaam}</h4>
        </div>

        {plaatsing.vergrendeld && (
          /* Icon AND word — colour or a glyph alone is never the sole carrier (Art. XII, WCAG 2.2 AA). */
          <Badge variant="outline" className="shrink-0" title={t("kalender.vergrendeldUitleg")}>
            <span aria-hidden="true">🔒</span> {t("kalender.vergrendeld")}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* The status token variants carry the same colours as the matching screen, so a "voorgesteld"
            thema reads identically wherever a teacher meets it. */}
        <Badge variant={statusSleutel(plaatsing.status)}>
          {t(`suggestieStatus.${statusSleutel(plaatsing.status)}`)}
        </Badge>
        <span className="text-xs text-ink-zacht" data-cijfers>
          {koppeling}
        </span>
      </div>

      {plaatsing.aiMotivatie && (
        <p
          // Clamped to two lines: the full motivation belongs on the thema detail page (E1-14). `title`
          // carries the rest for a mouse user, which is an addition here rather than the only route to it.
          className="mt-2.5 line-clamp-2 border-t border-border pt-2 text-xs leading-snug text-ink-zacht"
          title={plaatsing.aiMotivatie}
        >
          <span className="font-semibold text-ink">{t("kalender.motivatieLabel")} </span>
          {plaatsing.aiMotivatie}
        </p>
      )}

      <div className="mt-2.5 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setPaneelOpen((open) => !open)}
          aria-expanded={paneelOpen}
          aria-controls={paneelId}
          aria-label={t("kalender.aanpassenLabel", { thema: plaatsing.themaNaam })}
          className="rounded text-xs font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {paneelOpen ? t("kalender.aanpassenSluiten") : t("kalender.aanpassen")}
        </button>

        {paneelOpen && (
          <Bewerkpaneel
            id={paneelId}
            plaatsing={plaatsing}
            klasId={klasId}
            blokken={blokken}
            verplaatsstaat={verplaatsstaat}
            onKlaar={() => setPaneelOpen(false)}
          />
        )}
      </div>
    </article>
  );
}

/**
 * How a **stale** placement is re-placed, one sentence per board state, for a card that is not rejected.
 *
 * A `Record` rather than a chain of ternaries so the compiler owns the pairing: a fourth {@link Verplaatsstaat} cannot
 * be added without deciding what it tells a teacher, which is exactly what went wrong when two causes shared one
 * sentence. `niveauOnbekend` names no view on purpose — this app does not know which of its two views those columns
 * belong to, so *"kan in de weergave Themaperiodes"* could be pointing at the view the teacher is on.
 */
const HERPLAATSUITLEG: Record<Verplaatsstaat, TranslationKey> = {
  kan: "kalender.herplaatsKies",
  anderNiveau: "kalender.herplaatsAnderNiveau",
  niveauOnbekend: "kalender.herplaatsNiveauOnbekend",
};

/**
 * The accessible route: move this thema to another period, take it out of its period, or reverse a rejection.
 *
 * **The delete confirmation replaces the button that triggers it, rather than opening a modal.** Two reasons.
 * It cannot be missed or mis-dismissed, because the control it guards is gone while the question stands. And
 * `components/ui/` holds a button and a badge — no dialog — so a modal would mean a new Radix dependency, a
 * focus trap and a `jsdom` shim for a question that fits in the space the button occupied.
 */
function Bewerkpaneel({
  id,
  plaatsing,
  klasId,
  blokken,
  verplaatsstaat,
  onKlaar,
}: {
  id: string;
  plaatsing: Themaplaatsing;
  klasId: string;
  blokken: readonly Planningsblok[];
  verplaatsstaat: Verplaatsstaat;
  onKlaar: () => void;
}) {
  const [doelBlok, setDoelBlok] = useState("");
  const [vraagtBevestiging, setVraagtBevestiging] = useState(false);

  const verplaats = useVerplaatsPlaatsing(klasId);
  const verwijder = useVerwijderPlaatsing(klasId);
  const statuswijziging = useWijzigPlaatsingStatus(klasId);

  const bezig = verplaats.isPending || verwijder.isPending || statuswijziging.isPending;

  // A stale placement sits in no period, so every period is a candidate. Otherwise the period it is already in
  // is left out: the server treats that move as a no-op, and offering it invites a click that does nothing.
  //
  // A rejected placement offers none: the server refuses the move (it would silently grant dekking), so the
  // picker is replaced by the instruction to reverse the rejection first.
  //
  // Nor does the fine zoom offer any (E3-08): `blokken` would be subthemaperiodes, and offering them would ask the
  // teacher to pick a fortnight while the plan can only record the themaperiode that contains it (the ones the server
  // *does* accept are precisely the parents' first sub-blocks). Where E3-06's rule asks for visible text, the board
  // carries it once above itself rather than repeating a disabled control per card.
  const isGeweigerd = plaatsing.status === "Geweigerd";
  const doelen =
    isGeweigerd || verplaatsstaat !== "kan"
      ? []
      : blokken.filter((blok) => blok.start !== plaatsing.blokStart);

  /**
   * Whether removing this placement must be confirmed.
   *
   * The ratified rule (E3-07, from the E3-01 audit): an untouched AI proposal goes on one click, because
   * regeneration can simply propose it again. Anything the teacher decided on or locked is **unrecoverable** —
   * this codebase has no soft delete and no audit trail — so it is confirmed by a question that names the
   * thema and the period.
   */
  const moetBevestigen = plaatsing.status !== "Voorgesteld" || plaatsing.vergrendeld;

  return (
    <div id={id} className="mt-2.5 flex flex-col gap-3 rounded-md bg-paper-diep/60 p-2.5">
      {/* A stale placement's instruction has to match what the panel actually offers, and there are now four cases
          rather than two (E3-08 fix round 3, owner ruling).

          **A rejected card gets no re-placement instruction at all.** Its picker is withheld by the *rejection*, not
          by the tier, so at every tier both sentences would be false: `herplaatsKies` points at a picker that is not
          in this panel (E3-07's own defect, which E4-06 filed), and `herplaatsAnderNiveau` is worse, because it sends
          the teacher to another view where the picker is withheld for the same reason. Nothing is lost by staying
          silent: `weigeringEerstTerugdraaien` below says why moving is refused, and its *Weigering terugdraaien*
          button sits under it at both tiers, so the corrective control is on the same screen as the sentence. Once the
          rejection is reversed the placement is `Manueel` and this instruction returns.

          The other three are the board's three states, paired one-to-one by {@link HERPLAATSUITLEG} rather than by a
          ternary: the unrecognised-tier degrade may not name a view either, since this app does not know which view
          those columns belong to. */}
      {plaatsing.isVervallen && !isGeweigerd && (
        <p className="text-xs leading-snug text-attentie-ink">{t(HERPLAATSUITLEG[verplaatsstaat])}</p>
      )}

      {isGeweigerd && (
        <p className="text-xs leading-snug text-attentie-ink">
          {t("kalender.weigeringEerstTerugdraaien")}
        </p>
      )}

      {doelen.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-periode`} className="text-xs font-semibold text-ink">
            {t("kalender.verplaatsNaar")}
          </label>
          {/* `border-ink-zacht` rather than the `input` token: that token measures 1.42:1 against paper and a
              form control's boundary needs 3:1 (SC 1.4.11). The app-wide fix is E7-10; this control does not
              wait for it. */}
          <select
            id={`${id}-periode`}
            value={doelBlok}
            onChange={(event) => setDoelBlok(event.target.value)}
            disabled={bezig}
            className="w-full rounded-md border border-ink-zacht bg-card px-2 py-1.5 text-xs text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-60"
          >
            <option value="">{t("kalender.verplaatsKies")}</option>
            {doelen.map((blok) => (
              <option key={blok.start} value={blok.start}>
                {t("kalender.periodeKeuze", {
                  ordinaal: blok.ordinaal,
                  periode: formatteerPeriode(blok.start, blok.eind),
                })}
              </option>
            ))}
          </select>
          {/* The consequence, stated where the action is taken and BEFORE it is taken.
              A move is not reversible: putting the thema back restores the date and nothing else, so the AI
              motivation and any `aanvaard` decision are gone for good. Shown only for a placement that has
              something to lose — for one that is already `Manueel` with no motivation, the sentence would be
              false, and a warning that does not apply is how teachers learn to ignore warnings.
              Deliberately not a confirmation dialog: the loss is small and local, unlike a delete. */}
          {(plaatsing.aiMotivatie !== null || plaatsing.status !== "Manueel") && (
            <p className="text-xs leading-snug text-ink-zacht">{t("kalender.verplaatsGevolg")}</p>
          )}

          <Button
            type="button"
            size="sm"
            disabled={bezig || doelBlok.length === 0}
            onClick={() =>
              verplaats.mutate(
                { plaatsingId: plaatsing.id, blokStart: doelBlok },
                { onSuccess: onKlaar },
              )
            }
          >
            {verplaats.isPending ? t("kalender.bezig") : t("kalender.verplaatsen")}
          </Button>
          {/* 400 means the teacher can fix it by choosing differently; anything else means the tool is broken
              and telling them to "kies een periode" would send them round a loop that cannot succeed. The same
              split the generation panel makes, for the same reason. */}
          {verplaats.isError && (
            <Foutmelding>
              {verplaats.error instanceof ApiError && verplaats.error.status === 400
                ? t("kalender.verplaatsMislukt")
                : t("kalender.verplaatsOnbeschikbaar")}
            </Foutmelding>
          )}
        </div>
      )}

      {plaatsing.status === "Geweigerd" && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <p className="text-xs leading-snug text-ink-zacht">{t("kalender.weigeringUitleg")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bezig}
            onClick={() =>
              statuswijziging.mutate({ plaatsingId: plaatsing.id, status: "Manueel" })
            }
          >
            {statuswijziging.isPending ? t("kalender.bezig") : t("kalender.weigeringTerugdraaien")}
          </Button>
          {statuswijziging.isError && <Foutmelding>{t("kalender.statusMislukt")}</Foutmelding>}
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
        {vraagtBevestiging ? (
          <>
            {/* Names the thema AND the period, which is what makes the un-guarded endpoint safe to expose:
                the teacher cannot be unaware of which object is about to go.
                A stale placement has no period, so it names the **stored date** instead. Not cosmetic: the
                unique index is (JaarplanId, ThemaId, BlokNiveau, BlokStart), so the same thema can be stale at
                two vanished dates, and without the date both cards would raise a byte-identical question for
                two different unrecoverable deletions. */}
            <p role="alert" className="text-xs font-semibold leading-snug text-ink">
              {plaatsing.blokOrdinaal === null
                ? t("kalender.verwijderVraagVervallen", {
                    thema: plaatsing.themaNaam,
                    datum: formatteerDatum(plaatsing.blokStart),
                  })
                : t("kalender.verwijderVraag", {
                    thema: plaatsing.themaNaam,
                    ordinaal: plaatsing.blokOrdinaal,
                  })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={bezig}
                onClick={() => verwijder.mutate(plaatsing.id)}
              >
                {verwijder.isPending ? t("kalender.bezig") : t("kalender.verwijderBevestig")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={bezig}
                onClick={() => setVraagtBevestiging(false)}
              >
                {t("kalender.annuleren")}
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bezig}
            onClick={() => {
              if (moetBevestigen) {
                setVraagtBevestiging(true);
              } else {
                verwijder.mutate(plaatsing.id);
              }
            }}
          >
            {plaatsing.isVervallen
              ? t("kalender.uitJaarplanHalen")
              : t("kalender.uitPeriodeHalen")}
          </Button>
        )}
        {verwijder.isError && <Foutmelding>{t("kalender.verwijderMislukt")}</Foutmelding>}
      </div>
    </div>
  );
}

/**
 * The card as it looks *while being dragged*, rendered into the `DragOverlay` portal.
 *
 * **A separate component rather than reusing {@link Themakaart}, for two reasons.** The overlay would
 * otherwise call `useDraggable` with an id that is already registered by the source card, so two live
 * registrations would fight over one key in dnd-kit's internal map — it happens to resolve correctly today,
 * which is exactly the kind of thing that stops being true after a library bump. And a floating copy has no
 * business carrying an "Aanpassen" disclosure: a panel that opens inside something following the cursor is not
 * an interaction, and its controls would be reachable in the portal while the board underneath is mid-drag.
 *
 * So this is the compact token a drag should show — what am I carrying, and what state is it in — and nothing
 * more.
 */
export function Sleepkaart({ plaatsing }: { plaatsing: Themaplaatsing }) {
  return (
    <article className="w-72 rotate-1 rounded-md border border-petrol bg-card p-3 shadow-lg">
      <div className="flex items-start gap-1.5">
        <span aria-hidden="true" className="mt-0.5 shrink-0 px-0.5 text-ink-zacht">
          ⠿
        </span>
        <h4 className="min-w-0 text-sm font-semibold leading-snug text-ink">{plaatsing.themaNaam}</h4>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Badge variant={statusSleutel(plaatsing.status)}>
          {t(`suggestieStatus.${statusSleutel(plaatsing.status)}`)}
        </Badge>
        {plaatsing.vergrendeld && (
          <Badge variant="outline">
            <span aria-hidden="true">🔒</span> {t("kalender.vergrendeld")}
          </Badge>
        )}
      </div>
    </article>
  );
}

/** One failed edit, stated where the teacher acted rather than at the top of the page. */
function Foutmelding({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded bg-suggestie-geweigerd/10 px-2 py-1.5 text-xs font-medium leading-snug text-suggestie-geweigerd"
    >
      {children}
    </p>
  );
}

/** Maps the API's PascalCase status onto the nl.json key for it. */
function statusSleutel(status: Themaplaatsing["status"]) {
  return status.toLowerCase() as Lowercase<Themaplaatsing["status"]>;
}
