import { useId, useState, type FormEvent } from "react";

import { t } from "../../i18n";
import { ApiError } from "../../lib/api";
import type { Subthema, SubthemaInvoer } from "./types";

/**
 * The create/edit form for a **class- and age-scoped** subthema (E1-14 landing 2, FR-3.1, Art. IX.2).
 *
 * **The counterpart of `Themaformulier`, and the difference between them is the level rule made visible.** A
 * thema carries no klas; a subthema cannot exist without one, so `klasId` is required here. It is **not** a
 * field: the klas comes from the shell's selection, which is the class whose section this form was opened in.
 * Offering a class picker here would let a teacher create, from L3's section, a subthema that then vanishes
 * from the screen they are looking at.
 *
 * `leeftijd` **is** a field, because it is not the same thing as the klas: Art. IX.2 scopes a subthema per
 * class *and* age, which is what makes a graadklas or menggroep expressible.
 */
export interface SubthemaformulierProps {
  /** The subthema being edited, or `undefined` when creating one. */
  subthema?: Subthema;
  /** The klas this subthema belongs to. Fixed by the section it is opened in, never chosen here. */
  klasId: string;
  /** The class's name, for the create heading, so the teacher sees whose subthema this becomes. */
  klasNaam: string;
  onBewaar: (invoer: SubthemaInvoer) => void;
  onAnnuleer: () => void;
  bezig: boolean;
  fout?: unknown;
}

export function Subthemaformulier({
  subthema,
  klasId,
  klasNaam,
  onBewaar,
  onAnnuleer,
  bezig,
  fout,
}: SubthemaformulierProps) {
  const [naam, setNaam] = useState(subthema?.naam ?? "");
  const [duur, setDuur] = useState(String(subthema?.duurWeken ?? 2));
  const [leeftijd, setLeeftijd] = useState(subthema?.leeftijd ?? "");
  const [probleemstelling, setProbleemstelling] = useState(subthema?.probleemstelling ?? "");
  const [onderzoeksvraag, setOnderzoeksvraag] = useState(subthema?.onderzoeksvraag ?? "");
  const [eigenFout, setEigenFout] = useState<string | null>(null);

  const weken = Number.parseInt(duur, 10);

  /*
    **Field ids are per instance, not per component** (antagonist round 2, MAJOR 1).

    Two of these forms can be open at once: the create form under the list plus an edit form on any card, or a
    card's activiteit form beside it. With literal ids, the second form's five `<label htmlFor>` attributes
    resolved to the FIRST form's inputs, so the second form's fields had no label at all and clicking "Naam"
    focused the wrong box. axe cannot fail on it either: it classes `duplicate-id-aria` and
    `form-field-multiple-labels` as *incomplete* rather than violations, and `toHaveNoViolations` only reads
    violations. `useId` makes each mount its own namespace.
  */
  const id = useId();
  const veld =
    "mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-ink placeholder:text-ink-zacht";

  function verstuur(event: FormEvent) {
    event.preventDefault();

    if (naam.trim().length === 0) {
      setEigenFout(t("themabeheer.naamVerplicht"));
      return;
    }

    if (!Number.isFinite(weken) || weken < 1) {
      setEigenFout(t("themabeheer.duurOngeldig"));
      return;
    }

    // The server refuses a blank leeftijd, so asking here saves a round trip to learn it. The klas is not
    // checked because it cannot be empty: it comes from the section, not from the teacher.
    if (leeftijd.trim().length === 0) {
      setEigenFout(t("themabeheer.leeftijdVerplicht"));
      return;
    }

    setEigenFout(null);
    onBewaar({
      naam: naam.trim(),
      duurWeken: weken,
      klasId,
      leeftijd: leeftijd.trim(),
      probleemstelling: probleemstelling.trim() === "" ? null : probleemstelling.trim(),
      onderzoeksvraag: onderzoeksvraag.trim() === "" ? null : onderzoeksvraag.trim(),
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
      <h4 className="text-sm font-bold text-ink">
        {subthema
          ? t("themabeheer.subthemaFormWijzig")
          : t("themabeheer.subthemaFormNieuw", { klas: klasNaam })}
      </h4>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem_6rem]">
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-naam`}>
            {t("themabeheer.naamLabel")}
          </label>
          <input
            id={`${id}-naam`}
            value={naam}
            onChange={(event) => setNaam(event.target.value)}
            placeholder={t("themabeheer.subthemaNaamPlaceholder")}
            className={veld}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-duur`}>
            {t("themabeheer.duurLabel")}
          </label>
          <input
            id={`${id}-duur`}
            type="number"
            min={1}
            value={duur}
            onChange={(event) => setDuur(event.target.value)}
            className={veld}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-leeftijd`}>
            {t("themabeheer.leeftijdLabel")}
          </label>
          <input
            id={`${id}-leeftijd`}
            value={leeftijd}
            onChange={(event) => setLeeftijd(event.target.value)}
            placeholder={t("themabeheer.leeftijdPlaceholder")}
            className={veld}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-probleemstelling`}>
            {t("themabeheer.probleemstellingLabel")}
          </label>
          <input
            id={`${id}-probleemstelling`}
            value={probleemstelling}
            onChange={(event) => setProbleemstelling(event.target.value)}
            placeholder={t("themabeheer.probleemstellingPlaceholder")}
            className={veld}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink" htmlFor={`${id}-onderzoeksvraag`}>
            {t("themabeheer.onderzoeksvraagLabel")}
          </label>
          <input
            id={`${id}-onderzoeksvraag`}
            value={onderzoeksvraag}
            onChange={(event) => setOnderzoeksvraag(event.target.value)}
            placeholder={t("themabeheer.onderzoeksvraagPlaceholder")}
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
          <p>{t("themabeheer.subthemaBewaarMislukt")}</p>
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
