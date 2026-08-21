import { useState } from "react";

import { t, tAantal } from "../../i18n";
import { ApiError } from "../../lib/api";
import { Activiteitformulier } from "./Activiteitformulier";
import { Doelkiezer } from "./Doelkiezer";
import { Subthemaformulier } from "./Subthemaformulier";
import type { Activiteit, ActiviteitInvoer, Subthema, SubthemaInvoer } from "./types";
import {
  useKoppelActiviteitAanDoel,
  useKoppelSubthemaAanDoel,
  useMaakActiviteit,
  useOntkoppelActiviteitDoel,
  useOntkoppelSubdoel,
  useSubthemaBestemmingen,
  useVerplaatsActiviteit,
  useVerwijderActiviteit,
  useVerwijderSubthema,
  useWijzigActiviteit,
  useWijzigSubthema,
} from "./useThemas";

/**
 * One subthema of one class, with everything a teacher can do to it (E1-14 landing 2, FR-3.1/3.2, Art. IX.2).
 *
 * **Why this is its own component rather than more JSX inside `Klaslaag`:** every write below is per subthema,
 * and so is every piece of open/closed state. Keeping them here means each card owns its own state, so opening
 * the edit form on one subthema cannot leave a form open on another. That is the same defect class the
 * landing-1 audit found at thema level (MAJOR 1), avoided here by construction rather than by a `key`.
 *
 * **Destructive actions are two-step and weighted differently from the reversible ones** (the E4-06 ruling of
 * 2026-07-31): deleting says what goes with it before it happens, and the confirm is the only filled red
 * control on the card.
 */
export interface SubthemakaartProps {
  subthema: Subthema;
  klasId: string;
  klasNaam: string;
  /**
   * Called when a delete answers 404, i.e. a colleague got there first.
   *
   * **The message cannot live on this card.** Reconciling the screen (antagonist round 3, MAJOR 1) refetches
   * and the row disappears, which is the correct outcome and also unmounts whatever was rendering the notice.
   * So the card reports the fact upward and {@link Klaslaag} says it, because the section outlives the row.
   */
  onAlWeg: (soort: "subthema" | "activiteit") => void;
  /**
   * Called after an activiteit moved, with where it went (E4-08).
   *
   * **It reports upward for a sharper version of `onAlWeg`'s reason:** a move to a subthema of *another thema*
   * takes the activiteit off this screen entirely, because the class-scoped half shows one thema. The row that
   * would have said "moved" is exactly the row that is gone, so without a notice that outlives it a successful
   * move is indistinguishable from a delete. {@link Klaslaag} says it, and names the destination.
   */
  onVerplaatst: (bestemming: { activiteit: string; subthema: string; thema: string }) => void;
}

export function Subthemakaart({ subthema, klasId, klasNaam, onAlWeg, onVerplaatst }: SubthemakaartProps) {
  const [wijzigen, setWijzigen] = useState(false);
  const [verwijderen, setVerwijderen] = useState(false);
  const [subdoelKiezen, setSubdoelKiezen] = useState(false);
  const [activiteitToevoegen, setActiviteitToevoegen] = useState(false);

  const wijzigSubthema = useWijzigSubthema();
  const verwijderSubthema = useVerwijderSubthema();
  const koppelSubdoel = useKoppelSubthemaAanDoel();
  const ontkoppelSubdoel = useOntkoppelSubdoel();
  const maakActiviteit = useMaakActiviteit();

  const gekoppeldeSubdoelen = subthema.subdoelen.map((subdoel) => subdoel.koppeling.leerplandoelCode);

  function bewaarWijziging(invoer: SubthemaInvoer) {
    /*
      **The record's own klas, never the section's** (antagonist round 2, MINOR 7).

      `WijzigSubthemaAsync` calls `WijzigScope(klasId, leeftijd)`, so every save re-assigns the klas to
      whatever is passed. Taking it from the form (which takes it from the section, which takes it from the
      URL) was correct only because a klas switch currently unmounts the card. Add `keepPreviousData` to that
      query — an improvement any reviewer would wave through — and a save would silently move the subthema to
      another class. The record knows its own klas; ask it.
    */
    wijzigSubthema.mutate(
      { subthemaId: subthema.id, invoer: { ...invoer, klasId: subthema.klasId } },
      { onSuccess: () => setWijzigen(false) },
    );
  }

  function bewaarActiviteit(invoer: ActiviteitInvoer) {
    maakActiviteit.mutate(
      { subthemaId: subthema.id, invoer },
      { onSuccess: () => setActiviteitToevoegen(false) },
    );
  }

  /**
   * The server's reason, when it sent one **and** it is a reason a teacher can act on.
   *
   * A 404 is excluded for the same reason landing 1 excludes it one level up: it means a colleague deleted this
   * subthema first, so it is not a failure. It is reported to {@link Klaslaag} through `onAlWeg` rather than
   * rendered here, because the refetch that follows removes this card.
   */
  const verwijderdDoorIemandAnders =
    verwijderSubthema.error instanceof ApiError && verwijderSubthema.error.status === 404;
  const verwijderMelding =
    verwijderSubthema.error instanceof ApiError && !verwijderdDoorIemandAnders
      ? verwijderSubthema.error.detail
      : undefined;

  if (wijzigen) {
    return (
      <li className="rounded-md border border-border/70 p-3">
        <Subthemaformulier
          subthema={subthema}
          klasId={klasId}
          klasNaam={klasNaam}
          onBewaar={bewaarWijziging}
          onAnnuleer={() => setWijzigen(false)}
          bezig={wijzigSubthema.isPending}
          fout={wijzigSubthema.error}
        />
      </li>
    );
  }

  return (
    <li className="rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="font-semibold text-ink">{subthema.naam}</h4>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink-zacht">
            {tAantal(subthema.duurWeken, "themabeheer.duurEnkelvoud", "themabeheer.duur")}
            {" · "}
            {t("themabeheer.leeftijdWaarde", { leeftijd: subthema.leeftijd })}
          </span>
          {/*
            **The visible label is short and the accessible name says what it acts on.** One card carries a
            "Wijzigen" for the subthema and another for every activiteit under it, plus two "Leerdoel
            koppelen" buttons. On screen the row tells them apart; to a screen reader they were four
            identical names. Found by a test that could not pick one of them, which is the same signal a
            user gives when they cannot either.
          */}
          <button
            type="button"
            onClick={() => setWijzigen(true)}
            aria-label={t("themabeheer.subthemaWijzigAria", { naam: subthema.naam })}
            className="rounded-md border border-input px-2 py-1 text-xs font-semibold text-ink hover:bg-paper-diep"
          >
            {t("themabeheer.wijzigActie")}
          </button>
          <button
            type="button"
            onClick={() => setVerwijderen(true)}
            aria-label={t("themabeheer.subthemaVerwijderAria", { naam: subthema.naam })}
            className="rounded-md px-2 py-1 text-xs font-semibold text-suggestie-geweigerd underline hover:bg-paper-diep"
          >
            {t("themabeheer.verwijderActie")}
          </button>
        </span>
      </div>

      {subthema.probleemstelling ? (
        <p className="mt-1 text-sm text-ink">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
            {t("themabeheer.probleemstellingLabel")}
          </span>{" "}
          {subthema.probleemstelling}
        </p>
      ) : null}
      {subthema.onderzoeksvraag ? (
        <p className="mt-1 text-sm text-ink">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
            {t("themabeheer.onderzoeksvraagLabel")}
          </span>{" "}
          {subthema.onderzoeksvraag}
        </p>
      ) : null}

      {verwijderen ? (
        <div className="mt-2 rounded-md border border-suggestie-geweigerd/40 p-3">
          <h4 className="text-sm font-bold text-ink">{t("themabeheer.subthemaVerwijderTitel")}</h4>
          {/* What goes with it, and what does not: a subthema is one class's derivation, so no colleague's
              work is at stake here. Saying so is the point of the sentence. */}
          <p className="mt-1 text-sm text-ink-zacht">{t("themabeheer.subthemaVerwijderGevolg")}</p>
          {verwijderdDoorIemandAnders ? null : verwijderSubthema.isError ? (
            <div role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
              <p>{t("themabeheer.subthemaVerwijderMislukt")}</p>
              {verwijderMelding ? (
                <p className="mt-1 font-normal text-ink-zacht">
                  {t("themabeheer.serverReden", { melding: verwijderMelding })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                verwijderSubthema.mutate(
                  { subthemaId: subthema.id },
                  {
                    // **Only a 404 closes the panel** (antagonist round 4). Closing it for every error hid
                    // the one place the failure is reported, so a 500, a proxy's HTML page or a dropped
                    // connection left the row in place and said nothing at all.
                    onError: (fout) => {
                      if (fout instanceof ApiError && fout.status === 404) {
                        setVerwijderen(false);
                        onAlWeg("subthema");
                      }
                    },
                  },
                )
              }
              disabled={verwijderSubthema.isPending}
              className="rounded-md bg-suggestie-geweigerd px-3 py-1.5 text-sm font-semibold text-suggestie-geweigerd-foreground disabled:opacity-60"
            >
              {verwijderSubthema.isPending
                ? t("themabeheer.verwijderBezig")
                : t("themabeheer.subthemaVerwijderBevestig")}
            </button>
            <button
              type="button"
              onClick={() => setVerwijderen(false)}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-diep"
            >
              {t("themabeheer.annuleer")}
            </button>
          </div>
        </div>
      ) : null}

      {/* ---- Subdoelen: the goals this class attached to this subthema. ---- */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
          {t("themabeheer.subdoelenLabel")}
        </p>
        <button
          type="button"
          onClick={() => setSubdoelKiezen((open) => !open)}
          aria-label={
            subdoelKiezen
              ? undefined
              : t("themabeheer.subdoelKoppelAria", { naam: subthema.naam })
          }
          className="rounded-md border border-input px-2 py-1 text-xs font-semibold text-ink hover:bg-paper-diep"
        >
          {subdoelKiezen ? t("themabeheer.annuleer") : t("themabeheer.subdoelKoppelen")}
        </button>
      </div>

      {subthema.subdoelen.length === 0 ? (
        <p className="text-sm text-ink-zacht">{t("themabeheer.subdoelenGeen")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {subthema.subdoelen.map((subdoel) => (
            <li key={subdoel.id} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-ink">{subdoel.koppeling.leerplandoelCode}</span>
              <button
                type="button"
                onClick={() =>
                  ontkoppelSubdoel.mutate({ subthemaId: subthema.id, subdoelId: subdoel.id })
                }
                disabled={ontkoppelSubdoel.isPending}
                aria-label={t("themabeheer.ontkoppelAria", {
                  code: subdoel.koppeling.leerplandoelCode,
                  waaraan: t("themabeheer.niveauSubthema"),
                })}
                className="rounded-md px-2 py-0.5 text-xs font-semibold text-suggestie-geweigerd underline hover:bg-paper-diep disabled:opacity-60"
              >
                {t("themabeheer.ontkoppel")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {ontkoppelSubdoel.isError ? (
        <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
          {t("themabeheer.ontkoppelMislukt")}
        </p>
      ) : null}

      {subdoelKiezen ? (
        <div className="mt-2">
          <Doelkiezer
            klasId={klasId}
            waaraan={t("themabeheer.niveauSubthema")}
            gekoppeldeCodes={gekoppeldeSubdoelen}
            bezig={koppelSubdoel.isPending}
            onKoppel={(code) =>
              koppelSubdoel.mutate(
                { subthemaId: subthema.id, leerplandoelCode: code },
                { onSuccess: () => setSubdoelKiezen(false) },
              )
            }
          />
          {koppelSubdoel.isError ? (
            <p role="alert" className="mt-1 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.doelKoppelMislukt")}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ---- Activiteiten. ---- */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
          {t("themabeheer.activiteitenLabel")}
        </p>
        <button
          type="button"
          onClick={() => setActiviteitToevoegen((open) => !open)}
          aria-label={
            activiteitToevoegen
              ? undefined
              : t("themabeheer.activiteitNieuwAria", { naam: subthema.naam })
          }
          className="rounded-md border border-input px-2 py-1 text-xs font-semibold text-ink hover:bg-paper-diep"
        >
          {activiteitToevoegen ? t("themabeheer.annuleer") : t("themabeheer.activiteitNieuw")}
        </button>
      </div>

      {subthema.activiteiten.length === 0 ? (
        <p className="text-sm text-ink-zacht">{t("themabeheer.activiteitenGeen")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {subthema.activiteiten.map((activiteit) => (
            <Activiteitregel
              key={activiteit.id}
              activiteit={activiteit}
              subthemaId={subthema.id}
              subthemaNaam={subthema.naam}
              subthemaLeeftijd={subthema.leeftijd}
              klasId={klasId}
              onAlWeg={onAlWeg}
              onVerplaatst={onVerplaatst}
            />
          ))}
        </ul>
      )}

      {activiteitToevoegen ? (
        <div className="mt-2">
          <Activiteitformulier
            subthemaNaam={subthema.naam}
            onBewaar={bewaarActiviteit}
            onAnnuleer={() => setActiviteitToevoegen(false)}
            bezig={maakActiviteit.isPending}
            fout={maakActiviteit.error}
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * One activiteit with its own controls: edit, delete, and its goal links.
 *
 * Its own component for the same reason as the card above: the open/closed state belongs to this activiteit,
 * so editing one cannot leave a form open on its neighbour.
 */
function Activiteitregel({
  activiteit,
  subthemaId,
  subthemaNaam,
  subthemaLeeftijd,
  klasId,
  onAlWeg,
  onVerplaatst,
}: {
  activiteit: Activiteit;
  subthemaId: string;
  subthemaNaam: string;
  subthemaLeeftijd: string;
  klasId: string;
  onAlWeg: SubthemakaartProps["onAlWeg"];
  onVerplaatst: SubthemakaartProps["onVerplaatst"];
}) {
  const [wijzigen, setWijzigen] = useState(false);
  const [verwijderen, setVerwijderen] = useState(false);
  const [doelKiezen, setDoelKiezen] = useState(false);
  const [verplaatsen, setVerplaatsen] = useState(false);
  const [gekozenBestemming, setGekozenBestemming] = useState("");

  const wijzigActiviteit = useWijzigActiviteit();
  const verwijderActiviteit = useVerwijderActiviteit();
  const koppel = useKoppelActiviteitAanDoel();
  const ontkoppel = useOntkoppelActiviteitDoel();
  const verplaats = useVerplaatsActiviteit();

  /*
    One query for the whole section, not one per row: the key is the klas, so TanStack answers every
    Activiteitregel from the same entry and issues a single request. It runs unconditionally rather than only
    while a picker is open, because the *button* has to know whether there is anywhere to move to.
  */
  const bestemmingen = useSubthemaBestemmingen(klasId);
  const kandidaten = (bestemmingen.data ?? []).filter((bestemming) => bestemming.id !== subthemaId);

  /*
    Hidden only when we **know** there is nowhere to go, which is the honest reading of "never ship a control
    that does nothing" (the E3-06 rule): a klas with one subthema has no destination, and the screen above
    already shows why. While the list is loading, or if it failed, the control stays and the panel explains
    itself, because hiding on those two states would remove a capability that does exist.

    `|| verplaatsen` keeps the trigger in place once the panel is open. **Its original reason has expired and the
    term is kept on a narrower one** (round 4, MINOR 5): it used to cite E3-09's "a control that vanishes leaves
    the teacher holding a state they cannot undo", and since round 2 made the panel's cancel unconditional the
    state is always undoable from inside. What still holds is the plainer half: controls should not disappear
    from under the cursor that just pressed them, and since round 4 this trigger is also the panel's toggle, so
    removing it would take a way out with it.
  */
  const kanVerplaatsen =
    verplaatsen || bestemmingen.isPending || bestemmingen.isError || kandidaten.length > 0;

  const codes = activiteit.doelkoppelingen.map((koppeling) => koppeling.leerplandoelCode);
  const verplaatsMelding = verplaats.error instanceof ApiError ? verplaats.error.detail : undefined;

  /*
    The choice is **derived** from the list rather than trusted from state, which is the other half of the fix
    for what a browser found: when the refused destination is refetched away, the id in state points at a
    subthema that is no longer offered. Reading validity off the data means the picker falls back to its
    placeholder and the submit disables itself, instead of standing enabled on a choice that can only fail
    again.
  */
  const geldigeKeuze = kandidaten.some((bestemming) => bestemming.id === gekozenBestemming)
    ? gekozenBestemming
    : "";

  /** There is something to pick from, so the picker and its submit are the panel's content. */
  const heeftKeuzelijst = !bestemmingen.isPending && !bestemmingen.isError && kandidaten.length > 0;

  /**
   * A destination with another leeftijd is on offer, so the age consequence can actually happen.
   *
   * **Gated on `heeftKeuzelijst` as well, which is not belt and braces** (round 3, MINOR 6). TanStack has a
   * state with `isError: true` *and* `data` still defined (`isRefetchError`), so a failed **refetch** — from a
   * window refocus, or from the new refresh-on-any-failure rule — drops the panel into its list-error branch
   * while `kandidaten` still holds the previous list. Without this gate a graadklas would then read *"Kies je
   * een subthema met een andere leeftijd…"* directly above *"…er is nu geen bestemming om uit te kiezen"*: an
   * instruction about options the same panel says it cannot offer, which is the stale-card contradiction this
   * story has now fixed three times in three different shapes.
   */
  const kanLeeftijdWisselen =
    heeftKeuzelijst && kandidaten.some((bestemming) => bestemming.leeftijd !== subthemaLeeftijd);

  /*
    Grouped by thema, because two subthema's of one klas may share a naam and the thema is what tells them apart.

    **Keyed on the thema id rather than on adjacency** (antagonist round 1). `Thema.Naam` carries no unique
    index, so two thema's may share a naam; ordering by naam alone then interleaves their rows, and an
    adjacency reduce turns that into two groups with the same id and the same label, which is precisely what
    the grouping exists to prevent. The server now breaks the tie on thema id as well, so this map is the
    second half of one fix rather than a belt for a fixed belt: order comes from the query, identity from here.

    **Only the server half is pinned by a test** (round 2, MINOR 6): the integration suite asserts every thema's
    rows arrive contiguously, while no fixture here has two thema's sharing a naam, so reverting this map to an
    adjacency reduce passes the whole frontend suite. Recorded rather than papered over, because "defence in
    depth" and "untested" are the same sentence read from two sides.
  */
  const perThema = [...kandidaten
    .reduce((groepen, bestemming) => {
      const groep = groepen.get(bestemming.themaId) ?? {
        themaId: bestemming.themaId,
        themaNaam: bestemming.themaNaam,
        items: [] as typeof kandidaten,
      };
      groep.items.push(bestemming);
      return groepen.set(bestemming.themaId, groep);
    }, new Map<string, { themaId: string; themaNaam: string; items: typeof kandidaten }>())
    .values()];

  /**
   * The one way the panel closes, shared by the trigger and by the cancel (round 4, MAJOR).
   *
   * It exists because making the trigger a real toggle would otherwise have reintroduced round 2's MINOR 3 by a
   * new door: closing from the trigger without resetting leaves the next open showing the reason a *previous*
   * attempt failed, and leaves a stale destination preselected behind an enabled submit.
   */
  function sluitVerplaatspaneel() {
    setVerplaatsen(false);
    setGekozenBestemming("");
    verplaats.reset();
  }

  function verplaatsNu() {
    const doel = kandidaten.find((bestemming) => bestemming.id === geldigeKeuze);
    if (!doel) {
      return;
    }

    verplaats.mutate(
      { activiteitId: activiteit.id, doelSubthemaId: doel.id },
      {
        onSuccess: () => {
          setVerplaatsen(false);
          setGekozenBestemming("");
          onVerplaatst({ activiteit: activiteit.naam, subthema: doel.naam, thema: doel.themaNaam });
        },
        /*
          Only a 404, and only about the activiteit. The server was changed so a destination that vanished is a
          400 instead (see `verplaatsActiviteit`), so this branch cannot mistake one for the other. Every other
          failure keeps the panel open with its reason, which is where a teacher can still act.
        */
        onError: (fout) => {
          if (fout instanceof ApiError && fout.status === 404) {
            setVerplaatsen(false);
            onAlWeg("activiteit");
          }
        },
      },
    );
  }

  if (wijzigen) {
    return (
      <li>
        <Activiteitformulier
          activiteit={activiteit}
          subthemaNaam={subthemaNaam}
          onBewaar={(invoer) =>
            wijzigActiviteit.mutate(
              { activiteitId: activiteit.id, invoer },
              { onSuccess: () => setWijzigen(false) },
            )
          }
          onAnnuleer={() => setWijzigen(false)}
          bezig={wijzigActiviteit.isPending}
          fout={wijzigActiviteit.error}
        />
      </li>
    );
  }

  return (
    <li className="rounded-md bg-paper-diep/40 px-2.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-ink">
          <span className="font-medium">{activiteit.naam}</span>
          <span className="text-ink-zacht">
            {" · "}
            {t(`activiteitType.${typeSleutel(activiteit.activiteitType)}`)}
            {activiteit.hoek ? ` · ${t("themabeheer.hoekWaarde", { hoek: activiteit.hoek })}` : ""}
          </span>
        </span>
        {/* `flex-wrap` because this row carries four controls since E4-08 and the narrow viewport is 390px. */}
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDoelKiezen((open) => !open)}
            aria-label={
              doelKiezen ? undefined : t("themabeheer.activiteitKoppelAria", { naam: activiteit.naam })
            }
            className="rounded-md border border-input px-2 py-0.5 text-xs font-semibold text-ink hover:bg-paper-diep"
          >
            {doelKiezen ? t("themabeheer.annuleer") : t("themabeheer.activiteitDoelKoppelen")}
          </button>
          <button
            type="button"
            onClick={() => setWijzigen(true)}
            aria-label={t("themabeheer.activiteitWijzigAria", { naam: activiteit.naam })}
            className="rounded-md border border-input px-2 py-0.5 text-xs font-semibold text-ink hover:bg-paper-diep"
          >
            {t("themabeheer.wijzigActie")}
          </button>
          {kanVerplaatsen ? (
            <button
              type="button"
              /*
                Opens only, and keeps its name. It followed the doelkiezer's toggle-to-"Annuleren" shape at
                first, which put **two** controls named "Annuleren" in one row (the trigger and the panel's own
                cancel) and two named "Verplaatsen" (the trigger and the submit). A screen reader gets a row of
                duplicate names, which is precisely the landing-2 finding this row already carries three times.
                So it follows the delete flow on this same card instead: a stable trigger, an affirmative submit
                that names what it does, and one cancel inside the panel.
              */
              /*
                **A real toggle, with `aria-controls`, because it announces itself as a disclosure** (round 4,
                MAJOR). It used to open only, while `aria-expanded` reported `true` and pressing it called
                `setVerplaatsen(true)` on a state already `true`: a screen reader heard "uitgevouwen, knop" and
                activating it did nothing at all. That is the surviving half of round 2's MAJOR 1 ("an enabled
                control with no observable effect"), for exactly the users who cannot see that the panel is open.

                This repo had already ruled on the shape twice and this was a third: `Themakiezer` **removes**
                `aria-expanded` because its trigger is replaced by the panel, while `Themakaart` and
                `Generatieparametersformulier` pair it with `aria-controls` and a toggling handler. This trigger
                persists beside its panel, so it is the second shape. The visible label stays "Verplaatsen" in
                both states, which is what keeps round 2's duplicate-name defect from coming back.
              */
              onClick={() => (verplaatsen ? sluitVerplaatspaneel() : setVerplaatsen(true))}
              aria-expanded={verplaatsen}
              aria-controls={`verplaatspaneel-${activiteit.id}`}
              // Named per activiteit for the same reason as its three neighbours.
              aria-label={t("themabeheer.activiteitVerplaatsAria", { naam: activiteit.naam })}
              className="rounded-md border border-input px-2 py-0.5 text-xs font-semibold text-ink hover:bg-paper-diep"
            >
              {t("themabeheer.activiteitVerplaatsen")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setVerwijderen(true)}
            aria-label={t("themabeheer.activiteitVerwijderAria", { naam: activiteit.naam })}
            className="rounded-md px-2 py-0.5 text-xs font-semibold text-suggestie-geweigerd underline hover:bg-paper-diep"
          >
            {t("themabeheer.verwijderActie")}
          </button>
        </span>
      </div>

      {activiteit.verwachteUitkomsten ? (
        <p className="text-sm text-ink-zacht">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t("themabeheer.verwachteUitkomstenLabel")}
          </span>{" "}
          {activiteit.verwachteUitkomsten}
        </p>
      ) : null}

      {activiteit.doelkoppelingen.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {activiteit.doelkoppelingen.map((koppeling) => (
            <li key={koppeling.id} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-ink">{koppeling.leerplandoelCode}</span>
              <button
                type="button"
                onClick={() =>
                  ontkoppel.mutate({ activiteitId: activiteit.id, koppelingId: koppeling.id })
                }
                disabled={ontkoppel.isPending}
                aria-label={t("themabeheer.ontkoppelAria", {
                  code: koppeling.leerplandoelCode,
                  waaraan: t("themabeheer.niveauActiviteit"),
                })}
                className="rounded-md px-2 py-0.5 text-xs font-semibold text-suggestie-geweigerd underline hover:bg-paper-diep disabled:opacity-60"
              >
                {t("themabeheer.ontkoppel")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {verwijderen ? (
        <div className="mt-2 rounded-md border border-suggestie-geweigerd/40 p-2.5">
          <h5 className="text-sm font-bold text-ink">{t("themabeheer.activiteitVerwijderTitel")}</h5>
          <p className="mt-1 text-sm text-ink-zacht">{t("themabeheer.activiteitVerwijderGevolg")}</p>
          {verwijderActiviteit.error instanceof ApiError &&
          verwijderActiviteit.error.status === 404 ? null : verwijderActiviteit.isError ? (
            <p role="alert" className="mt-1 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.activiteitVerwijderMislukt")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                verwijderActiviteit.mutate(
                  { activiteitId: activiteit.id },
                  {
                    // Only a 404, for the reason given at subthema level.
                    onError: (fout) => {
                      if (fout instanceof ApiError && fout.status === 404) {
                        setVerwijderen(false);
                        onAlWeg("activiteit");
                      }
                    },
                  },
                )
              }
              disabled={verwijderActiviteit.isPending}
              className="rounded-md bg-suggestie-geweigerd px-2.5 py-1 text-xs font-semibold text-suggestie-geweigerd-foreground disabled:opacity-60"
            >
              {verwijderActiviteit.isPending
                ? t("themabeheer.verwijderBezig")
                : t("themabeheer.activiteitVerwijderBevestig")}
            </button>
            <button
              type="button"
              onClick={() => setVerwijderen(false)}
              className="rounded-md border border-input px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper-diep"
            >
              {t("themabeheer.annuleer")}
            </button>
          </div>
        </div>
      ) : null}

      {ontkoppel.isError ? (
        <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
          {t("themabeheer.ontkoppelMislukt")}
        </p>
      ) : null}

      {verplaatsen ? (
        <div id={`verplaatspaneel-${activiteit.id}`} className="mt-2 rounded-md border border-petrol/40 p-2.5">
          {/* Named per activiteit, because `verplaatsen` is per-row state: two rows can have a panel open at
              once, and two identical headings plus two selects called "Nieuw subthema" is the duplicate-name
              class this row already carries three times (antagonist round 1). */}
          <h5 className="text-sm font-bold text-ink">
            {t("themabeheer.activiteitVerplaatsTitel", { naam: activiteit.naam })}
          </h5>
          {/* The consequence of *this* action, so it belongs in the panel that performs it rather than once
              above the list: a move can take doelen out of this class's dekking figure without leaving the klas,
              because dekking counts an activiteitkoppeling through the thema its subthema hangs under. */}
          <p className="mt-1 max-w-prose text-sm text-ink-zacht">
            {t("themabeheer.activiteitVerplaatsGevolg")}
          </p>
          {/*
            **Owner ruling, 2026-08-05, on the antagonist's QUESTION.** Crossing a leeftijd within one klas is
            permitted, and the panel has to say what it means rather than leave it to the age printed in an
            option label. Art. IX.2 makes `(subthema × leeftijd)` the differentiation axis, so this sentence is
            about *who teaches it from now on*. The klas half is stated in the same breath, because that is the
            boundary the move can never cross and a teacher reading about one scope will wonder about the other.
          */}
          {/*
            **Rendered only when a destination with another leeftijd is actually on offer** (round 2, MINOR 9).
            The ruling was that the crossing must be *disclosed*, not that the sentence must always be printed,
            and for a non-graadklas every candidate shares the source's leeftijd, so the panel would otherwise
            carry a paragraph about something that cannot happen. Same reasoning as the fix for round 1's
            MINOR 4: tie the claim to the condition that actually holds.
          */}
          {kanLeeftijdWisselen ? (
            <p className="mt-1 max-w-prose text-sm text-ink-zacht">
              {t("themabeheer.activiteitVerplaatsLeeftijd")}
            </p>
          ) : null}

          {/*
            **Outside the branches below, deliberately.** It used to sit inside the "there are destinations"
            branch, so when the refused destination was this klas's last one the empty-state sentence replaced
            the failure notice and the teacher was told what the state is without being told that their move did
            not happen. What happened first, then what the state is.

            **No 404 branch, and that is a deletion rather than an omission** (round 4, MINOR 4). A 404 means the
            activiteit is gone, and `verplaatsNu`'s `onError` closes the panel in the same batch, so this block is
            already unmounted before it could render one. Removing the guard changed no test, including the
            dedicated 404 test, which is proof it rendered nothing rather than proof it was doing the work. The
            section says that case, because it outlives the row. Insurance that cannot fire is the shape this
            story already deleted once at the trigger, and `key={alWeg ?? "nieuw"}` before that.
          */}
          {verplaats.isError ? (
            <div role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
              <p>{t("themabeheer.activiteitVerplaatsMislukt")}</p>
              {verplaatsMelding ? (
                <p className="mt-1 font-normal text-ink-zacht">
                  {t("themabeheer.serverReden", { melding: verplaatsMelding })}
                </p>
              ) : null}
            </div>
          ) : null}

          {bestemmingen.isPending ? (
            <p className="mt-2 text-sm text-ink-zacht">{t("themabeheer.activiteitVerplaatsLaden")}</p>
          ) : bestemmingen.isError ? (
            /*
              **The sentence states the fact and a control offers the remedy** (round 4, MINOR 1). Round 3 asked
              for a remedy and the first attempt added *"Probeer het opnieuw."* to the copy with nothing to press,
              which is precisely the half-measure `Themakiezer`'s own fix round rejected: closing and reopening
              this panel issues no request at all, because the query is section-scoped, stays mounted with the row
              and has already exhausted its retries. So a teacher's only routes were a window refocus or a reload,
              and the sentence named neither.
            */
            <div role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
              <p className="max-w-prose">{t("themabeheer.activiteitVerplaatsLijstFout")}</p>
              <button
                type="button"
                onClick={() => void bestemmingen.refetch()}
                disabled={bestemmingen.isFetching}
                aria-label={t("themabeheer.activiteitVerplaatsOpnieuwAria")}
                className="mt-2 rounded-md border border-input px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper-diep disabled:opacity-60"
              >
                {bestemmingen.isFetching
                  ? t("themabeheer.activiteitVerplaatsOpnieuwBezig")
                  : t("themabeheer.activiteitVerplaatsOpnieuw")}
              </button>
            </div>
          ) : kandidaten.length === 0 ? (
            /*
              **The empty case is a sentence, not an empty picker** (antagonist round 1, MAJOR 2). The panel can
              be open when the list empties: the refetch-on-any-failure rule does it, and so does an ordinary
              window refocus. Rendering the label, a select holding only its placeholder and a disabled submit
              told a teacher to "kies een ander subthema" from a list with nothing in it, which is the same
              self-contradiction that reopened E3-07. The trigger is hidden at zero candidates for the same
              reason; this is that decision applied to the panel, which is where the earlier version disagreed
              with itself.
            */
            <p className="mt-2 max-w-prose text-sm text-ink-zacht">
              {t("themabeheer.activiteitVerplaatsGeenBestemming")}
            </p>
          ) : (
            <>
              <label
                className="mt-2 block text-xs font-semibold text-ink"
                htmlFor={`verplaats-${activiteit.id}`}
              >
                {t("themabeheer.activiteitVerplaatsLabel")}
              </label>
              <select
                id={`verplaats-${activiteit.id}`}
                aria-label={t("themabeheer.activiteitVerplaatsKiezerAria", { naam: activiteit.naam })}
                value={geldigeKeuze}
                onChange={(event) => setGekozenBestemming(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-ink sm:max-w-sm"
              >
                <option value="">{t("themabeheer.activiteitVerplaatsKies")}</option>
                {perThema.map((groep) => (
                  <optgroup key={groep.themaId} label={groep.themaNaam}>
                    {groep.items.map((bestemming) => (
                      <option key={bestemming.id} value={bestemming.id}>
                        {`${bestemming.naam} · ${t("themabeheer.leeftijdWaarde", {
                          leeftijd: bestemming.leeftijd,
                        })}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

            </>
          )}

          {/*
            **The button row sits outside every branch above, and the cancel is why** (round 2, MAJOR 1).

            The fix for round 1's MAJOR 2 replaced the picker with a sentence when no destination is left, and it
            took the cancel with it, because the cancel lived inside the "there are destinations" arm. So in the
            very state that fix exists for, and in the loading and list-error states too, the panel had **no
            control that closes it**: no cancel, no submit, no Escape handler, and a trigger above it that only
            ever sets a state which is already set. A panel with no way out, beside an enabled control with no
            observable effect, which is the rule this story invokes more than any other.

            The submit stays conditional, because it can only act when there is something to pick. The cancel is
            unconditional, because leaving must always be possible.
          */}
          <div className="mt-2 flex flex-wrap gap-2">
            {heeftKeuzelijst ? (
              <button
                  type="button"
                  onClick={verplaatsNu}
                  /*
                    Named per activiteit like the four buttons in the row above, and for the same reason: the
                    open state is per row, so two panels can be open at once and two buttons reading "Verplaats
                    naar dit subthema" are two identical accessible names (antagonist round 1). The visible label
                    stays short; the accessible name says what it acts on.
                  */
                  aria-label={t("themabeheer.activiteitVerplaatsBevestigAria", { naam: activiteit.naam })}
                  // Disabled until a destination is chosen: the placeholder option is not a target, and a submit
                  // that can only fail is the same defect as a control that does nothing.
                  disabled={geldigeKeuze === "" || verplaats.isPending}
                  className="rounded-md bg-petrol px-2.5 py-1 text-xs font-semibold text-petrol-foreground disabled:opacity-60"
                >
                  {verplaats.isPending
                    ? t("themabeheer.activiteitVerplaatsBezig")
                    : t("themabeheer.activiteitVerplaatsBevestig")}
              </button>
            ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setVerplaatsen(false);
                    setGekozenBestemming("");
                    // Kept inline rather than calling sluitVerplaatspaneel(), so the comment below stays attached
                    // to the reset it explains; the trigger's close routine does the same three things.
                    /*
                      **The reset belongs here and nowhere else.** The mutation lives on the row, not on the
                      panel, so without it the next open greets a teacher with the reason a *previous* attempt
                      failed, beside a fresh picker and nothing attempted (antagonist round 1).

                      A second reset on the trigger was written first and then removed as unreachable: the panel
                      closes only by cancelling (here), by succeeding (no error to carry) or on a 404 (after
                      which the row is refetched away, so nothing reopens). A mutation check proved it, since
                      dropping it changed no test while dropping this one fails the suite. Insurance that cannot
                      fire is the shape E1-14 already shipped once as `key={alWeg ?? "nieuw"}`.
                    */
                    verplaats.reset();
                  }}
                  aria-label={t("themabeheer.activiteitVerplaatsAnnuleerAria", { naam: activiteit.naam })}
                  className="rounded-md border border-input px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper-diep"
                >
                  {t("themabeheer.annuleer")}
                </button>
          </div>
        </div>
      ) : null}

      {doelKiezen ? (
        <div className="mt-2">
          <Doelkiezer
            klasId={klasId}
            waaraan={t("themabeheer.niveauActiviteit")}
            gekoppeldeCodes={codes}
            bezig={koppel.isPending}
            onKoppel={(code) =>
              koppel.mutate(
                { activiteitId: activiteit.id, leerplandoelCode: code },
                { onSuccess: () => setDoelKiezen(false) },
              )
            }
          />
          {koppel.isError ? (
            <p role="alert" className="mt-1 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.doelKoppelMislukt")}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The catalogue key for an activiteittype.
 *
 * Typed against the union rather than `string`, so adding an `ActiviteitType` without its Dutch label is a
 * compile error here instead of a `t()` call that renders its own key on screen. (An earlier version of this
 * comment pointed at a twin in `Klaslaag`, which landing 2's rewrite removed.)
 */
function typeSleutel(type: Activiteit["activiteitType"]) {
  return type.toLowerCase() as Lowercase<Activiteit["activiteitType"]>;
}
