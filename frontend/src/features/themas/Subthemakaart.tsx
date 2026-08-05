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
  klasId,
  onAlWeg,
  onVerplaatst,
}: {
  activiteit: Activiteit;
  subthemaId: string;
  subthemaNaam: string;
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

    `|| verplaatsen` keeps the trigger in place once the panel is open. That is E3-09's lesson applied: a control
    that vanishes from under the cursor that just used it leaves the teacher holding a state they cannot undo.
  */
  const kanVerplaatsen =
    verplaatsen || bestemmingen.isPending || bestemmingen.isError || kandidaten.length > 0;

  const codes = activiteit.doelkoppelingen.map((koppeling) => koppeling.leerplandoelCode);
  const verplaatsMelding = verplaats.error instanceof ApiError ? verplaats.error.detail : undefined;

  // Grouped by thema, because two subthema's of one klas may share a naam and the thema is what tells them
  // apart. The server already orders by thema then naam, so the groups come out in that order without sorting.
  const perThema = kandidaten.reduce<{ themaId: string; themaNaam: string; items: typeof kandidaten }[]>(
    (groepen, bestemming) => {
      const laatste = groepen.at(-1);
      if (laatste?.themaId === bestemming.themaId) {
        laatste.items.push(bestemming);
      } else {
        groepen.push({ themaId: bestemming.themaId, themaNaam: bestemming.themaNaam, items: [bestemming] });
      }

      return groepen;
    },
    [],
  );

  function verplaatsNu() {
    const doel = kandidaten.find((bestemming) => bestemming.id === gekozenBestemming);
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
              onClick={() => setVerplaatsen(true)}
              aria-expanded={verplaatsen}
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
        <div className="mt-2 rounded-md border border-petrol/40 p-2.5">
          <h5 className="text-sm font-bold text-ink">{t("themabeheer.activiteitVerplaatsTitel")}</h5>
          {/* The consequence of *this* action, so it belongs in the panel that performs it rather than once
              above the list: a move can take doelen out of this class's dekking figure without leaving the klas,
              because dekking counts an activiteitkoppeling through the thema its subthema hangs under. */}
          <p className="mt-1 max-w-prose text-sm text-ink-zacht">
            {t("themabeheer.activiteitVerplaatsGevolg")}
          </p>

          {bestemmingen.isPending ? (
            <p className="mt-2 text-sm text-ink-zacht">{t("themabeheer.activiteitVerplaatsLaden")}</p>
          ) : bestemmingen.isError ? (
            <p role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.activiteitVerplaatsLijstFout")}
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
                value={gekozenBestemming}
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

              {/* A 404 is said by the section, which outlives this row; everything else is said here, where the
                  teacher can still pick another subthema. */}
              {verplaats.error instanceof ApiError && verplaats.error.status === 404 ? null : verplaats.isError ? (
                <div role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
                  <p>{t("themabeheer.activiteitVerplaatsMislukt")}</p>
                  {verplaatsMelding ? (
                    <p className="mt-1 font-normal text-ink-zacht">
                      {t("themabeheer.serverReden", { melding: verplaatsMelding })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={verplaatsNu}
                  // Disabled until a destination is chosen: the placeholder option is not a target, and a submit
                  // that can only fail is the same defect as a control that does nothing.
                  disabled={gekozenBestemming === "" || verplaats.isPending}
                  className="rounded-md bg-petrol px-2.5 py-1 text-xs font-semibold text-petrol-foreground disabled:opacity-60"
                >
                  {verplaats.isPending
                    ? t("themabeheer.activiteitVerplaatsBezig")
                    : t("themabeheer.activiteitVerplaatsBevestig")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVerplaatsen(false);
                    setGekozenBestemming("");
                  }}
                  className="rounded-md border border-input px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper-diep"
                >
                  {t("themabeheer.annuleer")}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {doelKiezen ? (
        <div className="mt-2">
          <Doelkiezer
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
