import { useState } from "react";
import { Invoer } from "../../components/ui/Veld";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { IcoonPlus, IcoonZoek } from "../../components/Iconen";
import { useLeerplandoelen } from "../../lib/queries";
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
  const term = zoek.trim();

  // Only asked once there is something to ask about: an unfiltered first page is 20 goals nobody
  // was looking for, and it makes the field look like a list rather than a search.
  const { data, isPending } = useLeerplandoelen(
    { zoek: term, aantal: 8 },
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

      {term.length < 2 ? null : isPending ? (
        <p className="mt-2 text-meta text-inkt-zwak">{t("doelkiezer.zoeken")}</p>
      ) : gevonden.length === 0 ? (
        <p className="mt-2 text-meta text-inkt-zwak">{t("doelkiezer.niets")}</p>
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
