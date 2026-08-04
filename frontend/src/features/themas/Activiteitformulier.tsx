import { useId, useState, type FormEvent } from "react";

import { t } from "../../i18n";
import { ApiError } from "../../lib/api";
import { ACTIVITEIT_TYPES, type Activiteit, type ActiviteitInvoer, type ActiviteitType } from "./types";

/**
 * The create/edit form for an activiteit (E1-14 landing 2, FR-3.1, Art. IX.2).
 *
 * **It carries no scope fields at all**, and that is the third variation of the level rule on this screen: an
 * activiteit inherits the klas and leeftijd of the subthema it is created in. So there is no klas field, no
 * leeftijd field, and the create call posts to the subthema.
 *
 * The type is a native `<select>` over the enum's own order (`ACTIVITEIT_TYPES`), so the option list cannot
 * drift from the domain and nobody has to invent an ordering. Its labels come from `activiteitType.*`, keyed
 * by template, which is why that family is exempt from the `themabeheer.*` dead-key guard and pinned by the
 * compiler instead.
 */
export interface ActiviteitformulierProps {
  /** The activiteit being edited, or `undefined` when creating one. */
  activiteit?: Activiteit;
  /** The subthema it belongs to, for the create heading. */
  subthemaNaam: string;
  onBewaar: (invoer: ActiviteitInvoer) => void;
  onAnnuleer: () => void;
  bezig: boolean;
  fout?: unknown;
}

export function Activiteitformulier({
  activiteit,
  subthemaNaam,
  onBewaar,
  onAnnuleer,
  bezig,
  fout,
}: ActiviteitformulierProps) {
  const [naam, setNaam] = useState(activiteit?.naam ?? "");
  const [soort, setSoort] = useState<ActiviteitType>(activiteit?.activiteitType ?? "Experiment");
  const [hoek, setHoek] = useState(activiteit?.hoek ?? "");
  const [uitkomsten, setUitkomsten] = useState(activiteit?.verwachteUitkomsten ?? "");
  const [eigenFout, setEigenFout] = useState<string | null>(null);

  // Per instance, for the reason spelled out in `Subthemaformulier`: two of these can be open at once.
  const id = useId();
  const veld =
    "mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-ink placeholder:text-ink-zacht";

  function verstuur(event: FormEvent) {
    event.preventDefault();

    if (naam.trim().length === 0) {
      setEigenFout(t("themabeheer.naamVerplicht"));
      return;
    }

    setEigenFout(null);
    onBewaar({
      naam: naam.trim(),
      activiteitType: soort,
      // The hoek is only meaningful for corner work, but it is not *forbidden* elsewhere and the server does
      // not couple the two, so this form does not invent a rule the domain does not have.
      hoek: hoek.trim() === "" ? null : hoek.trim(),
      verwachteUitkomsten: uitkomsten.trim() === "" ? null : uitkomsten.trim(),
    });
  }

  /**
   * The server's own sentence, when it sent one.
   *
   * **No status is special-cased here, and that is a reverted decision** (antagonist round 4). Round 3 excluded
   * a 404 and rendered a catalogue sentence instead, to remove a duplicated string. That caused two defects:
   * on a **create** path the missing record is the *parent*, so "dit subthema bestaat niet meer" is simply
   * false about a subthema being typed; and the third form was never given the same guard, so once the server
   * messages were translated for it, a teacher read English. The server's 404 sentence is Dutch again and is
   * shown framed, like every other reason, which is the state three audit rounds had already validated.
   */
  const serverMelding = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <form onSubmit={verstuur} className="rounded-md border border-petrol/40 bg-card p-3.5">
      <h5 className="text-sm font-bold text-ink">
        {activiteit
          ? t("themabeheer.activiteitFormWijzig")
          : t("themabeheer.activiteitFormNieuw", { subthema: subthemaNaam })}
      </h5>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-naam`}>
            {t("themabeheer.naamLabel")}
          </label>
          <input
            id={`${id}-naam`}
            value={naam}
            onChange={(event) => setNaam(event.target.value)}
            placeholder={t("themabeheer.activiteitNaamPlaceholder")}
            className={veld}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-soort`}>
            {t("themabeheer.activiteitTypeLabel")}
          </label>
          <select
            id={`${id}-soort`}
            value={soort}
            onChange={(event) => setSoort(event.target.value as ActiviteitType)}
            className={veld}
          >
            {ACTIVITEIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`activiteitType.${type.toLowerCase() as Lowercase<ActiviteitType>}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-hoek`}>
            {t("themabeheer.hoekLabel")}
          </label>
          <input
            id={`${id}-hoek`}
            value={hoek}
            onChange={(event) => setHoek(event.target.value)}
            placeholder={t("themabeheer.hoekPlaceholder")}
            className={veld}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-uitkomsten`}>
            {t("themabeheer.verwachteUitkomstenLabel")}
          </label>
          <input
            id={`${id}-uitkomsten`}
            value={uitkomsten}
            onChange={(event) => setUitkomsten(event.target.value)}
            placeholder={t("themabeheer.verwachteUitkomstenPlaceholder")}
            className={veld}
          />
        </div>
      </div>

      {eigenFout ? (
        <p role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
          {eigenFout}
        </p>
      ) : null}

      {fout ? (
        <div role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
          <p>{t("themabeheer.activiteitBewaarMislukt")}</p>
          {serverMelding ? (
            <p className="mt-1 font-normal text-ink-zacht">
              {t("themabeheer.serverReden", { melding: serverMelding })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={bezig}
          className="rounded-md bg-petrol px-3 py-1.5 text-sm font-semibold text-petrol-foreground hover:bg-petrol-helder disabled:opacity-60"
        >
          {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
        </button>
        <button
          type="button"
          onClick={onAnnuleer}
          className="rounded-md border border-input px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-diep"
        >
          {t("themabeheer.annuleer")}
        </button>
      </div>
    </form>
  );
}
