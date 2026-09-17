import { useId, useMemo, type Ref } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { useSubthemaBestemmingen, useThemaVoorKlas } from "../../lib/queries";
import { geenToegangZin, isEigenVan, useRechten } from "../../lib/rechten";
import { useIk } from "../../lib/aanmelding";
import { Knop } from "../../components/ui/Knop";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import type { ActiviteitWeergave, SubthemaBestemming, SubthemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { Activiteitformulier } from "../activiteiten/Activiteitformulier";
import { useGebruikActiviteit, useMaakActiviteit } from "../themas/mutaties";
import { Eigenaarmerk } from "../activiteiten/Eigenaarmerk";
import { Toevoegtegel } from "../hoeken/Toevoegtegel";
import { STANDAARDDUUR } from "./tijd";
import { ACTIVITEIT_VOORVOEGSEL, type Activiteitkaartdata } from "./activiteitkaart";
import { Doelinfo, type Infodoel } from "./Doelinfo";

/** An activiteit chosen from the panel: what the agenda needs to plan it. */
export interface GekozenActiviteit {
  id: string;
  naam: string;
  /** Its default length, in minutes. */
  duur: number;
}

/** The subthema a new activiteit from the panel is made in, with what its form needs of it. */
export interface Activiteitbestemming {
  subthemaId: string;
  themaId: string;
  leeftijd: string;
  onderzoeksvragen: SubthemaWeergave["onderzoeksvragen"];
  subdoelen: SubthemaWeergave["subdoelen"];
}

/** The week the agenda stands in, as the activiteiten list needs it. */
export interface Activiteitenweek {
  /** Its Monday: what a choice of subthema is kept for. */
  maandag: string;
  /** Its ISO number, which the list names instead of saying "deze week" (see below). */
  nummer: number;
  /**
   * The subthema's running in it, in the order they start; or that the agenda is still reading them, or could not.
   * Kept apart from an empty list, because "no subthema runs" is a claim only a read that succeeded can make
   * (antagonist FB-017, finding 1).
   */
  lopend: readonly string[] | "laadt" | "mislukt";
}

/**
 * The activiteiten list of the agenda's side panel, the third beside the hoekenfiches and the algemene fiches (owner,
 * 2026-09-15, FB-017).
 *
 * **It opens on the subthema running in the week the agenda stands in.** That is what a teacher planning her week
 * reaches for, and the agenda already knows it (`subthemasInWeek`). One list lets her choose another, holding only
 * the subthema's of the leeftijd(en) this klas teaches, grouped by thema. The choice is kept in the panel's store for
 * that klas and that week only (`Subthemakeuze`).
 *
 * **One list and not a thema list beside a subthema list.** A subthema is always a subthema of one thema, so the group
 * says the thema, and a column of 240px has no room for a second control that only narrows the first.
 *
 * **The week is named by its number, not as "deze week".** In the month view the week the list follows is the one of
 * the anchored day, which the month does not single out, and a Dutch reader hears "deze week" as the calendar's own
 * current week (antagonist FB-017, finding 2).
 *
 * **Whoever may only read the klas sees the cards and nothing to plan with** (owner, 2026-09-15): no drag, no click,
 * no create tile. A card then is not a control at all, so it is drawn as a plain block rather than as a disabled
 * button.
 *
 * A card shows the activiteit's name and whether it has doelen (`Doelmerk`), the one fact about an activiteit a
 * teacher scans a list for: one without doelen cannot count for the dekking wherever it is planned.
 */
export function Activiteitensectie({
  klasId,
  week,
  magPlannen,
  sleepbaar,
  tegelRef,
  onKies,
  onNieuw,
}: {
  klasId: string;
  week: Activiteitenweek;
  /** Whether this gebruiker may plan the klas: the cards plan only then, and only then is there a create tile. */
  magPlannen: boolean;
  sleepbaar: boolean;
  /** The create tile, so focus can return to it when the form closes. */
  tegelRef: Ref<HTMLButtonElement>;
  onKies: (activiteit: GekozenActiviteit) => void;
  onNieuw: (bestemming: Activiteitbestemming) => void;
}) {
  const id = useId();
  const bestemmingen = useSubthemaBestemmingen(klasId);
  const keuze = useHoekenpaneel((s) => s.subthemaKeuze);
  const kiesSubthema = useHoekenpaneel((s) => s.kiesSubthema);

  const lijst = useMemo(() => bestemmingen.data ?? [], [bestemmingen.data]);
  // Null while it is not known which subthema's run this week.
  const lopend =
    typeof week.lopend === "string"
      ? null
      : week.lopend.filter((subthemaId) => lijst.some((b) => b.id === subthemaId));
  const gekozen = keuze && keuze.klasId === klasId && keuze.week === week.maandag ? keuze.subthemaId : null;
  const actief = lijst.find((b) => b.id === gekozen) ?? (lopend ? lijst.find((b) => b.id === lopend[0]) : undefined);

  // In the order the server lists them, one group per thema.
  const groepen = useMemo(() => {
    const perThema = new Map<string, { themaNaam: string; subthemas: SubthemaBestemming[] }>();
    for (const bestemming of lijst) {
      const groep = perThema.get(bestemming.themaId);
      if (groep) groep.subthemas.push(bestemming);
      else perThema.set(bestemming.themaId, { themaNaam: bestemming.themaNaam, subthemas: [bestemming] });
    }
    return [...perThema.entries()];
  }, [lijst]);
  // A klas teaching one age needs no age on every option; a graadklas does, or two "de speelhoek" look the same.
  const meerdereLeeftijden = new Set(lijst.map((b) => b.leeftijd)).size > 1;

  if (bestemmingen.isPending) return <Laadlijst rijen={3} />;

  if (bestemmingen.isError && bestemmingen.data === undefined) {
    return (
      <p role="alert" className="text-meta text-attentie-inkt">
        {t("hoekenpaneel.mislukt")}
      </p>
    );
  }

  if (lijst.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-inkt-zacht">{t("activiteitenpaneel.geenSubthemas")}</p>
        <Link to="/themas" className="text-meta font-medium text-accent underline-offset-2 hover:underline">
          {t("activiteitenpaneel.naarThemas")}
        </Link>
      </div>
    );
  }

  // Still reading which subthema runs, and nothing chosen: the list waits rather than opening on "Kies een subthema"
  // and jumping to the running one a moment later, under her eyes.
  if (week.lopend === "laadt" && !actief) return <Laadlijst rijen={3} />;

  return (
    <div className="flex flex-col gap-3">
      <div>
        {/* The fact first when nothing runs, so the list below reads as the way on. Only after a read that succeeded,
            and only when nothing at all runs: a run of a subthema this list cannot offer (one given another leeftijd
            after it was planned) is still a run, and then the list says nothing about the week. */}
        {typeof week.lopend !== "string" && week.lopend.length === 0 ? (
          <p className="mb-2 text-meta text-inkt-zacht">
            {t("activiteitenpaneel.geenLopendInWeek", { nummer: week.nummer })}
          </p>
        ) : null}

        <label htmlFor={`${id}-subthema`} className="text-meta font-medium text-inkt">
          {t("activiteitenpaneel.subthema")}
        </label>
        <Keuze
          id={`${id}-subthema`}
          value={actief?.id ?? ""}
          onChange={(e) =>
            kiesSubthema(e.target.value === "" ? null : { subthemaId: e.target.value, klasId, week: week.maandag })
          }
          className="mt-1.5"
        >
          {actief ? null : (
            <option value="" disabled>
              {t("activiteitenpaneel.kiesSubthema")}
            </option>
          )}
          {groepen.map(([themaId, groep]) => (
            <optgroup key={themaId} label={groep.themaNaam}>
              {groep.subthemas.map((b) => (
                <option key={b.id} value={b.id}>
                  {meerdereLeeftijden ? t("activiteitenpaneel.subthemaLeeftijd", { naam: b.naam, leeftijd: b.leeftijd }) : b.naam}
                </option>
              ))}
            </optgroup>
          ))}
        </Keuze>

        {/* Only when it is true: the chosen subthema is one of the runs touching that week. */}
        {actief && lopend?.includes(actief.id) ? (
          <p className="mt-1.5 text-micro text-inkt-zacht">
            {t("activiteitenpaneel.looptInWeek", { nummer: week.nummer })}
          </p>
        ) : null}
      </div>

      {actief ? (
        <Activiteitenlijst
          klasId={klasId}
          bestemming={actief}
          magPlannen={magPlannen}
          sleepbaar={sleepbaar}
          tegelRef={tegelRef}
          onKies={onKies}
          onNieuw={onNieuw}
        />
      ) : null}
    </div>
  );
}

/** The activiteiten of one subthema as cards, or the reason there are none, and after either the create tile. */
function Activiteitenlijst({
  klasId,
  bestemming,
  magPlannen,
  sleepbaar,
  tegelRef,
  onKies,
  onNieuw,
}: {
  klasId: string;
  bestemming: SubthemaBestemming;
  magPlannen: boolean;
  sleepbaar: boolean;
  tegelRef: Ref<HTMLButtonElement>;
  onKies: (activiteit: GekozenActiviteit) => void;
  onNieuw: (bestemming: Activiteitbestemming) => void;
}) {
  const thema = useThemaVoorKlas(bestemming.themaId, klasId);
  const { mag } = useRechten();
  const { data: ik } = useIk();
  const subthema = thema.data?.subthemas.find((sub) => sub.id === bestemming.id);

  if (thema.isPending) return <Laadlijst rijen={3} />;

  // A failed request is not an empty subthema, so it says only what it knows, and offers no tile: a list it could not
  // read is no ground for offering to add to it (the rule `Hoekenpaneel` follows).
  if (thema.isError && thema.data === undefined) {
    return (
      <p role="alert" className="text-meta text-attentie-inkt">
        {t("hoekenpaneel.mislukt")}
      </p>
    );
  }

  const activiteiten = subthema?.activiteiten ?? [];
  const isVanCollega = (activiteit: ActiviteitWeergave) => activiteit.eigenaarId != null && !isEigenVan(ik, activiteit);
  // Making one from here is part of planning (owner, 2026-09-15: no tile for whoever only reads the klas), and needs the
  // content right at the subthema's leeftijd too (R17, R23), and the subthema itself for its onderzoeksvragen and subdoelen.
  const tegel =
    magPlannen && subthema && mag.activiteitMaken(bestemming.leeftijd) ? (
      <Toevoegtegel
        key="toevoegen"
        ref={tegelRef}
        label={t("activiteit.toevoegen")}
        onKies={() =>
          onNieuw({
            subthemaId: subthema.id,
            themaId: bestemming.themaId,
            leeftijd: bestemming.leeftijd,
            onderzoeksvragen: subthema.onderzoeksvragen,
            subdoelen: subthema.subdoelen,
          })
        }
      />
    ) : null;

  // Both branches return the same `div` with the tile as its second child, so the tile keeps its DOM node, and the
  // focus returned to it, when the first activiteit replaces the empty sentence (see `Hoekenpaneel`'s `Fichelijst`).
  if (activiteiten.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-inkt-zacht">{t("activiteitenpaneel.geenActiviteiten")}</p>
        {tegel}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {activiteiten.map((activiteit) => (
          <li key={activiteit.id}>
            {/* A colleague's own activiteit is not planned as it is (ADR-0049 D6): it is used first, as an own copy. */}
            {magPlannen && isVanCollega(activiteit) ? (
              <Leeskaart
                activiteit={activiteit}
                gebruik={mag.activiteitGebruiken({ ...activiteit, leeftijd: bestemming.leeftijd }) ? activiteit : undefined}
                themaId={bestemming.themaId}
              />
            ) : magPlannen ? (
              <Activiteitkaart activiteit={activiteit} sleepbaar={sleepbaar} onKies={onKies} />
            ) : (
              <Leeskaart activiteit={activiteit} />
            )}
          </li>
        ))}
      </ul>
      {tegel}
    </div>
  );
}

/**
 * The goals an activiteit works on, as the info icon and the mark count them: its accepted and manual links, which is
 * what the server counts for the weekplanning's `Doelcodes` (FB-018). A suggestion is never a goal of the card, and
 * the mark and the window it opens cannot disagree, because both read this one list.
 */
function doelenVan(activiteit: ActiviteitWeergave): Infodoel[] {
  return activiteit.doelkoppelingen
    .filter((koppeling) => koppeling.status === "Aanvaard" || koppeling.status === "Manueel")
    .map((koppeling) => ({ code: koppeling.leerplandoelCode }));
}

/**
 * One activiteit: dragged onto an hour of the agenda, or clicked to plan it from a sheet.
 *
 * The same card as a fiche in the panel, and the same two gestures on one button (see `Hoekenpaneel`'s `Fiche`). The
 * name and the length travel with the drag, because the agenda does not load this list.
 *
 * **Its goals behind the info icon in the corner, beside the button and not in it**, as on every card in this panel
 * (FB-018; owner, 2026-09-15: the activiteitkaarten get the icon from whichever of the two tickets merges second).
 */
function Activiteitkaart({
  activiteit,
  sleepbaar,
  onKies,
}: {
  activiteit: ActiviteitWeergave;
  sleepbaar: boolean;
  onKies: (activiteit: GekozenActiviteit) => void;
}) {
  const duur = (activiteit.lengteInLesuren ?? 1) * STANDAARDDUUR;
  const data: Activiteitkaartdata = { naam: activiteit.naam, duur };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${ACTIVITEIT_VOORVOEGSEL}${activiteit.id}`,
    data,
  });
  const doelen = doelenVan(activiteit);

  return (
    <div className="relative">
      <button
        type="button"
        ref={sleepbaar ? setNodeRef : undefined}
        onClick={() => onKies({ id: activiteit.id, naam: activiteit.naam, duur })}
        {...(sleepbaar ? listeners : {})}
        {...(sleepbaar ? attributes : {})}
        className={cn(
          // Room for the icon, so a long name wraps before it rather than running under it.
          "w-full rounded-veld border border-lijn bg-vlak py-2.5 pl-3 pr-9 text-left",
          "transition-colors duration-150 hover:border-accent",
          sleepbaar ? "cursor-grab touch-none active:cursor-grabbing" : null,
          isDragging && "opacity-40",
        )}
      >
        <Kaartinhoud activiteit={activiteit} doelen={doelen} />
      </button>
      <Doelinfo naam={activiteit.naam} doelen={doelen} className="absolute right-1.5 top-1.5" />
    </div>
  );
}

/**
 * The same card for whoever may only read the klas, and for a colleague's own activiteit: what it says, and nothing it
 * plans. The info icon stays, because reading an activiteit's goals is reading, not planning.
 *
 * **A colleague's own activiteit carries "Gebruiken"** when the gebruiker may take a copy (ADR-0049 D5). The copy then
 * lands in this same list as her own card, ready to drag, which is the one gesture the original does not offer.
 */
function Leeskaart({
  activiteit,
  gebruik,
  themaId,
}: {
  activiteit: ActiviteitWeergave;
  /** The activiteit to copy on "Gebruiken"; absent without that right. */
  gebruik?: ActiviteitWeergave;
  themaId?: string;
}) {
  const doelen = doelenVan(activiteit);
  const kopie = useGebruikActiviteit(themaId);
  return (
    <div className="relative">
      <div className="w-full rounded-veld border border-lijn bg-vlak py-2.5 pl-3 pr-9">
        <Kaartinhoud activiteit={activiteit} doelen={doelen} />
        {gebruik ? (
          <Knop
            rang="rustig"
            className="mt-2 h-9 min-h-9 px-3 text-meta"
            disabled={kopie.isPending}
            aria-label={t("activiteit.gebruikAria", {
              naam: activiteit.naam,
              eigenaar: activiteit.eigenaarNaam ?? t("activiteit.vanEenCollega"),
            })}
            onClick={() => kopie.mutate(gebruik.id)}
          >
            {kopie.isPending ? t("activiteit.gebruikBezig") : t("activiteit.gebruik")}
          </Knop>
        ) : null}
        {kopie.isError ? (
          <p role="alert" className="mt-1.5 text-meta text-attentie-inkt">
            {geenToegangZin(kopie.error) ?? t("activiteit.gebruikMislukt")}
          </p>
        ) : null}
      </div>
      <Doelinfo naam={activiteit.naam} doelen={doelen} className="absolute right-1.5 top-1.5" />
    </div>
  );
}

function Kaartinhoud({ activiteit, doelen }: { activiteit: ActiviteitWeergave; doelen: readonly Infodoel[] }) {
  return (
    <>
      <p className="text-meta font-medium text-inkt">{activiteit.naam}</p>
      <Eigenaarmerk activiteit={activiteit} className="mt-0.5 flex" />
      <Doelmerk aantal={doelen.length} className="mt-1.5" />
    </>
  );
}

/**
 * The create form for an activiteit made from the panel: the same form the thema page uses, in the subthema the
 * panel shows. It lands in that subthema's list when it saves, ready to plan, as a fiche made from the panel does.
 */
export function Paneelactiviteitformulier({
  bestemming,
  onSluit,
}: {
  bestemming: Activiteitbestemming;
  onSluit: () => void;
}) {
  const maak = useMaakActiviteit(bestemming.themaId);

  return (
    <Activiteitformulier
      open
      // The leeftijd decides "voor wie" and the goal picker of the new activiteit (ADR-0049 D1, E3; R19).
      leeftijd={bestemming.leeftijd}
      onderzoeksvragen={bestemming.onderzoeksvragen}
      subdoelen={bestemming.subdoelen}
      bezig={maak.isPending}
      fout={maak.isError ? maak.error : undefined}
      onBewaar={(invoer) => maak.mutate({ subthemaId: bestemming.subthemaId, invoer }, { onSuccess: onSluit })}
      onSluit={onSluit}
    />
  );
}
