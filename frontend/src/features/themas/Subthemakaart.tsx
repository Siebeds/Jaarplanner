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
}

export function Subthemakaart({ subthema, klasId, klasNaam }: SubthemakaartProps) {
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
    wijzigSubthema.mutate({ subthemaId: subthema.id, invoer }, { onSuccess: () => setWijzigen(false) });
  }

  function bewaarActiviteit(invoer: ActiviteitInvoer) {
    maakActiviteit.mutate(
      { subthemaId: subthema.id, invoer },
      { onSuccess: () => setActiviteitToevoegen(false) },
    );
  }

  const verwijderMelding =
    verwijderSubthema.error instanceof ApiError ? verwijderSubthema.error.detail : undefined;

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
        <span className="font-semibold text-ink">{subthema.naam}</span>
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
          {verwijderSubthema.isError ? (
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
              onClick={() => verwijderSubthema.mutate({ subthemaId: subthema.id })}
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
            <Activiteitregel key={activiteit.id} activiteit={activiteit} subthemaNaam={subthema.naam} />
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
  subthemaNaam,
}: {
  activiteit: Activiteit;
  subthemaNaam: string;
}) {
  const [wijzigen, setWijzigen] = useState(false);
  const [verwijderen, setVerwijderen] = useState(false);
  const [doelKiezen, setDoelKiezen] = useState(false);

  const wijzigActiviteit = useWijzigActiviteit();
  const verwijderActiviteit = useVerwijderActiviteit();
  const koppel = useKoppelActiviteitAanDoel();
  const ontkoppel = useOntkoppelActiviteitDoel();

  const codes = activiteit.doelkoppelingen.map((koppeling) => koppeling.leerplandoelCode);

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
        <span className="flex items-center gap-2">
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
          {verwijderActiviteit.isError ? (
            <p role="alert" className="mt-1 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.activiteitVerwijderMislukt")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => verwijderActiviteit.mutate({ activiteitId: activiteit.id })}
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

/** See the note on the same helper in `Klaslaag`: typed against the union so a new member fails to compile. */
function typeSleutel(type: Activiteit["activiteitType"]) {
  return type.toLowerCase() as Lowercase<Activiteit["activiteitType"]>;
}
