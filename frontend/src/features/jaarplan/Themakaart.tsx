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
  useWijzigVergrendeling,
} from "./useJaarplan";

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
 *
 * **What that costs, scoped precisely (fix round 4, MINOR-4a).** The exhaustiveness the two `Record`s below buy is
 * over the **board axis only**. The panel has four cases, not three: `isGeweigerd` sits outside this union behind a
 * hand-written `&& !isGeweigerd`, so adding a member here forces someone to write a *sentence* but forces nobody to
 * decide whether the rejection suppression still applies to it. Keeping status out of the union is still the right
 * call — see the paragraph above — but the compiler's guarantee stops at "every board state has copy", and it is
 * worth saying so rather than letting "exhaustive" be read as "every case of this panel".
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

/**
 * One thema on the board (E3-06 card, E3-07 interaction).
 *
 * *Moved back down against its declaration in fix round 4.* Round 3 inserted `Verplaatsstaat` and its own TSDoc
 * **between** this comment and the function it describes, so two block comments stood in a row and tooling attached
 * the last one: hovering `Themakaart` showed the union's doc and this one hung on nothing. Cosmetic, but a story that
 * spent four rounds on comments being true can hardly ship one that is unreachable.
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
 *
 * **The "Vast" badge finally has a switch behind it (E4-06, FR-8.4).** It shipped with E3-06 rendering a flag no
 * teacher could set, so the state was unreachable and FR-8.4 had no invocation surface. The lock/unlock control
 * lives in the "Aanpassen" panel; what is deliberately *not* implied here is that only a locked thema survives a
 * regeneration. It does not: anything the teacher accepted, adjusted or rejected survives too, and the panel says
 * so rather than leaving the badge's absence to be read as "this one is disposable".
 *
 * **Nor does the lock make a thema count.** Only `aanvaard`/`manueel` placements count as placed for the dekking,
 * so a locked `voorgesteld` thema is safe from the AI and worth nothing to an onderwijsinspectie. The panel draws
 * that distinction in words (owner ruling, 2026-07-31); the accept control that resolves it is **E4-01/E4-02's**,
 * deliberately not built here, so the copy states the condition rather than pointing at a button. The condition is
 * phrased as *the teacher taking the proposal over* rather than as the status `aanvaard`: both `aanvaard` and
 * `manueel` count (the binding reading in E5), and "Verplaatsen" on this very card is the route to `manueel`, so
 * naming only `aanvaard` would name the one status this screen cannot set while omitting the one it can.
 */
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
 *
 * **The guarantee is one axis wide** (fix round 4, MINOR-4a): it covers the board, not the panel. The rejection case
 * is not in this table at all — it is the `!isGeweigerd` on the paragraph below — so a new member gets a sentence
 * without anyone being made to decide whether a rejected card should be told it. See {@link Verplaatsstaat}.
 */
const HERPLAATSUITLEG: Record<Verplaatsstaat, TranslationKey> = {
  kan: "kalender.herplaatsKies",
  anderNiveau: "kalender.herplaatsAnderNiveau",
  niveauOnbekend: "kalender.herplaatsNiveauOnbekend",
};

/**
 * The accessible route: lock this thema against regeneration, move it to another themaperiode, take it out of its
 * themaperiode, or reverse a rejection.
 *
 * **The delete confirmation replaces the button that triggers it, rather than opening a modal.** Two reasons.
 * It cannot be missed or mis-dismissed, because the control it guards is gone while the question stands. And
 * `components/ui/` holds a button and a badge — no dialog — so a modal would mean a new Radix dependency, a
 * focus trap and a `jsdom` shim for a question that fits in the space the button occupied.
 *
 * **Why the lock lives here and not on the card face** (E4-06). The card fights for a 288px column and already
 * carries a name, a status chip, a goal count and a clamped motivation. Every other placement edit is behind this
 * one disclosure, so a second route from the card face would be a second idiom for the same kind of decision. It
 * is also what makes the lock keyboard-operable and independent of dragging (WCAG 2.2 SC 2.5.7), the precedent
 * E3-07 set with its period picker.
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
  const vergrendeling = useWijzigVergrendeling(klasId);

  const bezig =
    verplaats.isPending ||
    verwijder.isPending ||
    statuswijziging.isPending ||
    vergrendeling.isPending;

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

  /**
   * Whether locking this placement would change a regeneration outcome (E4-06, FR-8.4).
   *
   * The server discards exactly the placements that are `Voorgesteld && !vergrendeld`
   * (`Themaplaatsing.IsVervangbaar`), so **an accepted, manual or rejected placement already survives a
   * regeneration without any lock.** Offering "Vastzetten" there would be a switch that changes no regeneration
   * outcome and no dekking, which is the control-that-does-nothing this project banned after E3-06, in a new coat.
   *
   * *Precisely: it is not observably inert.* Locking a decided placement does show the "Vast" badge and does change
   * the sentence in this panel. What it cannot change is whether a run replaces the placement, or whether the thema
   * counts as placed. Recorded exactly because an earlier revision of this comment claimed it changed "nothing
   * observable", and that absolute claim is the load-bearing justification for hiding the control.
   *
   * It is not merely inert *today* either: no transition anywhere returns a placement **to** `Voorgesteld` (the
   * status endpoint refuses that status, and a run only ever inserts new placements), so a lock set on a decided
   * placement could never become load-bearing later. That is what rules out keeping the control visible as a
   * "durable intent".
   */
  const isVoorstel = plaatsing.status === "Voorgesteld";

  /**
   * Whether the lock section appears at all, and with a control or only a sentence.
   *
   * Three axes, not two, because the audit of build round 1 found the section deciding *whether* to render on
   * `(status, vergrendeld)` while deciding *which sentence* on `vergrendeld` alone — so a locked `Manueel` card
   * read "een hergeneratie laat het staan **omdat** het vast staat" and invited a "Losmaken" that changes no
   * outcome. Every combination now gets copy that is true of it, and {@link slotUitleg} is the single place the
   * pairing is decided.
   *
   * **A stale placement gets no lock nudge** (`isVervallen`). Its own remedy is re-placement, stated at the top of
   * this panel: locking one instead pins the card at a date that is no longer a themaperiode boundary, so the
   * "dekking onbetrouwbaar" state would survive every regeneration where before it was self-healing. An *already*
   * locked stale card keeps the control, so the lock stays undoable, and its sentence says only that the lock is not
   * the remedy.
   *
   * **Why that sentence still names no remedy of its own — premise corrected in the E3-08 merge.** It used to be
   * justified by "`kalender.herplaatsKies` already stands at the top of this panel, and on a stale **rejected** card
   * that instruction has no picker to point at". Both halves are now false. The line at the top is one of *three*
   * ({@link HERPLAATSUITLEG}) and only the coarse tier gets `herplaatsKies`; at the subthemaperiode zoom it is
   * `herplaatsAnderNiveau`, which sends the teacher to the other view. Repeating *"kies een periode"* here would
   * therefore **contradict** the line above it at the fine tier rather than merely duplicate it. And a stale rejected
   * card no longer gets any re-placement instruction at either tier (E3-08 fix round 3, owner ruling); it also never
   * reaches this sentence, because {@link slotUitleg} tests `isGeweigerd` first and hands it
   * `vergrendelUitlegGeweigerdVast`, whose remedy is the *Weigering terugdraaien* button directly below. Silence
   * about re-placement here is still the right call, now for a reason that holds at both tiers.
   */
  const toonSlot = plaatsing.isVervallen
    ? plaatsing.vergrendeld
    : isVoorstel || plaatsing.vergrendeld;

  // And where there is no control, the fact is stated instead, because the inverse silence is the more damaging
  // lie: an accepted thema with no "Vast" badge otherwise looks discardable, which invites pointless locking.
  //
  // Two exceptions. A **stale** card: see above, one remedy only. And a **rejected** one, which is a deliberate
  // omission rather than a duplicate: `kalender.weigeringUitleg` now carries the regeneration fact for a rejected
  // placement (owner ruling, 2026-07-31), so repeating it here would pull attention off the one decision that
  // card is waiting for.
  const toonSlotOverbodig = !toonSlot && !isGeweigerd && !plaatsing.isVervallen;

  /**
   * The one sentence that is true of this exact `(status, vergrendeld, isVervallen)` state.
   *
   * **`isGeweigerd` is tested first, ahead of `isVervallen`**, and that order is the round-2 fix. A rejected card
   * only reaches this branch while locked (it is never `Voorgesteld`), and both of the sentences it used to get
   * were wrong for it: `vergrendelUitlegBeslistVast` opens with "Je hebt dit thema zelf beslist, dus … het blijft
   * staan", which describes the *opposite* decision to a weigering, and `vergrendelUitlegVervallen` pointed at a
   * period picker that is suppressed for a rejected card (`doelen` is empty above). What is true instead is that
   * the **weigering** is what keeps the thema out of the AI's reach and the lock adds nothing to it.
   */
  const slotUitleg = isGeweigerd
    ? t("kalender.vergrendelUitlegGeweigerdVast")
    : plaatsing.isVervallen
      ? t("kalender.vergrendelUitlegVervallen")
      : !isVoorstel
        ? // Locked, but the teacher already decided: the lock is redundant AND unlocking will not make the thema
          // replaceable, because `IsVervangbaar` needs `Voorgesteld`. Both halves have to be said, or the teacher
          // clicks "Losmaken" expecting the AI to reconsider and nothing happens.
          t("kalender.vergrendelUitlegBeslistVast")
        : plaatsing.vergrendeld
          ? t("kalender.vergrendelUitlegVast")
          : t("kalender.vergrendelUitlegVrij");

  return (
    <div id={id} className="mt-2.5 flex flex-col gap-3 rounded-md bg-paper-diep/60 p-2.5">
      {/* Success announced, not only failure (WCAG 2.2 SC 4.1.3). The failure paths have `role="alert"`; before
          this round a *successful* lock was silent to a screen reader, which got a label that flipped and a badge
          appearing somewhere above with no announcement. `aria-pressed` was rejected on purpose (beside a label
          that flips it announces backwards: "Losmaken, ingedrukt"), which left nothing in its place.

          **Deliberately at panel level, outside the lock section.** The first version of this fix sat inside that
          section and was silent in the one case that matters most: unlocking a decided placement removes the whole
          section (the sentence becomes "Vastzetten hoeft hier niet"), so the region unmounted in the same render
          that would have announced. Caught in the browser, not by a test — the announcement was simply absent.

          Keyed on the persisted `plaatsing.vergrendeld`, so it reports what the server stored rather than what was
          requested. It alternates on every toggle, so the text always changes and the region always fires;
          `isPending` empties it first, which is the change that lets a repeat announce. */}
      <p role="status" className="sr-only">
        {vergrendeling.isSuccess
          ? plaatsing.vergrendeld
            ? t("kalender.vergrendelVastgezet", { thema: plaatsing.themaNaam })
            : t("kalender.vergrendelLosgemaakt", { thema: plaatsing.themaNaam })
          : ""}
      </p>

      {/* A stale placement's instruction has to match what the panel actually offers, and there are now four cases
          rather than two (E3-08 fix round 3, owner ruling).

          **A rejected card gets no re-placement instruction at all.** Its picker is withheld by the *rejection*, not
          by the tier, so at every tier both sentences would be false: `herplaatsKies` points at a picker that is not
          in this panel (E3-07's own defect, which E4-06 filed), and `herplaatsAnderNiveau` is worse, because it sends
          the teacher to another view where the picker is withheld for the same reason. Nothing is lost by staying
          silent: `weigeringEerstTerugdraaien` below says why moving is refused, and its *Weigering terugdraaien*
          button sits under it at both tiers, so the corrective control is on the same screen as the sentence. Once the
          rejection is reversed the placement is `Manueel` and this instruction returns.

          **And the sentence below now names that second step** (fix round 4, owner ruling on QUESTION-A). The remedy
          on a stale rejected card is two moves — reverse the rejection, then give the thema a themaperiode — and
          round 3 named only the first, leaving *"eerst"* to imply the rest. The defence was that a second sentence
          would have to name a view and would therefore be tier-dependent; that was disproved: *"Daarna kan je het
          thema een andere themaperiode geven"* names no view, and the *where* is carried once above the board by
          `fijnUitleg` / `sleepUitleg` rather than per card.

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
          {/* `border-ink-zacht` rather than the `input` token, for margin rather than out of necessity: at
              6.08:1 the boundary is comfortably past SC 1.4.11's 3:1 on a control that carries the whole
              non-drag re-placement route.
              *Corrected 2026-08-03 (E4-06 round-2 audit).* This comment used to justify the choice with "that
              token measures 1.42:1 against paper … the app-wide fix is E7-10", and both halves are stale:
              `index.css` records 1.42:1 as the **superseded** value `40 14% 84%`, `--input` is now
              `40 14% 52%` (3,21:1 on paper / 3,40:1 on card, and 3,16:1 against this panel's well), and E7-10's
              token half landed with E3-04. So the file asserted a WCAG failure that no longer exists and
              deferred to a fix already made. Left as a correction rather than deleted, because a stale contrast
              figure surviving in the very file a story rewrote is the pattern worth remembering. */}
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

      {/* Deliberately headingless: every sibling section in this panel is one sentence plus one button, and a
          heading here would be the only structural device on the card that labels rather than acts. The two
          sentences below are self-contained, so a label would only repeat them. */}
      {(toonSlot || toonSlotOverbodig) && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          {toonSlot ? (
            <>
              <p className="text-xs leading-snug text-ink-zacht">{slotUitleg}</p>
              {/* The distinction the kalender otherwise never draws, and the reason the nudge above is safe to
                  ship (owner ruling, 2026-07-31). Locking keeps a thema in its period; only `aanvaard` or
                  `manueel` makes it count as placed for the dekking (the binding reading in E5), and a locked
                  `voorgesteld` placement counts for nothing there. The condition is worded as the teacher taking
                  the proposal over, which is what covers **both** counting statuses and stays satisfiable on this
                  screen today: "Verplaatsen" above sets `Manueel`. Stated as a condition rather than as an
                  instruction, because the accept control is E4-01/E4-02's and is deliberately not built here.
                  Only on a proposal, where that decision is still ahead of the teacher. */}
              {isVoorstel && !plaatsing.isVervallen && (
                <p className="text-xs leading-snug text-ink-zacht">{t("kalender.vergrendelDekking")}</p>
              )}
              {/* A toggle whose **label** changes, deliberately without `aria-pressed`: the two together are
                  announced as "Losmaken, ingedrukt", which reads as the opposite of the state it is in. The card
                  face carries the state as a badge (icon AND the word "Vast", never colour alone — Art. XII).

                  Its own `isPending` drives its own label. `bezig` disables every control in the panel while any
                  request is in flight, but only this one may claim to be busy. */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={bezig}
                onClick={() =>
                  vergrendeling.mutate({
                    plaatsingId: plaatsing.id,
                    vergrendeld: !plaatsing.vergrendeld,
                  })
                }
              >
                {vergrendeling.isPending
                  ? t("kalender.bezig")
                  : plaatsing.vergrendeld
                    ? t("kalender.ontgrendelen")
                    : t("kalender.vergrendelen")}
              </Button>
              {/* 404 means the card is stale in this browser and reloading fixes it; anything else means the tool
                  is broken, and telling a teacher to reload would send them round a loop that cannot succeed.
                  Branched on the status rather than on `isError`, per the E3-07 precedent and Art. II.3: the
                  server's own string never reaches the teacher. */}
              {vergrendeling.isError && (
                <Foutmelding>
                  {vergrendeling.error instanceof ApiError && vergrendeling.error.status === 404
                    ? t("kalender.vergrendelVerdwenen")
                    : t("kalender.vergrendelMislukt")}
                </Foutmelding>
              )}
              {/* The success announcement is at panel level, not here: see the note on the `role="status"` region
                  at the top of this panel for why it cannot live inside this section. */}
            </>
          ) : (
            <p className="text-xs leading-snug text-ink-zacht">{t("kalender.vergrendelNietNodig")}</p>
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
          /* `destructiveOutline`, not `outline`: this is the one control in the panel that cannot be undone, and
             on the newly common card (an unlocked proposal) it fires the DELETE on a single click. It used to be
             visually identical to the reversible buttons stacked directly above it, separated at 390px by a
             hairline. See the variant's own note for the reasoning and the measured contrast. */
          <Button
            type="button"
            size="sm"
            variant="destructiveOutline"
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
