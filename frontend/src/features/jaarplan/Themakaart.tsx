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
   * The periods that accept nothing new, by start date, valued with the name of the vast moment blocking each
   * (E4-05, owner ruling 2026-08-06).
   *
   * **This panel needs it because it is the SC 2.5.7 route.** The board withholds the drop target for a blocked
   * period, but dragging is not the only way in and must not be: this `<select>` is the pointer-and-keyboard
   * alternative that satisfies *Dragging Movements*. Left un-narrowed it offered every period, so the one route a
   * teacher without a mouse has was the one route that still proposed a target the server refuses.
   *
   * A blocked period is **kept in the list and disabled**, not removed. Removing it would leave a teacher scanning
   * for a period that is plainly on the board; disabling it with the reason in the option says why in visible text,
   * which is what the E3-06 rule asks for.
   */
  bezettePeriodes: ReadonlyMap<string, string>;
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
 * that distinction in words (owner ruling, 2026-07-31) and now points at the control that resolves it, which is
 * **this story's** (E4-02).
 *
 * **The decision pair lives on the card face; every edit stays behind "Aanpassen" (E4-02, FR-7.1, Art. IV.1).**
 * Before this story the screen could send exactly one status, `Manueel`, from the un-reject button — so neither
 * `Aanvaard` nor `Geweigerd` was reachable, the whole rejected-card state below was code for a state no teacher
 * could produce, and a generated plan reported 0% dekking with dragging every card as the only route to a figure.
 * Fifth instance of the E2-08 / E1-15 / E0-10 / E4-06 pattern: server, endpoint, client, hook and badge all
 * existed, the switch did not.
 *
 * *Why the face and not the panel*, which is the one structural choice here. The panel holds six actions of two
 * different kinds: **decisions** (aanvaarden, weigeren), which are what a `voorgesteld` card is waiting for, and
 * **adjustments** (verplaatsen, vastzetten, uit de periode halen). Reviewing a generated plan of a dozen cards by
 * opening a dozen disclosures is the "overzichtelijk beats exhaustive" failure in its purest form, and "Aanpassen"
 * is an honest label for adjusting and a dishonest one for deciding. Consequence, and it is deliberate: since the
 * pair renders only while a decision is outstanding, **the board empties as the teacher works** and a card with no
 * buttons left is a reviewed card.
 *
 * *Weight follows `DoelsuggestieLijst`*: aanvaarden filled, weigeren `outline`, so the same decision reads the same
 * way wherever a teacher meets it, exactly as the shared status-badge tokens already do. **That is why
 * "Verplaatsen" below is no longer the default variant** — two filled buttons on a 288px card are two main
 * actions, and moving a thema is not the main thing to do with a proposal. `secondary` was not an option: E7-10
 * records that variant at 1,16:1 against the card with no border at all.
 *
 * *On a **stale** card the two halves of the decision part company, and the asymmetry is the point.*
 * **Aanvaarden is withheld**, for the reason E4-06 established for the lock: accepting would produce a card
 * labelled "Aanvaard" that still covers nothing and still withholds the whole dekking figure, so it resolves
 * nothing while looking as though it had. **Weigeren is offered**, and the first version of this story wrongly
 * withheld it too, by carrying the accept argument across to a case it does not describe. `DekkingService`
 * counts `IsVervallen && !IsGeweigerd` as unresolved, so **a weigering is precisely what resolves a stale
 * proposal** and restores the withheld figure; that service was written expecting this state to exist. Without
 * it, a teacher who wants to say *no* to a stale proposal has two routes and both are wrong: re-placing it sets
 * `Manueel`, which makes the thema **count** (the opposite of rejecting it, and there is then no decision pair
 * left to undo it), and "Uit het jaarplan halen" is unrecoverable in a codebase with no soft delete. Offering
 * a resolution is not the same as offering a *keep* remedy, which is what E4-06 actually banned here.
 *
 * *One consequence for E5:* `DekkingService`'s comment justifies poisoning the figure on a stale `voorgesteld`
 * placement by saying "the teacher may still accept it". After this story they cannot. The conclusion survives
 * because re-placement still raises the figure, but the stated reason is now half stale, and E5-02 should not
 * quote it.
 */
export function Themakaart({
  plaatsing,
  klasId,
  blokken,
  verplaatsstaat,
  bezettePeriodes,
}: ThemakaartProps) {
  const [paneelOpen, setPaneelOpen] = useState(false);
  const paneelId = useId();

  // Hoisted to the card and passed down, rather than one instance here and another in the panel. One placement has
  // one status, so two instances could each hold their own `isPending` over the same row, and it puts the pending
  // flag and the announcement in one place.
  //
  // **This closes one direction of the race, not both, and the earlier version of this comment claimed both.**
  // The panel's `bezig` includes `statuswijziging.isPending`, so a decision in flight disables Verplaatsen,
  // Vastzetten and the delete. The reverse is open: these face buttons check only `statuswijziging.isPending`, so
  // with the panel open a teacher can fire Verplaatsen and then Aanvaarden and leave two PUTs against one row
  // outstanding, with last-response-wins deciding the visible status (`usePlanMutatie` does not serialise, and both
  // handlers write the whole plan into the cache). Left open deliberately rather than fixed: closing it means the
  // card face reading four mutations' pending flags, i.e. the panel's whole `bezig` lifted to the card, which is a
  // larger change to E3-07's and E4-06's controls than this story should make. The consequence is bounded — every
  // one of those writes returns the full plan, so the board self-corrects on the next response, and no write is
  // lost or silently reordered server-side. Stated so the next story can close it on purpose.
  const statuswijziging = useWijzigPlaatsingStatus(klasId);

  /**
   * The two halves of the decision, deliberately **not** one flag.
   *
   * They were one flag in this story's first version, which is how the accept argument silently annexed the
   * reject case. Splitting them makes the asymmetry a decision someone has to look at: see the class note for
   * why a stale proposal may be rejected but not accepted, and `DekkingService`'s
   * `IsVervallen && !IsGeweigerd` for the code that depends on it.
   */
  const magAanvaarden = plaatsing.status === "Voorgesteld" && !plaatsing.isVervallen;
  const magWeigeren = plaatsing.status === "Voorgesteld";

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
      {/* The decision announced, not only shown (WCAG 2.2 SC 4.1.3). The status badge changing from "Voorgesteld"
          to "Aanvaard" is silent to a screen reader, and the buttons that made it happen unmount in the same render
          because `magWeigeren` turns false, so this region has to sit **outside** that block or it would announce
          into a subtree that no longer exists. That is not a hypothetical: E4-06 shipped the same fix inside the
          lock section, found it silent in exactly the case that mattered, and moved it to panel level.

          Keyed on the persisted `plaatsing.status`, so it reports what the server stored rather than what was
          requested. `isSuccess` goes false while the next request is in flight, which empties the text and lets a
          repeat announce. */}
      <p role="status" className="sr-only">
        {statuswijziging.isSuccess
          ? plaatsing.status === "Aanvaard"
            ? t("kalender.beslisAanvaard", { thema: plaatsing.themaNaam })
            : plaatsing.status === "Geweigerd"
              ? t("kalender.beslisGeweigerd", { thema: plaatsing.themaNaam })
              : plaatsing.status === "Manueel"
                ? t("kalender.beslisManueel", { thema: plaatsing.themaNaam })
                : ""
          : ""}
      </p>

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
        {/* Inside the existing actions block rather than in a section of its own: one hairline separates "the card"
            from "what you can do with it", and decisions come before the adjust link in reading order. A second
            divider would be a new structural device for a distinction the button weights already carry.

            No general explanation here, deliberately: what a decision means for the dekking is stated once above
            the board (`kalender.beslisUitleg`), because prose repeated on a dozen cards is the first thing this
            screen cuts. The one sentence that *is* per-card is the stale exception below, because it is true of
            this card and false of its neighbours, which is exactly the kind of fact a shared line cannot carry. */}
        {magWeigeren && (
          <div className="mb-2 flex flex-col gap-1.5">
            {/* Why this card offers a weigering and no aanvaarding. Without it the missing button is a silent
                omission, and the sentence above the board would be telling this teacher to do something this card
                does not let them do. The same treatment `vergrendelUitlegVervallen` already gives the lock. */}
            {!magAanvaarden && (
              <p className="text-xs leading-snug text-ink-zacht">{t("kalender.beslisVervallen")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {/* Each button reports only its **own** request as busy. `statuswijziging.isPending` alone would put
                  "Bezig…" on "Aanvaarden" while the teacher's "Weigeren" is in flight, which is the mistake E4-06
                  fixed on the lock toggle. `variables` is the in-flight argument, so no extra state is needed.

                  The `aria-label` deliberately keeps naming the thema while the visible label flips to "Bezig…", so
                  the two disagree for the duration of the request (SC 2.5.3). Left as the file's existing pattern
                  (`aanpassen`/`aanpassenSluiten` do the same) rather than fixed in two controls only; routed to
                  E7-10 with the SC 2.5.8 item, so the screen gets one answer instead of three. */}
              {magAanvaarden && (
                <Button
                  type="button"
                  size="sm"
                  disabled={statuswijziging.isPending}
                  aria-label={t("kalender.aanvaardenLabel", { thema: plaatsing.themaNaam })}
                  onClick={() =>
                    statuswijziging.mutate({ plaatsingId: plaatsing.id, status: "Aanvaard" })
                  }
                >
                  {statuswijziging.isPending && statuswijziging.variables?.status === "Aanvaard"
                    ? t("kalender.bezig")
                    : t("kalender.aanvaarden")}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={statuswijziging.isPending}
                aria-label={t("kalender.weigerenLabel", { thema: plaatsing.themaNaam })}
                onClick={() =>
                  statuswijziging.mutate({ plaatsingId: plaatsing.id, status: "Geweigerd" })
                }
              >
                {statuswijziging.isPending && statuswijziging.variables?.status === "Geweigerd"
                  ? t("kalender.bezig")
                  : t("kalender.weigeren")}
              </Button>
            </div>
          </div>
        )}

        {/* A failed decision leaves the card `Voorgesteld`, so `magWeigeren` is still true and this sits beside the
            buttons that produced it. The panel renders the same mutation's error for the un-reject button; the two
            can never both show, because that section needs `Geweigerd` and these buttons need `Voorgesteld`. */}
        {magWeigeren && statuswijziging.isError && (
          <div className="mb-2">
            <Foutmelding>{statusFoutmelding(statuswijziging.error)}</Foutmelding>
          </div>
        )}

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
            bezettePeriodes={bezettePeriodes}
            statuswijziging={statuswijziging}
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
/**
 * Which sentence a failed **move** gets, keyed on the status (E4-05).
 *
 * Three cases, and the middle one is new because ruling 2 made a fourth status reachable here. Before it, a 409 fell
 * through to *"Verplaatsen is nu niet beschikbaar. Meld dit aan de beheerder van de tool."* — the tool blaming itself,
 * and sending the teacher to escalate, for a rule it had just applied on the strength of the teacher's own setting.
 *
 * A named function rather than a nested ternary, per {@link Themakiezer}'s `plaatsFoutmelding` precedent: the point is
 * that these are three distinct answers and it should read as three.
 *
 * - **409** the target is bezet. The picker disables such an option, so reaching this means the page is out of date.
 * - **400** the teacher can fix it by choosing differently.
 * - anything else: the tool is broken, and *"kies een periode"* would send them round a loop that cannot succeed.
 */
function verplaatsFoutmelding(fout: unknown): string {
  if (fout instanceof ApiError && fout.status === 409) {
    return t("kalender.verplaatsBezet");
  }

  if (fout instanceof ApiError && fout.status === 400) {
    return t("kalender.verplaatsMislukt");
  }

  return t("kalender.verplaatsOnbeschikbaar");
}

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
  bezettePeriodes,
  statuswijziging,
  verplaatsstaat,
  onKlaar,
}: {
  id: string;
  plaatsing: Themaplaatsing;
  klasId: string;
  blokken: readonly Planningsblok[];
  /** See {@link ThemakaartProps.bezettePeriodes}: this panel is the SC 2.5.7 route, so it needs the same answer. */
  bezettePeriodes: ReadonlyMap<string, string>;
  /** Owned by {@link Themakaart}: one placement has one status. See the note at its declaration. */
  statuswijziging: ReturnType<typeof useWijzigPlaatsingStatus>;
  verplaatsstaat: Verplaatsstaat;
  onKlaar: () => void;
}) {
  const [doelBlok, setDoelBlok] = useState("");
  const [vraagtBevestiging, setVraagtBevestiging] = useState(false);

  const verplaats = useVerplaatsPlaatsing(klasId);
  const verwijder = useVerwijderPlaatsing(klasId);
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

  // **How many of those a teacher can actually pick** (antagonist round 2, finding C). Since a blocked period is kept
  // in the list and disabled, `doelen.length > 0` stopped meaning "there is somewhere to move this". In a year where
  // every other period is bezet, the panel rendered "Kies hieronder een themaperiode…" over a placeholder and one
  // unselectable option — an instruction to do something impossible, which is exactly the standard applied to the
  // board's own explanation one finding earlier. Reachable on a two-period year with two oudercontacten.
  const kiesbareDoelen = doelen.filter((blok) => !bezettePeriodes.has(blok.start));

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
      {/* **`kiesbareDoelen` gates only the `kan` branch, and the asymmetry is the whole point** (antagonist round 3,
          MAJOR). Round 2 gated the picker and added a sentence, and left THIS instruction — which is the one that
          actually promises a picker — on staleness alone. On a stale card in a year where every period is bezet the
          panel therefore read *"Kies hieronder een themaperiode … of versleep de kaart"* over no picker and onto a
          board whose every column is a disabled droppable: both halves false, which is verbatim the state an owner
          ruling reopened E3-07 over. My round-2 comment claimed "the instruction and the picker appear and disappear
          together"; that was true of the sentence I added and false of the instruction already here.

          The other two branches must NOT be gated: they do not offer a picker, they say where re-placing *does* work
          (`herplaatsAnderNiveau`) or that the view could not be read (`niveauOnbekend`), and withholding those would
          take away the only way forward — the E3-06 rule, pointing the other way. */}
      {plaatsing.isVervallen &&
        !isGeweigerd &&
        (verplaatsstaat !== "kan" || kiesbareDoelen.length > 0) && (
          <p className="text-xs leading-snug text-attentie-ink">{t(HERPLAATSUITLEG[verplaatsstaat])}</p>
        )}

      {/* Split on `isVervallen` (E3-07 reopening, 2026-08-04), exactly as the rejected section below already
          splits `weigeringUitleg`.

          The shared string closed with *"Daarna kan je het thema een **andere** themaperiode geven"*, and on a
          stale card *andere* presupposes a themaperiode this card does not have — while the paragraph rendered
          directly beneath it says *"dit thema staat in geen enkele periode"*. One card, two sentences, the first
          presupposing what the second denies: the class this story was reopened over, in a new instance.

          **What is deliberately unchanged is the non-stale sentence.** Its *andere* is correct **wherever the
          server's `isVervallen` and the client's own staleness fallback agree**, which is every steady state, and
          repairing the correct half to fix the broken one is the mistake E4-02 recorded on itself. The second step
          stays named in both variants (the owner's ruling on E3-08's QUESTION-A), and neither names a view, so
          both stay true at either tier.
          *Where they disagree it is not correct, and that state is recorded further down this file:* a card caught
          only by `vervallenPlaatsingen`'s `!starts.has(blokStart)` fallback has `isVervallen === false`, so it
          takes the non-stale branch while sitting in no period. This still branches on the **server** flag on
          purpose, for the reason the rejected section below gives at length: that is the flag `DekkingService`
          derives dekking from, so the copy stays aligned with the figure rather than with the notice.
          *(An earlier revision of this comment said the sentence is correct "on the state this branch selects" and
          then described a member of that state where it is not. A qualifier that its own next sentence negates is
          worse than the unqualified claim it replaced; antagonist, round 2.)*

          *The promise itself was never false, and the fix does not touch it:* reversing a rejection yields
          `Manueel`, and the picker returns **where the board can offer one** — `doelen` above is gated on
          `isGeweigerd || verplaatsstaat !== "kan"`, so at the subthemaperiode tier and at an unrecognised tier
          reversing restores no picker, which is E3-08's round-3 fix rather than a gap here. Measured in a browser
          at the coarse tier. Only the word was wrong. */}
      {isGeweigerd && (
        <p className="text-xs leading-snug text-attentie-ink">
          {plaatsing.isVervallen
            ? t("kalender.weigeringEerstTerugdraaienVervallen")
            : t("kalender.weigeringEerstTerugdraaien")}
        </p>
      )}

      {/* **Gated on a SELECTABLE period, not merely on a listed one** (antagonist round 2, finding C): since a bezet
          period is kept and disabled, `doelen.length` stopped answering "is there anywhere to move this".

          **Split on `isVervallen` like every other sentence in this panel** (round 3, MAJOR): a stale card is in no
          period, so *"nergens **anders** heen"* presupposes a themaperiode it does not have, two lines under a
          paragraph saying it stands in none. Three earlier strings in this file were repaired for exactly that
          (`weigeringUitlegVervallen`, `herplaatsUitlegVervallen`, `herplaatsAnderNiveau`); this one arrived carrying
          the defect they were fixed for. */}
      {kiesbareDoelen.length === 0 && doelen.length > 0 && (
        <p className="text-xs leading-snug text-ink-zacht">
          {t(
            plaatsing.isVervallen
              ? "kalender.verplaatsGeenVrijePeriodeVervallen"
              : "kalender.verplaatsGeenVrijePeriode",
          )}
        </p>
      )}

      {kiesbareDoelen.length > 0 && (
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
            {doelen.map((blok) => {
              // Kept and DISABLED rather than dropped (E4-05, owner ruling 2026-08-06). A silently shorter list
              // sends a teacher looking for a period that is plainly on the board; a disabled option names the
              // period, says it is bezet and names the commitment, all in visible text.
              const bezetDoor = bezettePeriodes.get(blok.start);

              return (
                <option key={blok.start} value={blok.start} disabled={bezetDoor !== undefined}>
                  {bezetDoor !== undefined
                    ? t("kalender.periodeKeuzeBezet", {
                        ordinaal: blok.ordinaal,
                        periode: formatteerPeriode(blok.start, blok.eind),
                        moment: bezetDoor,
                      })
                    : t("kalender.periodeKeuze", {
                        ordinaal: blok.ordinaal,
                        periode: formatteerPeriode(blok.start, blok.eind),
                      })}
                </option>
              );
            })}
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

          {/* `outline`, not the default filled variant (E4-02). It used to be the card's only primary, which put the
              loudest weight on an adjustment while the decision the card was actually waiting for had no control at
              all. Now that "Aanvaarden" is that primary on the face, a filled button here would be a second main
              action on a 288px card. All three adjustments therefore read as one family, with the unrecoverable one
              marked out by `destructiveOutline` (E4-06 ruling 2), which is a cleaner hierarchy than before rather
              than a flatter one: the picker's own label and `select` already say what this button submits. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
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
          {verplaats.isError && <Foutmelding>{verplaatsFoutmelding(verplaats.error)}</Foutmelding>}
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
                  `voorgesteld` placement counts for nothing there.

                  **Reworded by E4-02, which retired the reason for the old phrasing.** It used to say the thema
                  counts once the teacher "takes the proposal over" — a *condition* rather than an instruction,
                  covering both `aanvaard` and `manueel`, deliberately naming no button because the accept control
                  did not exist. It exists now, on this card's face, so the sentence names it:
                  *"Aanvaard het thema als het moet meetellen."* Two things that phrasing gives up, recorded rather
                  than glossed: it names one of the two counting statuses, and it is an imperative. Both are
                  acceptable here and only here, because this paragraph renders **only** on a non-stale
                  `voorgesteld` placement, which is exactly the state where "Aanvaarden" is on screen a few lines
                  up. On any other state it would point at a control that is not there. A future story that
                  loosens this condition has to re-read the string, not just the guard.

                  **E4-01 loosened it and the string stays as it is, deliberately** (round-2 audit, which asked for
                  exactly this re-read). E4-01 made the second counting route explicit in `sleepUitleg`: verplaatsen
                  turns a voorstel into the teacher's own choice, so it counts too. Naming that route *here* was
                  tried and reverted, because this paragraph carries **no tier condition** while moving exists only
                  at the themaperiode tier: at `Subthemaperiode` it would name an action the panel around it cannot
                  perform, and pointing at "de weergave Themaperiodes" from inside a card is the two-step inference
                  the same audit rejected one screen up. So the sentence stays **under-inclusive rather than
                  false**: aanvaarden is a route that is always available where this renders, and it is the one on
                  screen. The complete rule is stated once above the board, on the tier where both routes exist.

                  Note for E4-05/E4-07: this is not one of the six `kalender.vergrendel*` strings E4-06 listed for
                  re-reading (it makes no hergeneratie claim), but it *has* changed since E4-06 quoted it, so read
                  the file rather than that list. */}
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
          {/* Two variants, because E4-02 made the second state reachable in one click and the single string was
              false about it. `weigeringUitleg` (E4-06) closes with *"het thema komt dan als jouw eigen keuze in
              deze themaperiode"* — true of a rejection inside a real period, and a promise of a period that does
              not exist on a **stale** card: un-rejecting yields `Manueel` with `isVervallen` still true, so the
              card stays in the "Te herzien" notice and `DekkingService` still excludes it. It also contradicted
              `weigeringEerstTerugdraaien`, printed a few lines above on the same card, which correctly describes
              the reversal and the re-placement as two steps. One card, two sentences, opposite claims: the exact
              shape E3-07 is reopened over.

              Before this story that state took a rejection *plus* a vakantie edit by the school. Now "Weigeren"
              sits on the stale card and `beslisVervallen` recommends it, so the false promise became the
              advertised destination. That is why the split is this story's and not E5-02's.

              **One gap the split does not close, recorded rather than left implicit (round-3 audit).** This
              branches on the server's `isVervallen`, while `kalenderFormat.vervallenPlaatsingen` puts a card in
              the "Te herzien" notice on the wider `isVervallen || !starts.has(blokStart)` — a deliberate client
              fallback for the two views disagreeing. On a card caught only by that fallback, this renders
              `weigeringUitleg`, i.e. the sentence above, on a card that is in no period. Left on the server flag
              on purpose: it is the one the *server* also uses to derive dekking, so the copy stays aligned with
              the figure rather than with the notice, and the divergence is a transient race between two
              independently refetching queries rather than a steady state. Widening this branch would align it
              with the notice and mis-align it with `DekkingService`, which is the worse trade while E5-02's
              ruling on that divergence is still open. */}
          <p className="text-xs leading-snug text-ink-zacht">
            {plaatsing.isVervallen
              ? t("kalender.weigeringUitlegVervallen")
              : t("kalender.weigeringUitleg")}
          </p>
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
          {statuswijziging.isError && (
            <Foutmelding>{statusFoutmelding(statuswijziging.error)}</Foutmelding>
          )}
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
// Exported for `Themakiezer` (E4-03) rather than copied into it: the feature already carries this markup twice (here
// and inline in `Jaarplankalender`), and a third copy is how a `role="alert"` ends up missing from one of them. The
// other copy is deliberately left alone — E7-15 owns consistency sweeps.
export function Foutmelding({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded bg-suggestie-geweigerd/10 px-2 py-1.5 text-xs font-medium leading-snug text-suggestie-geweigerd"
    >
      {children}
    </p>
  );
}

/**
 * Which sentence a failed status change gets.
 *
 * A 404 means the placement is gone from the plan and this browser is looking at a stale board, so reloading is the
 * fix; anything else means the tool is broken, and "probeer het opnieuw" is then a loop that cannot succeed.
 *
 * **This is the lock toggle's split, not the move path's**, and an earlier version of this comment ran the two
 * together. The lock branches on **404** with these same two meanings. The move path branches on **400** with
 * different ones: a 400 there is *fixable by choosing differently* (the server refuses a date that starts no
 * period, or a thema already in the target period, all three documented as 400 on `JaarplanController`), so its
 * fixable case is "pick another period" rather than "reload". What the two share is only the shape: branch on the
 * status code, never echo the server's body. Two audits (E3-07 on the move, E4-06 on the lock) each required that
 * shape of a control in this panel, which is why the third one was built with it.
 *
 * *The text of `statusVerdwenen` duplicates `vergrendelVerdwenen` word for word today, and that is deliberate rather
 * than an oversight.* They are the same fact about the same object reported under two different controls, and the
 * lock family is guarded as a family (`catalogus.test.ts`), so folding them into one key would put a decision string
 * inside a prefix whose next reword is aimed at the lock.
 */
function statusFoutmelding(fout: unknown) {
  return fout instanceof ApiError && fout.status === 404
    ? t("kalender.statusVerdwenen")
    : t("kalender.statusMislukt");
}

/** Maps the API's PascalCase status onto the nl.json key for it. */
function statusSleutel(status: Themaplaatsing["status"]) {
  return status.toLowerCase() as Lowercase<Themaplaatsing["status"]>;
}
