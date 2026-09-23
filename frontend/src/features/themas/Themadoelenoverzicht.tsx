import { useState } from "react";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonDoelen } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { useThemaDoelenoverzicht } from "../../lib/queries";
import type { DoelPlaats, LeeftijdDoelen, OverzichtLeerplandoel } from "../../lib/types";
import { Doellijst, Kaart, Vouwpijl } from "./Fiche";

/**
 * The leerplandoelen of a thema per leeftijd (FB-009, TB-048).
 *
 * **A preview of what the thema offers, never dekking.** Dekking belongs to a klas with a plan (Art. V.1), and this block
 * knows no klas, so no word here says "gedekt". The server computes it; nothing is stored.
 *
 * **The list is the concordance of the thema's minimumdoelen (TB-048)**: every leerplandoel of a minimumdoel the thema
 * aims at, at its own jaar/fase, whether or not anything links it yet. The margin and each leeftijd count only these.
 * Linking or unlinking a minimumdoel refreshes the thema's key, and this query with it.
 *
 * **A decided link outside that list stays visible, apart and uncounted**, with where it hangs, so unlinking a
 * minimumdoel never makes a subdoel or activiteit goal vanish from sight.
 *
 * **One row per leeftijd, shut by default**, the gesture and the default the subthema's have (FB-011). Opened, the list
 * uses the page's own list frame, and each row opens the doel's detail in the page's one sheet.
 *
 * **The total stands once, in the thema's summary under its title (FB-094)**, so a row repeats its own count only when
 * there are several leeftijden, where it says something the total does not.
 *
 * **Nothing at all while there is nothing to list**: an empty block would only announce its own emptiness.
 */
export function Themadoelenoverzicht({
  themaId,
  onToonDoel,
}: {
  themaId: string;
  onToonDoel: (code: string, knop: HTMLElement) => void;
}) {
  const { data, isPending, isError } = useThemaDoelenoverzicht(themaId);

  if (isPending) return <Laadvlak className="h-14" />;

  if (isError || !data) {
    return <p className="text-meta text-inkt-zacht">{t("thema.overzichtFout")}</p>;
  }

  if (data.leeftijden.length === 0) return null;

  const meerdere = data.leeftijden.length > 1;

  return (
    <Kaart>
      <ul className="divide-y divide-lijn">
        {data.leeftijden.map((groep) => (
          <li key={groep.leeftijd}>
            <Leeftijdrij groep={groep} metAantal={meerdere} onToonDoel={onToonDoel} />
          </li>
        ))}
      </ul>
    </Kaart>
  );
}

/** One leeftijd: its name and counts on the fold button, and its leerplandoelen once opened. */
function Leeftijdrij({
  groep,
  metAantal,
  onToonDoel,
}: {
  groep: LeeftijdDoelen;
  /** Several leeftijden: this row's own count says something the total under the title does not. */
  metAantal: boolean;
  onToonDoel: (code: string, knop: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const aantal = groep.leerplandoelen.length;
  const buiten = groep.buitenMinimumdoelen.length;
  const tellers: string[] = [];
  if (aantal === 0) tellers.push(t("thema.overzichtGeenLeerplandoelen"));
  else if (metAantal) tellers.push(telWoord(aantal, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen"));
  if (buiten > 0) tellers.push(telWoord(buiten, "thema.overzichtEenBuiten", "thema.overzichtBuiten"));

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-raak w-full items-start gap-2 px-3 py-3 text-left transition-colors duration-150 hover:bg-inkt/[0.035] sm:px-4"
      >
        <Vouwpijl open={open} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-display text-sectie text-inkt">
            <IcoonDoelen aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zacht" />
            {t("thema.leerplandoelenVoor", { leeftijd: groep.leeftijd })}
          </span>
          {tellers.length > 0 ? (
            <span className="mt-0.5 block text-meta text-inkt-zacht">{tellers.join(", ")}</span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 px-3 pb-3 sm:px-4">
          {aantal > 0 ? (
            <Doellijst>
              {groep.leerplandoelen.map((doel) => (
                <Leerplandoelregel key={doel.code} doel={doel} onToon={onToonDoel} />
              ))}
            </Doellijst>
          ) : null}
          {buiten > 0 ? (
            <div>
              <h3 className="mb-1.5 text-meta font-medium text-inkt-zacht">{t("thema.overzichtBuitenTitel")}</h3>
              <Doellijst>
                {groep.buitenMinimumdoelen.map((doel) => (
                  <Leerplandoelregel key={doel.code} doel={doel} onToon={onToonDoel} metPlaats />
                ))}
              </Doellijst>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A leerplandoel: what it says and, outside the list, where in the thema it hangs. The whole row opens its detail. */
function Leerplandoelregel({
  doel,
  onToon,
  metPlaats = false,
}: {
  doel: OverzichtLeerplandoel;
  onToon: (code: string, knop: HTMLElement) => void;
  metPlaats?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={(event) => onToon(doel.code, event.currentTarget)}
        className="block w-full px-3 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Doelsoortmerk soort={doel.doelsoort} />
          <span className="mono text-micro font-medium text-inkt-zacht">{doel.code}</span>
          {doel.nietMeerInOpstap ? (
            <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
        </span>
        <span className="mt-1 line-clamp-2 text-body text-inkt">{doel.tekst}</span>
        {metPlaats ? <span className="mt-1.5 block text-meta text-inkt-zacht">{waar(doel.plaatsen)}</span> : null}
      </button>
    </li>
  );
}

/**
 * Where a leerplandoel hangs, in the order a teacher reads the thema: the thema itself (a themadoel), then each subthema that makes it a
 * subdoel by name, then how many activiteiten carry it. Activiteiten are counted rather than named: a doel on eight of
 * them would otherwise push its own text off the row.
 */
function waar(plaatsen: DoelPlaats[]): string {
  const delen: string[] = [];
  if (plaatsen.some((p) => p.soort === "Themadoel")) delen.push(t("thema.plaatsThemadoel"));
  for (const plaats of plaatsen) {
    if (plaats.soort === "Subdoel") delen.push(t("thema.plaatsSubdoel", { naam: plaats.naam ?? "" }));
  }
  const activiteiten = plaatsen.filter((p) => p.soort === "Activiteit").length;
  if (activiteiten > 0) delen.push(telWoord(activiteiten, "thema.plaatsEenActiviteit", "thema.plaatsActiviteiten"));
  return t("thema.overzichtVia", { lijst: delen.join(", ") });
}
