import { useState } from "react";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonChevron, IcoonDoelen } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useThemaDoelenoverzicht } from "../../lib/queries";
import type { DoelPlaats, LeeftijdDoelen, OverzichtLeerplandoel } from "../../lib/types";
import { Blok, Doellijst, Kop } from "./Fiche";

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
 * **One row per leeftijd, shut by default**, the gesture and the default the subthema chapters have (FB-011), with a
 * count a teacher can scan without opening it. Opened, the list uses the page's own list frame, and each row opens the
 * doel's detail in the page's one sheet.
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

  if (isPending) {
    return (
      <Blok>
        <Kop titel={t("thema.overzichtTitel")} icoon={<Icoon />}>
          <Laadvlak className="h-12" />
        </Kop>
      </Blok>
    );
  }

  if (isError || !data) {
    return (
      <Blok>
        <Kop titel={t("thema.overzichtTitel")} icoon={<Icoon />}>
          <p className="text-meta text-inkt-zacht">{t("thema.overzichtFout")}</p>
        </Kop>
      </Blok>
    );
  }

  if (data.leeftijden.length === 0) return null;

  // The margin counts the list only; a code sits at its own jaar/fase there, so it is counted once.
  const leerplandoelen = new Set(data.leeftijden.flatMap((l) => l.leerplandoelen.map((d) => d.code))).size;

  return (
    <Blok
      figuur={leerplandoelen}
      onder={t(leerplandoelen === 1 ? "thema.overzichtLeerplandoelWoordEen" : "thema.overzichtLeerplandoelWoordMeer")}
    >
      <Kop titel={t("thema.overzichtTitel")} icoon={<Icoon />}>
        <ul className="divide-y divide-lijn overflow-hidden rounded-veld border border-lijn">
          {data.leeftijden.map((groep) => (
            <li key={groep.leeftijd}>
              <Leeftijdrij groep={groep} onToonDoel={onToonDoel} />
            </li>
          ))}
        </ul>
      </Kop>
    </Blok>
  );
}

function Icoon() {
  return <IcoonDoelen aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zacht" />;
}

/** One leeftijd: its counts on the fold button, and its leerplandoelen once opened. */
function Leeftijdrij({
  groep,
  onToonDoel,
}: {
  groep: LeeftijdDoelen;
  onToonDoel: (code: string, knop: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const aantal = groep.leerplandoelen.length;
  const buiten = groep.buitenMinimumdoelen.length;
  const tellers = [
    aantal === 0
      ? t("thema.overzichtGeenLeerplandoelen")
      : telWoord(aantal, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen"),
  ];
  if (buiten > 0) tellers.push(telWoord(buiten, "thema.overzichtEenBuiten", "thema.overzichtBuiten"));

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
      >
        <span className="w-9 shrink-0 font-display text-sectie text-inkt">{groep.leeftijd}</span>
        <span className="min-w-0 flex-1 text-meta text-inkt-zacht">{tellers.join(" · ")}</span>
        <IcoonChevron
          aria-hidden="true"
          className={cn(
            "h-5 w-5 shrink-0 text-inkt-zwak transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-3 px-3 pb-3">
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
