import { useState } from "react";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonChevron, IcoonDoelen } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useThemaDoelenoverzicht } from "../../lib/queries";
import type { DoelPlaats, LeeftijdDoelen, OverzichtLeerplandoel, OverzichtMinimumdoel } from "../../lib/types";
import { Blok, Doellijst, Kop, Subkop } from "./Fiche";

/**
 * What a thema reaches per leeftijd (FB-009): the leerplandoelen linked anywhere under it, and the minimumdoelen those
 * lead to through the concordance.
 *
 * **A preview of what the thema offers, never dekking.** Dekking belongs to a klas with a plan (Art. V.1), and this block
 * knows no klas, so no word here says "gedekt". The server computes it from the decided links only; nothing is stored.
 *
 * **The margin carries the minimumdoelen**, because they are what the owner asked this block for: the level the
 * inspectie tests. The leerplandoelen are the route there and get the rows.
 *
 * **One row per leeftijd, shut by default**, the gesture and the default the subthema chapters have (FB-011), with a
 * summary a teacher can scan without opening it. Opened, the two lists use the page's own list frame, and each row opens
 * the doel's detail in the page's one sheet.
 *
 * **Nothing at all while nothing is decided.** The thema's facts already say "Nog geen doelen gekoppeld"; a second empty
 * block would say it twice.
 */
export function Themadoelenoverzicht({
  themaId,
  onToonDoel,
  onToonMinimumdoel,
}: {
  themaId: string;
  onToonDoel: (code: string, knop: HTMLElement) => void;
  onToonMinimumdoel: (ref: string, knop: HTMLElement) => void;
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

  const minimumdoelen = new Set(data.leeftijden.flatMap((l) => l.minimumdoelen.map((m) => m.ref))).size;

  return (
    <Blok
      figuur={minimumdoelen}
      onder={t(minimumdoelen === 1 ? "thema.overzichtMinimumdoelWoordEen" : "thema.overzichtMinimumdoelWoordMeer")}
    >
      <Kop titel={t("thema.overzichtTitel")} icoon={<Icoon />}>
        <ul className="divide-y divide-lijn overflow-hidden rounded-veld border border-lijn">
          {data.leeftijden.map((groep) => (
            <li key={groep.leeftijd}>
              <Leeftijdrij groep={groep} onToonDoel={onToonDoel} onToonMinimumdoel={onToonMinimumdoel} />
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

/** One leeftijd: its summary on the fold button, and the two lists once opened. */
function Leeftijdrij({
  groep,
  onToonDoel,
  onToonMinimumdoel,
}: {
  groep: LeeftijdDoelen;
  onToonDoel: (code: string, knop: HTMLElement) => void;
  onToonMinimumdoel: (ref: string, knop: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
      >
        <span className="w-9 shrink-0 font-display text-sectie text-inkt">{groep.leeftijd}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-y-0.5 text-meta text-inkt-zacht sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
          <span>{telWoord(groep.leerplandoelen.length, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen")}</span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span>{telWoord(groep.minimumdoelen.length, "thema.overzichtEenMinimumdoel", "thema.overzichtMinimumdoelen")}</span>
        </span>
        <IcoonChevron
          aria-hidden="true"
          className={cn(
            "h-5 w-5 shrink-0 text-inkt-zwak transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="px-3 pb-3">
          <Subkop titel={t("thema.overzichtLeerplandoelenTitel")}>
            <Doellijst>
              {groep.leerplandoelen.map((doel) => (
                <Leerplandoelregel key={doel.code} doel={doel} onToon={onToonDoel} />
              ))}
            </Doellijst>
          </Subkop>

          <Subkop titel={t("thema.overzichtMinimumdoelenTitel")}>
            {groep.minimumdoelen.length === 0 ? (
              <p className="text-meta text-inkt-zacht">{t("thema.overzichtGeenMinimumdoel")}</p>
            ) : (
              <Doellijst>
                {groep.minimumdoelen.map((minimumdoel) => (
                  <Minimumdoelregel key={minimumdoel.ref} minimumdoel={minimumdoel} onToon={onToonMinimumdoel} />
                ))}
              </Doellijst>
            )}
          </Subkop>
        </div>
      ) : null}
    </div>
  );
}

/** A leerplandoel: what it says, and where in the thema it hangs. The whole row opens its detail. */
function Leerplandoelregel({
  doel,
  onToon,
}: {
  doel: OverzichtLeerplandoel;
  onToon: (code: string, knop: HTMLElement) => void;
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
        <span className="mt-1.5 block text-meta text-inkt-zacht">{waar(doel.plaatsen)}</span>
      </button>
    </li>
  );
}

/**
 * A minimumdoel: its ref in the minimumdoel hue (it IS the MD doelsoort, Art. XII), the decreed text, and the codes of
 * this leeftijd that lead to it. The whole row opens its detail.
 */
function Minimumdoelregel({
  minimumdoel,
  onToon,
}: {
  minimumdoel: OverzichtMinimumdoel;
  onToon: (ref: string, knop: HTMLElement) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={(event) => onToon(minimumdoel.ref, event.currentTarget)}
        className="block w-full px-3 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
      >
        <span className="mono inline-block rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-doelsoort-md-op">
          {minimumdoel.ref}
        </span>
        <span className="mt-1 line-clamp-2 whitespace-pre-line text-body text-inkt">{minimumdoel.omschrijving}</span>
        <span className="mono mt-1.5 block text-meta text-inkt-zacht">
          {t("thema.overzichtVia", { lijst: minimumdoel.leerplandoelen.join(", ") })}
        </span>
      </button>
    </li>
  );
}

/**
 * Where a leerplandoel hangs, in the order a teacher reads the thema: the thema itself, then each subthema that makes it
 * a subdoel by name, then how many activiteiten carry it. Activiteiten are counted rather than named: a doel on eight of
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
