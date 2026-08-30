import { useState } from "react";
import { Invoer } from "../../components/ui/Veld";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { IcoonPlus, IcoonZoek } from "../../components/Iconen";
import { useLeerplandoelen } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { t } from "../../i18n";

/**
 * Finding one leerplandoel and handing back its code.
 *
 * **The code is the whole answer.** A leerplandoel is read-only reference data (Art. III.5), so the
 * only thing a client may send when linking one is its code. That is why this picker returns a string
 * and not an object: there is nothing else about the goal a caller is allowed to carry.
 *
 * **Search, not a tree.** The Doelen register already has the facet tree for browsing; a teacher who
 * is linking a goal to an activiteit almost always knows roughly what they want and would have to
 * walk four levels to reach it. So this is one field, matching on code and on text, and it shows the
 * goal's own sentence because a code alone is not something anyone recognises.
 *
 * A link made here lands as `Manueel`. Nothing in this component can produce a `Voorgesteld` row:
 * that status means the model proposed it, and this is a teacher deciding.
 */
export function Doelkiezer({
  onKies,
  bezig,
  alGekozen,
}: {
  onKies: (leerplandoelCode: string) => void;
  bezig?: boolean;
  /** Codes already linked here, so the list does not offer the same goal twice. */
  alGekozen: string[];
}) {
  const [zoek, setZoek] = useState("");
  const [alleJaren, setAlleJaren] = useState(false);
  const term = zoek.trim();

  /**
   * SCOPED TO THE CLASS THAT IS SELECTED (owner ruling, 2026-08-25).
   *
   * Without this the picker offered every leerplandoel the school has loaded, and a teacher of a kleuterklas linked
   * three `Fase 1` precurriculumdoelen in good faith. Those are real links and the server counts them, but they sit
   * outside the jaar/fase the class is measured against, so the dekkingscijfer stayed on zero with no way to see why.
   * A picker that hands out goals which cannot count for this class is the cause, not the coverage figure.
   *
   * `jaarFasen` comes from the class itself rather than being derived here: the rule lives in
   * `Jaarfasen.VoorKlas` and a second copy in TypeScript would be a second answer to "what does this class teach?".
   */
  const { klas } = useActieveSelectie();
  const fasen = klas?.jaarFasen ?? [];
  const scoped = !alleJaren && fasen.length > 0;

  // Only asked once there is something to ask about: an unfiltered first page is 20 goals nobody
  // was looking for, and it makes the field look like a list rather than a search.
  const { data, isPending } = useLeerplandoelen(
    { zoek: term, aantal: 8, jaarFase: scoped ? fasen : undefined },
    { enabled: term.length >= 2 },
  );

  const gevonden = (data?.regels ?? []).filter((regel) => !alGekozen.includes(regel.code));

  return (
    <div>
      <div className="relative">
        <IcoonZoek
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-inkt-zwak"
        />
        <Invoer
          value={zoek}
          disabled={bezig}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={t("doelkiezer.zoek")}
          className="pl-10"
        />
      </div>

      {/* WHAT THE LIST IS NARROWED TO, and the way out of it, said before the results rather than after.
          A silent filter is worse than none: a teacher searching for a doel they know exists would
          conclude the school never imported it. Only shown when the class has a jaar/fase to narrow by,
          because a graadklas that has none is not being narrowed and has nothing to widen. */}
      {fasen.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-inkt-zacht">
          <span>{scoped ? t("doelkiezer.beperktTot", { fasen: fasen.join(", ") }) : t("doelkiezer.alleJaren")}</span>
          <button
            type="button"
            disabled={bezig}
            onClick={() => setAlleJaren(!alleJaren)}
            className="font-medium text-accent underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-accent-diep"
          >
            {scoped ? t("doelkiezer.toonAlle") : t("doelkiezer.beperkWeer", { fasen: fasen.join(", ") })}
          </button>
        </p>
      ) : null}

      {term.length < 2 ? null : isPending ? (
        <p className="mt-2 text-meta text-inkt-zwak">{t("doelkiezer.zoeken")}</p>
      ) : gevonden.length === 0 ? (
        // Naming the scope in the empty state, because "geen doel gevonden" while a filter is on is the
        // sentence that sends a teacher looking for an import problem that does not exist.
        <p className="mt-2 text-meta text-inkt-zwak">
          {scoped ? t("doelkiezer.nietsInBereik", { fasen: fasen.join(", ") }) : t("doelkiezer.niets")}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {gevonden.map((regel) => (
            <li key={regel.code}>
              <button
                type="button"
                disabled={bezig}
                onClick={() => {
                  onKies(regel.code);
                  setZoek("");
                }}
                className="flex w-full items-start gap-2 rounded-veld border border-lijn bg-kaart px-3 py-2 text-left transition-colors duration-150 hover:border-accent"
              >
                <IcoonPlus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-inkt-zwak" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Doelsoortmerk soort={regel.doelsoort} />
                    <span className="mono text-micro font-medium text-inkt">{regel.code}</span>
                    <span className="mono text-micro text-inkt-zwak">{regel.jaarFase}</span>
                    {/* Only reachable with the scope widened, and then it is the one thing worth saying about
                        the row: linking it is allowed and it will not move this class's dekkingscijfer. A word
                        rather than a tint, because the row already carries a doelsoort colour (Art. XII). */}
                    {fasen.length > 0 && !fasen.includes(regel.jaarFase) ? (
                      <span className="rounded bg-attentie-zacht px-1.5 py-0.5 text-[0.625rem] font-medium text-attentie-inkt">
                        {t("doelkiezer.buitenBereik", { fasen: fasen.join(", ") })}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-meta text-inkt-zacht">{regel.tekst}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
