import { useState } from "react";

import { t } from "../../i18n";
import { Doelkiezer } from "../themas/Doelkiezer";
import type { Activiteit, Subthema } from "../themas/types";
import {
  useKoppelActiviteitAanDoel,
  useKoppelSubthemaAanDoel,
  useOntkoppelActiviteitDoel,
  useOntkoppelSubdoel,
  useThemaVoorKlas,
} from "../themas/useThemas";

/**
 * This class's own subthema's under a school-wide thema, opened from the jaarplan board (2026-08-21 redesign,
 * Fase A) so a teacher can koppel doelen while planning the year instead of switching to `/themas`.
 *
 * **Read-only about content, writable about doelkoppeling.** Everything a teacher can do to a subthema or
 * activiteit itself (aanmaken, wijzigen, verplaatsen, verwijderen) stays on `/themas` — `Klaslaag.tsx` and
 * `Subthemakaart.tsx` already own that, and duplicating it here would be a second place those decisions could
 * drift apart. This component reuses the same mutations and the same `Doelkiezer` those screens use, so a link
 * made here and one made on `/themas` are indistinguishable to the server and to the dekking figure.
 *
 * **No new strings.** The copy is the existing `themabeheer.*` catalogue (the action is the same action,
 * wherever it is triggered from); only the toggle that opens this panel on the jaarplan board owns new
 * `kalender.subthemas*` keys.
 */
export interface ThemakaartSubthemasProps {
  themaId: string;
  klasId: string;
}

export function ThemakaartSubthemas({ themaId, klasId }: ThemakaartSubthemasProps) {
  const thema = useThemaVoorKlas(themaId, klasId);
  const subthemas: Subthema[] = thema.data?.subthemas ?? [];

  if (thema.isPending) {
    return <p className="text-xs text-ink-zacht">{t("themabeheer.detailLaden")}</p>;
  }

  if (thema.isError) {
    return (
      <p role="alert" className="text-xs font-medium text-suggestie-geweigerd">
        {t("themabeheer.detailFout")}
      </p>
    );
  }

  if (subthemas.length === 0) {
    return <p className="text-xs text-ink-zacht">{t("themabeheer.subthemasGeen")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {subthemas.map((subthema) => (
        <SubthemaRegel key={subthema.id} subthema={subthema} klasId={klasId} />
      ))}
    </ul>
  );
}

function SubthemaRegel({ subthema, klasId }: { subthema: Subthema; klasId: string }) {
  const [subdoelKiezen, setSubdoelKiezen] = useState(false);
  const koppelSubdoel = useKoppelSubthemaAanDoel();
  const ontkoppelSubdoel = useOntkoppelSubdoel();
  const gekoppeldeSubdoelen = subthema.subdoelen.map((subdoel) => subdoel.koppeling.leerplandoelCode);

  return (
    <li className="rounded-md bg-paper-diep/40 px-2.5 py-2">
      <p className="text-sm font-semibold text-ink">
        {subthema.naam}
        {/* Named, not just the subthema: a graadklas can legitimately hold two subthema's of the same naam
            at two leeftijden under one thema (Subthemakaart.tsx's own 2026-08-05 ruling), and this row's
            "Leerdoel koppelen" button would otherwise ask a byte-identical question for two different
            objects — antagonist MAJOR-2, 2026-08-23. */}
        <span className="ml-1.5 text-xs font-normal text-ink-zacht">
          {t("themabeheer.leeftijdWaarde", { leeftijd: subthema.leeftijd })}
        </span>
      </p>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
          {t("themabeheer.subdoelenLabel")}
        </p>
        <button
          type="button"
          onClick={() => setSubdoelKiezen((open) => !open)}
          aria-label={
            subdoelKiezen ? undefined : t("themabeheer.subdoelKoppelAria", { naam: subthema.naam })
          }
          className="rounded-md border border-input px-2 py-0.5 text-xs font-semibold text-ink hover:bg-paper-diep"
        >
          {subdoelKiezen ? t("themabeheer.annuleer") : t("themabeheer.subdoelKoppelen")}
        </button>
      </div>

      {subthema.subdoelen.length === 0 ? (
        <p className="text-xs text-ink-zacht">{t("themabeheer.subdoelenGeen")}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
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
        <p role="alert" className="mt-1 text-xs font-medium text-suggestie-geweigerd">
          {t("themabeheer.ontkoppelMislukt")}
        </p>
      ) : null}

      {subdoelKiezen ? (
        <div className="mt-1.5">
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
            <p role="alert" className="mt-1 text-xs font-medium text-suggestie-geweigerd">
              {t("themabeheer.doelKoppelMislukt")}
            </p>
          ) : null}
        </div>
      ) : null}

      {subthema.activiteiten.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-border pt-1.5">
          {subthema.activiteiten.map((activiteit) => (
            <ActiviteitRegel key={activiteit.id} activiteit={activiteit} klasId={klasId} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ActiviteitRegel({ activiteit, klasId }: { activiteit: Activiteit; klasId: string }) {
  const [doelKiezen, setDoelKiezen] = useState(false);
  const koppel = useKoppelActiviteitAanDoel();
  const ontkoppel = useOntkoppelActiviteitDoel();
  const codes = activiteit.doelkoppelingen.map((koppeling) => koppeling.leerplandoelCode);

  return (
    <li className="rounded-md px-1.5 py-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span className="text-xs font-medium text-ink">{activiteit.naam}</span>
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
      </div>

      {activiteit.doelkoppelingen.length > 0 ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
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

      {ontkoppel.isError ? (
        <p role="alert" className="mt-0.5 text-xs font-medium text-suggestie-geweigerd">
          {t("themabeheer.ontkoppelMislukt")}
        </p>
      ) : null}

      {doelKiezen ? (
        <div className="mt-1">
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
            <p role="alert" className="mt-1 text-xs font-medium text-suggestie-geweigerd">
              {t("themabeheer.doelKoppelMislukt")}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
