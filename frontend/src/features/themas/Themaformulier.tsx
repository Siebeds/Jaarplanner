import { useState, type FormEvent } from "react";

import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { Thema, ThemaInvoer } from "./types";

/**
 * The create/edit form for a **school-wide** thema (E1-14, FR-3.1, Art. IX.2).
 *
 * **It carries no klas and no leeftijd, and that is the point.** A thema belongs to the school, so a scope
 * field here would offer a choice the server rejects. The class-scoped levels have their own form; keeping
 * them apart means the level rule is visible in the shape of the screen rather than only in a validation
 * message.
 *
 * **Two woordenschat lists, one line each.** They are `string[]` on the wire, and a comma-separated field
 * would make "wind, regen" one term the moment a teacher types naturally. One per line is unambiguous in
 * both directions and needs no escaping rule anybody has to remember.
 */
export interface ThemaformulierProps {
  /** The thema being edited, or `undefined` when creating one. */
  thema?: Thema;
  /** Called with a valid payload. The caller owns the mutation and its invalidation. */
  onBewaar: (invoer: ThemaInvoer) => void;
  onAnnuleer: () => void;
  bezig: boolean;
  /** The failure of the caller's mutation, so the form can explain it where the fields are. */
  fout?: unknown;
}

/** A textarea's lines as a list, dropping blanks so a trailing newline is not a woordenschat entry. */
function regelsNaarLijst(waarde: string): string[] {
  return waarde
    .split("\n")
    .map((regel) => regel.trim())
    .filter((regel) => regel.length > 0);
}

export function Themaformulier({ thema, onBewaar, onAnnuleer, bezig, fout }: ThemaformulierProps) {
  const [naam, setNaam] = useState(thema?.naam ?? "");
  // A string, not a number: an `<input type="number">` yields "" while being cleared, and a numeric state
  // would turn that into 0 or NaN under the teacher's cursor.
  const [duur, setDuur] = useState(String(thema?.duurWeken ?? 4));
  const [invalshoeken, setInvalshoeken] = useState(thema?.invalshoeken ?? "");
  const [kernwoordenschat, setKernwoordenschat] = useState((thema?.kernwoordenschat ?? []).join("\n"));
  const [rijkeWoordenschat, setRijkeWoordenschat] = useState((thema?.rijkeWoordenschat ?? []).join("\n"));
  const [eigenFout, setEigenFout] = useState<string | null>(null);

  const weken = Number.parseInt(duur, 10);

  function verstuur(event: FormEvent) {
    event.preventDefault();

    // Checked here as well as server-side, because a round trip to learn that a required field is empty is a
    // worse experience than a sentence under the field. The server stays the authority.
    if (naam.trim().length === 0) {
      setEigenFout(t("themabeheer.naamVerplicht"));
      return;
    }

    if (!Number.isFinite(weken) || weken < 1) {
      setEigenFout(t("themabeheer.duurOngeldig"));
      return;
    }

    setEigenFout(null);
    onBewaar({
      naam: naam.trim(),
      duurWeken: weken,
      invalshoeken: invalshoeken.trim() === "" ? null : invalshoeken.trim(),
      kernwoordenschat: regelsNaarLijst(kernwoordenschat),
      rijkeWoordenschat: regelsNaarLijst(rijkeWoordenschat),
    });
  }

  /**
   * The server's own sentence, when it sent one a teacher can act on.
   *
   * Permitted by the Art. II.3 amendment of 2026-07-30 and framed rather than echoed: `nl.json` says what kind
   * of thing failed, and the server's `detail` says which field or value it was, which no static catalogue can
   * know. A 500 or a dropped connection carries no `detail`, so the framing sentence has to stand alone.
   */
  const serverMelding = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <form onSubmit={verstuur} className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
      <h3 className="text-lg font-bold text-ink">
        {thema ? t("themabeheer.formTitelWijzig") : t("themabeheer.formTitelNieuw")}
      </h3>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="thema-naam">
            {t("themabeheer.naamLabel")}
          </label>
          <input
            id="thema-naam"
            value={naam}
            onChange={(event) => setNaam(event.target.value)}
            placeholder={t("themabeheer.naamPlaceholder")}
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-ink placeholder:text-ink-zacht"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="thema-duur">
            {t("themabeheer.duurLabel")}
          </label>
          <input
            id="thema-duur"
            type="number"
            min={1}
            value={duur}
            onChange={(event) => setDuur(event.target.value)}
            className="mt-1.5 h-11 w-24 rounded-md border border-input bg-card px-3.5 text-sm text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="thema-invalshoeken">
            {t("themabeheer.invalshoekenLabel")}
          </label>
          <input
            id="thema-invalshoeken"
            value={invalshoeken}
            onChange={(event) => setInvalshoeken(event.target.value)}
            placeholder={t("themabeheer.invalshoekenPlaceholder")}
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-ink placeholder:text-ink-zacht"
          />
        </div>

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="thema-kernwoordenschat">
              {t("themabeheer.kernwoordenschatLabel")}
            </label>
            <textarea
              id="thema-kernwoordenschat"
              rows={4}
              value={kernwoordenschat}
              onChange={(event) => setKernwoordenschat(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-card px-3.5 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="thema-rijkewoordenschat">
              {t("themabeheer.rijkeWoordenschatLabel")}
            </label>
            <textarea
              id="thema-rijkewoordenschat"
              rows={4}
              value={rijkeWoordenschat}
              onChange={(event) => setRijkeWoordenschat(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-card px-3.5 py-2 text-sm text-ink"
            />
          </div>
          {/* Once, under both fields, rather than repeated per field. */}
          <p className="text-xs text-ink-zacht sm:col-span-2">{t("themabeheer.woordenschatHint")}</p>
        </fieldset>

        {eigenFout ? (
          <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
            {eigenFout}
          </p>
        ) : null}

        {fout ? (
          <div role="alert" className="text-sm font-medium text-suggestie-geweigerd">
            <p>{t("themabeheer.bewaarMislukt")}</p>
            {serverMelding ? (
              <p className="mt-1 font-normal text-ink-zacht">
                {t("themabeheer.serverReden", { melding: serverMelding })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={bezig}
            className="rounded-md bg-petrol px-4 py-2 text-sm font-semibold text-petrol-foreground hover:bg-petrol-helder disabled:opacity-60"
          >
            {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
          </button>
          <button
            type="button"
            onClick={onAnnuleer}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold text-ink hover:bg-paper-diep"
          >
            {t("themabeheer.annuleer")}
          </button>
        </div>
      </div>
    </form>
  );
}
