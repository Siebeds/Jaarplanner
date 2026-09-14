import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { IcoonKruis, IcoonPlus } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { useActieveSelectie } from "../../lib/selectie";
import { useRechten } from "../../lib/rechten";
import { t, telWoord } from "../../i18n";
import type { KlasWeergave } from "../../lib/types";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";
import { Algemeneficheformulier } from "./Algemeneficheformulier";
import {
  useAlgemeneFiches,
  useKoppelFicheDoel,
  useMaakAlgemeneFiche,
  useOntkoppelFicheDoel,
  useVerwijderAlgemeneFiche,
  useWijzigAlgemeneFiche,
  type AlgemeneFicheWeergave,
} from "../algemene-fiches/gegevens";

/**
 * A class's algemene fiches: the onthaal, the turnles, whatever recurs in its week and belongs to no
 * thema (owner, 2026-09-11).
 *
 * **Shaped like the Hoeken part, on purpose.** Both are per klas, both are a short list of things a
 * teacher defines once and plans many times, and two parts of one settings screen that differ only in
 * how they reflow read as a rendering fault. What this one adds is the goals, because a fiche carries
 * doelen and a hoek does not.
 *
 * *It was a section under Hoeken on the single Instellingen page before that page was split into
 * parts.* Its title is now the page's, drawn by `AlgemeneFichesScherm`, which is why it opens with
 * its controls and no heading.
 *
 * **The room is chosen here, and it defaults to the class the teacher is looking at.** The Hoeken
 * part defaults to the first class, which is harmless for furniture; for goals it is not, because
 * the goal picker narrows to the chosen class's jaar/fase and would otherwise offer K3 goals to an L1
 * teacher who opened settings from her own class.
 *
 * **Whether the goals count is said on the row, and only the half that is certain.** A fiche that
 * stands nowhere in the agenda contributes nothing to dekking, and a row with goals and no placement
 * says so. A planned one says how often it is planned and stops there: whether a particular goal
 * then moves this class's figure also depends on the jaar/fase it is measured against, which this row
 * does not know.
 *
 * **A klas's fiches, their goals and their placements are that klas's planning** (E6-02, ADR-0030 §3, R7; the fiche
 * goal links are one klas's, so R19 does not reach them, see the slice 3 worklog). Directie and the klas's own
 * leerkrachten change them; anyone else reads them, with one quiet line naming the klas.
 */
export function Algemenefichesectie({ klassen, laadt }: { klassen: KlasWeergave[]; laadt: boolean }) {
  const { klas: actieveKlas } = useActieveSelectie();
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [formulier, setFormulier] = useState<{ fiche?: AlgemeneFicheWeergave } | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<AlgemeneFicheWeergave | null>(null);

  // Derived during render, like the Hoeken part's picker: a deleted class cannot leave this pointing
  // at a row that is gone.
  const klasId =
    [gekozen, actieveKlas?.id].find((id) => id != null && klassen.some((k) => k.id === id)) ??
    klassen[0]?.id ??
    null;
  const klas = klassen.find((k) => k.id === klasId) ?? null;

  const { data: fiches, isPending } = useAlgemeneFiches(klasId);
  const maak = useMaakAlgemeneFiche(klasId);
  const wijzig = useWijzigAlgemeneFiche(klasId);
  const verwijder = useVerwijderAlgemeneFiche(klasId);
  const koppel = useKoppelFicheDoel(klasId);
  const ontkoppel = useOntkoppelFicheDoel(klasId);

  const bezig = formulier?.fiche ? wijzig.isPending : maak.isPending;
  const fout = formulier?.fiche ? wijzig.error : maak.error;
  const doelFout = koppel.error ?? ontkoppel.error;

  // `bekend`, not "not loading": a failed `/api/ik` proves nothing about rights (fix round 1, F3).
  const { mag, bekend: rechtenBekend } = useRechten();
  const magBewerken = mag.klasplanningBewerken(klasId);

  return (
    <div className="flex flex-col gap-3">
      {/* Which room on the left, once above the list, and the action on the right: the row Klassen
          and Hoeken open with. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex flex-wrap items-center gap-2 text-meta text-inkt-zacht">
          {t("algemeneFiches.klas")}
          <Keuze
            value={klasId ?? ""}
            disabled={klassen.length === 0}
            onChange={(e) => {
              setGekozen(e.target.value);
              koppel.reset();
              ontkoppel.reset();
            }}
            className="w-auto"
          >
            {klassen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.naam}
              </option>
            ))}
          </Keuze>
        </label>

        {magBewerken ? (
          <Knop
            rang="rustig"
            className="h-9 min-h-9 px-3 text-meta"
            disabled={klasId === null}
            onClick={() => {
              maak.reset();
              setFormulier({});
            }}
          >
            <IcoonPlus aria-hidden="true" className="h-4 w-4" />
            {t("algemeneFiches.toevoegen")}
          </Knop>
        ) : null}
      </div>

      {rechtenBekend && !magBewerken && klas ? (
        <p className="text-meta text-inkt-zacht">{t("rechten.fichesAlleenBekijken", { klas: klas.naam })}</p>
      ) : null}

      {laadt || (klasId !== null && isPending) ? (
        <Laadlijst rijen={2} />
      ) : klassen.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("algemeneFiches.geenKlassen")}</p>
      ) : (fiches ?? []).length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("algemeneFiches.geenFiches")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(fiches ?? []).map((fiche) => (
            <li key={fiche.id}>
              <Ficherij
                fiche={fiche}
                magBewerken={magBewerken}
                fasen={klas?.jaarFasen}
                doelBezig={
                  (koppel.isPending && koppel.variables?.ficheId === fiche.id) ||
                  (ontkoppel.isPending && ontkoppel.variables?.ficheId === fiche.id)
                }
                onKoppel={(leerplandoelCode) => {
                  ontkoppel.reset();
                  koppel.mutate({ ficheId: fiche.id, leerplandoelCode });
                }}
                onOntkoppel={(koppelingId) => {
                  koppel.reset();
                  ontkoppel.mutate({ ficheId: fiche.id, koppelingId });
                }}
                onBewerk={() => {
                  wijzig.reset();
                  setFormulier({ fiche });
                }}
                onVerwijder={() => {
                  verwijder.reset();
                  setTeVerwijderen(fiche);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* A refused link or delete, with the server's reason. Under the list because the control that
          failed is still on screen and the reason names something about one of its rows. */}
      {doelFout ? (
        <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {doelFout instanceof ApiError && doelFout.detail ? doelFout.detail : t("algemeneFiches.koppelenMislukt")}
        </p>
      ) : null}
      {verwijder.isError ? (
        <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {verwijder.error instanceof ApiError && verwijder.error.detail
            ? verwijder.error.detail
            : t("algemeneFiches.verwijderMislukt")}
        </p>
      ) : null}

      {formulier ? (
        <Algemeneficheformulier
          open
          key={formulier.fiche?.id ?? "nieuw"}
          fiche={formulier.fiche}
          bezig={bezig}
          fout={fout}
          onSluit={() => setFormulier(null)}
          onBewaar={(invoer) => {
            if (formulier.fiche) {
              wijzig.mutate({ ficheId: formulier.fiche.id, invoer }, { onSuccess: () => setFormulier(null) });
            } else {
              maak.mutate(invoer, { onSuccess: () => setFormulier(null) });
            }
          }}
        />
      ) : null}

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("algemeneFiches.verwijderTitel", { naam: teVerwijderen?.naam ?? "" })}
        // Said only when there is something to lose: a fiche without goals takes nothing with it.
        gevolg={
          teVerwijderen && teVerwijderen.doelen.length > 0
            ? telWoord(teVerwijderen.doelen.length, "algemeneFiches.verwijderEenDoel", "algemeneFiches.verwijderDoelen")
            : undefined
        }
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setTeVerwijderen(null)}
        onBevestig={() => {
          if (!teVerwijderen) return;
          verwijder.mutate(teVerwijderen.id, { onSuccess: () => setTeVerwijderen(null) });
        }}
      />
    </div>
  );
}

/** One fiche: what it is, whether it is in the agenda, and the goals it works on. */
function Ficherij({
  fiche,
  magBewerken,
  fasen,
  doelBezig,
  onKoppel,
  onOntkoppel,
  onBewerk,
  onVerwijder,
}: {
  fiche: AlgemeneFicheWeergave;
  /** Without it the row shows the fiche and its goals, and none of the five controls. */
  magBewerken: boolean;
  /** The chosen class's jaar/fase, so the goal picker searches the goals this class is measured against. */
  fasen?: string[];
  doelBezig: boolean;
  onKoppel: (leerplandoelCode: string) => void;
  onOntkoppel: (koppelingId: string) => void;
  onBewerk: () => void;
  onVerwijder: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-inkt">{fiche.naam}</p>
          {fiche.omschrijving ? <p className="mt-0.5 text-meta text-inkt-zacht">{fiche.omschrijving}</p> : null}
          {fiche.aantalPlaatsingen > 0 ? (
            <p className="mt-2 text-meta text-inkt-zwak">
              {telWoord(fiche.aantalPlaatsingen, "algemeneFiches.eenPlaatsing", "algemeneFiches.aantalPlaatsingen")}
            </p>
          ) : fiche.doelen.length > 0 ? (
            // Guaranteed by the render condition: no placement means the fifth dekking layer skips this
            // fiche entirely, whatever its goals are.
            <p className="mt-2 text-meta text-inkt-zacht">{t("algemeneFiches.nietIngepland")}</p>
          ) : null}
        </div>

        {magBewerken ? (
          <div className="flex shrink-0 items-center gap-2">
            <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={onBewerk}>
              {t("themabeheer.bewerk")}
            </Knop>
            <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onVerwijder}>
              {t("themabeheer.verwijder")}
            </Knop>
          </div>
        ) : null}
      </div>

      {fiche.doelen.length > 0 ? (
        <ul aria-label={t("algemeneFiches.doelenVan", { naam: fiche.naam })} className="flex flex-col gap-1.5">
          {fiche.doelen.map((doel) => (
            <li key={doel.koppelingId} className="flex items-start gap-2 rounded-veld bg-vlak px-2.5 py-2">
              <Doelsoortmerk soort={doel.doelsoort} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="mono block text-micro font-medium text-inkt-zacht">{doel.leerplandoelCode}</span>
                <span className="line-clamp-2 text-meta text-inkt">{doel.tekst}</span>
              </span>
              {magBewerken ? (
                <button
                  type="button"
                  disabled={doelBezig}
                  onClick={() => onOntkoppel(doel.koppelingId)}
                  aria-label={t("algemeneFiches.ontkoppel", { code: doel.leerplandoelCode })}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
                >
                  <IcoonKruis aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {magBewerken ? (
        <Doelkoppelaar
          bezig={doelBezig}
          alGekozen={fiche.doelen.map((d) => d.leerplandoelCode)}
          fasen={fasen}
          toelichting={t("algemeneFiches.koppelVoor", { naam: fiche.naam })}
          onKies={onKoppel}
        />
      ) : null}
    </div>
  );
}
