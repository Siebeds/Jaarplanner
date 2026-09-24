import { useId, useMemo, type ReactNode, type Ref } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonChevron, IcoonGreep, IcoonPlan } from "../../components/Iconen";
import { vandaag } from "../../lib/datum";
import { useActiviteitplaatsingen, useSubthemaBestemmingen, useThemaVoorKlas } from "../../lib/queries";
import { geenToegangZin, isEigenVan, useRechten } from "../../lib/rechten";
import { useIk } from "../../lib/aanmelding";
import { Knop } from "../../components/ui/Knop";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import type { ActiviteitWeergave, SubthemaBestemming, SubthemaWeergave } from "../../lib/types";
import { t, type Vertaalsleutel } from "../../i18n";
import { cn } from "../../lib/cn";
import { NieuweActiviteit } from "../activiteiten/NieuweActiviteit";
import { useGebruikActiviteit, useMaakActiviteit } from "../themas/mutaties";
import { Eigenaarmerk } from "../activiteiten/Eigenaarmerk";
import { Toevoegtegel } from "../hoeken/Toevoegtegel";
import { STANDAARDDUUR } from "./tijd";
import { ACTIVITEIT_VOORVOEGSEL, type Activiteitkaartdata } from "./activiteitkaart";
import { Doelinfo, type Infodoel } from "./Doelinfo";
import { ingeplandeDag } from "./ingepland";

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
 * A card shows the activiteit's name, when it is next planned, and how many doelen it has, the one fact about its
 * goals a teacher scans a list for: one without doelen cannot count for the dekking wherever it is planned (FB-102).
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
  const optieNaam = (b: SubthemaBestemming) =>
    meerdereLeeftijden ? t("activiteitenpaneel.subthemaLeeftijd", { naam: b.naam, leeftijd: b.leeftijd }) : b.naam;

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
        {/* A native select that shows its choice in a text of its own, so a long name wraps to a second line instead
            of being cut off (FB-102). The select lies over the whole field, invisible, and is what is pressed, read
            and focused: the keyboard, the phone's own picker and a screen reader get the real control. */}
        <div
          className={cn(
            "relative mt-1.5 flex min-h-raak items-center rounded-veld border border-lijn-veld bg-kaart py-2 pl-3 pr-10",
            "transition-colors duration-150 hover:border-inkt-zacht",
            "has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent",
          )}
        >
          <span aria-hidden="true" className={cn("text-body leading-snug", actief ? "text-inkt" : "text-inkt-zacht")}>
            {actief ? optieNaam(actief) : t("activiteitenpaneel.kiesSubthema")}
          </span>
          <select
            id={`${id}-subthema`}
            value={actief?.id ?? ""}
            onChange={(e) =>
              kiesSubthema(e.target.value === "" ? null : { subthemaId: e.target.value, klasId, week: week.maandag })
            }
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
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
                    {optieNaam(b)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <IcoonChevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkt-zwak" />
        </div>

        {/* Only when it is true: the chosen subthema is one of the runs touching that week. */}
        {actief && lopend?.includes(actief.id) ? (
          <p className="mt-1.5 text-meta text-inkt-zacht">{t("activiteitenpaneel.looptInWeek", { nummer: week.nummer })}</p>
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

/** Whose an activiteit is (ADR-0049): the school's, the gebruiker's own, or a colleague's own. */
type Soort = "gedeeld" | "eigen" | "collega";

/**
 * The activiteiten of one subthema in two groups, what is still to plan above what is planned, or the reason there are
 * none; and after either the create tile.
 *
 * **Still to plan first** (FB-102): that is what a teacher opens this panel for. A group without activiteiten drops
 * away, and the hint how to plan stands once, over the group it is about, rather than on every card.
 *
 * **The groups need the read of where they stand.** "Nog in te plannen" is a claim, so the list waits for that read,
 * and when it failed it shows one list without groups and says what it could not read, rather than filing every
 * activiteit under "nog in te plannen".
 */
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

  // Where each of them already stands in this klas's year (FB-076); null when that could not be read.
  const plaatsingen = useActiviteitplaatsingen(klasId);
  const dagenPer = useMemo(
    () => (plaatsingen.data ? new Map(plaatsingen.data.activiteiten.map((a) => [a.activiteitId, a.datums])) : null),
    [plaatsingen.data],
  );

  if (thema.isPending || plaatsingen.isPending) return <Laadlijst rijen={3} />;

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

  const soortVan = (activiteit: ActiviteitWeergave): Soort =>
    activiteit.eigenaarId == null ? "gedeeld" : isEigenVan(ik, activiteit) ? "eigen" : "collega";
  const soorten = activiteiten.map(soortVan);
  const gelabeld = gelabeldeSoorten(soorten);
  const eenSoort = soorten.every((soort) => soort === soorten[0]) && soorten[0] !== "collega" ? soorten[0] : null;
  // A colleague's own activiteit is not planned as it is (ADR-0049 D6): it is used first, as an own copy.
  const plant = (activiteit: ActiviteitWeergave) => magPlannen && soortVan(activiteit) !== "collega";
  const nu = vandaag();

  const kaart = (activiteit: ActiviteitWeergave) => {
    const soort = soortVan(activiteit);
    const dag = dagenPer ? ingeplandeDag(dagenPer.get(activiteit.id) ?? [], nu) : undefined;
    const label = gelabeld.has(soort) ? <Soortlabel activiteit={activiteit} soort={soort} /> : null;
    return (
      <li key={activiteit.id}>
        {plant(activiteit) ? (
          <Activiteitkaart activiteit={activiteit} dag={dag} label={label} sleepbaar={sleepbaar} onKies={onKies} />
        ) : (
          <Leeskaart
            activiteit={activiteit}
            dag={dag}
            label={label}
            gebruik={
              magPlannen && mag.activiteitGebruiken({ ...activiteit, leeftijd: bestemming.leeftijd }) ? activiteit : undefined
            }
            themaId={bestemming.themaId}
          />
        )}
      </li>
    );
  };

  const open = dagenPer ? activiteiten.filter((a) => (dagenPer.get(a.id) ?? []).length === 0) : [];
  const gepland = dagenPer ? activiteiten.filter((a) => (dagenPer.get(a.id) ?? []).length > 0) : [];
  // Only over a group holding a card this gebruiker can plan, and naming the gesture this width offers.
  const hint = open.some(plant) ? t(sleepbaar ? "activiteitenpaneel.sleepHint" : "activiteitenpaneel.tikHint") : null;

  return (
    <div className="flex flex-col gap-4">
      {dagenPer === null ? (
        <div>
          <p className="mb-2 text-meta text-inkt-zacht">{t("activiteitenpaneel.plaatsingenMislukt")}</p>
          <ul className="flex flex-col gap-1.5">{activiteiten.map(kaart)}</ul>
        </div>
      ) : (
        <>
          {open.length > 0 ? (
            <Groep titel={t("activiteitenpaneel.nogInTePlannen", { aantal: open.length })} hint={hint}>
              {open.map(kaart)}
            </Groep>
          ) : null}
          {gepland.length > 0 ? (
            <Groep titel={t("activiteitenpaneel.ingepland", { aantal: gepland.length })}>{gepland.map(kaart)}</Groep>
          ) : null}
        </>
      )}
      {tegel}
      {eenSoort ? <p className="text-meta text-inkt-zacht">{soortZin(eenSoort, activiteiten.length)}</p> : null}
    </div>
  );
}

/** One group of cards under its heading, the count in the heading (FB-102). */
function Groep({ titel, hint, children }: { titel: string; hint?: string | null; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-meta font-semibold text-inkt-zacht">
        {titel}
      </h3>
      {hint ? <p className="text-meta text-inkt-zacht">{hint}</p> : null}
      <ul className="mt-2 flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

/**
 * Which kinds of activiteit carry their kind on the card (FB-102).
 *
 * What holds for every card is said once, under the list (`soortZin`), and not on each of them. Where the gebruiker's
 * own and shared ones stand mixed, only the smaller group is marked, and the rest reads as the other kind. A
 * colleague's activiteit always says whose it is: that is what its "Gebruiken" is about. When a colleague's stand
 * beside only one other kind, that kind is marked too, because unmarked it could be either.
 */
function gelabeldeSoorten(soorten: readonly Soort[]): ReadonlySet<Soort> {
  const eigen = soorten.filter((soort) => soort === "eigen").length;
  const gedeeld = soorten.filter((soort) => soort === "gedeeld").length;
  const collega = soorten.length - eigen - gedeeld;

  if (collega === 0 && (eigen === 0 || gedeeld === 0)) return new Set();
  if (eigen > 0 && gedeeld > 0) return new Set<Soort>(["collega", eigen <= gedeeld ? "eigen" : "gedeeld"]);
  return new Set<Soort>(["collega", "eigen", "gedeeld"]);
}

/** "Alle drie zijn je eigen activiteiten.": said once under a list of one kind only. */
function soortZin(soort: "eigen" | "gedeeld", aantal: number): string {
  const eigen = soort === "eigen";
  if (aantal === 1) return t(eigen ? "activiteitenpaneel.alleEigenEen" : "activiteitenpaneel.alleGedeeldEen");
  if (aantal === 2) return t(eigen ? "activiteitenpaneel.alleEigenTwee" : "activiteitenpaneel.alleGedeeldTwee");
  const woord = aantal <= 12 ? t(`telwoord.${aantal}` as Vertaalsleutel) : String(aantal);
  return t(eigen ? "activiteitenpaneel.alleEigen" : "activiteitenpaneel.alleGedeeld", { aantal: woord });
}

function Soortlabel({ activiteit, soort }: { activiteit: ActiviteitWeergave; soort: Soort }) {
  if (soort === "gedeeld") return <span className="mt-0.5 block text-meta text-inkt-zacht">{t("activiteit.gedeeld")}</span>;
  return <Eigenaarmerk activiteit={activiteit} className="mt-0.5 flex" />;
}

/**
 * The goals an activiteit works on, as the button counts them: its accepted and manual links, which is what the server
 * counts for the weekplanning's `Doelcodes` (FB-018). A suggestion is never a goal of the card, and the count and the
 * window it opens cannot disagree, because both read this one list.
 */
function doelenVan(activiteit: ActiviteitWeergave): Infodoel[] {
  return activiteit.doelkoppelingen
    .filter((koppeling) => koppeling.status === "Aanvaard" || koppeling.status === "Manueel")
    .map((koppeling) => ({ code: koppeling.leerplandoelCode }));
}

/**
 * One activiteit: dragged onto an hour of the agenda, or clicked to plan it from a sheet.
 *
 * The same two gestures on one button as a fiche in the panel (see `Hoekenpaneel`'s `Fiche`), with a grip where it
 * drags. The name and the length travel with the drag, because the agenda does not load this list.
 *
 * **The button lies under the whole card, and the text over it lets presses through** (FB-102). The goal count has to
 * sit in the line beside the date, and a button inside a button is invalid; so the card's words are not the button's
 * children but its label (`aria-labelledby`), and the count is a sibling that starts no drag and plans nothing. A count
 * laid over the button instead needs room reserved for it, which in a 240px column broke the date onto two lines.
 */
function Activiteitkaart({
  activiteit,
  dag,
  label,
  sleepbaar,
  onKies,
}: {
  activiteit: ActiviteitWeergave;
  /** See `Kaartinhoud`. */
  dag: string | null | undefined;
  label: ReactNode;
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
  const naamId = useId();
  const wanneerId = useId();

  return (
    <div
      className={cn(
        "relative flex gap-1 rounded-veld border border-lijn bg-kaart py-2 pr-2",
        "transition-colors duration-150 hover:border-accent",
        sleepbaar ? "pl-1" : "pl-3",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        ref={sleepbaar ? setNodeRef : undefined}
        aria-labelledby={`${naamId} ${wanneerId}`}
        onClick={() => onKies({ id: activiteit.id, naam: activiteit.naam, duur })}
        {...(sleepbaar ? listeners : {})}
        {...(sleepbaar ? attributes : {})}
        className={cn("absolute inset-0 rounded-veld", sleepbaar && "cursor-grab touch-none active:cursor-grabbing")}
      />
      {sleepbaar ? <IcoonGreep className="pointer-events-none relative mt-1 h-4 w-4 shrink-0 text-inkt-zwak" /> : null}
      <div className="pointer-events-none relative min-w-0 flex-1">
        <Kaartinhoud
          naam={activiteit.naam}
          naamId={naamId}
          wanneerId={wanneerId}
          dag={dag}
          label={label}
          doelen={<Doelinfo naam={activiteit.naam} doelen={doelen} telling className="pointer-events-auto" />}
        />
      </div>
    </div>
  );
}

/**
 * The same card for whoever may only read the klas, and for a colleague's own activiteit: what it says, and nothing it
 * plans. The goals stay, because reading an activiteit's goals is reading, not planning.
 *
 * **A colleague's own activiteit carries "Gebruiken"** when the gebruiker may take a copy (ADR-0049 D5). The copy then
 * lands in this same list as her own card, ready to drag, which is the one gesture the original does not offer.
 */
function Leeskaart({
  activiteit,
  dag,
  label,
  gebruik,
  themaId,
}: {
  activiteit: ActiviteitWeergave;
  /** See `Kaartinhoud`. */
  dag: string | null | undefined;
  label: ReactNode;
  /** The activiteit to copy on "Gebruiken"; absent without that right. */
  gebruik?: ActiviteitWeergave;
  themaId?: string;
}) {
  const doelen = doelenVan(activiteit);
  const kopie = useGebruikActiviteit(themaId);
  return (
    <div className="w-full rounded-veld border border-lijn bg-kaart py-2 pl-3 pr-2.5">
      <Kaartinhoud
        naam={activiteit.naam}
        dag={dag}
        label={label}
        doelen={<Doelinfo naam={activiteit.naam} doelen={doelen} telling />}
      />
      {gebruik ? (
        <Knop
          rang="rustig"
          className="mt-2 h-9 min-h-9 px-3 text-meta"
          bezig={kopie.isPending}
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
  );
}

/**
 * What a card says: its name, its kind where that is not said once for all (`gelabeldeSoorten`), and on one line when
 * it is next planned, beside its goals (FB-102).
 *
 * The day is short and on one line ("ma 5 okt"); a screen reader hears the whole sentence instead, which is also what
 * `wanneerId` names for the card's button.
 */
function Kaartinhoud({
  naam,
  naamId,
  wanneerId,
  dag,
  label,
  doelen,
}: {
  naam: string;
  /** Ids for the button that `Activiteitkaart` lays under the card, which takes its name from these words. */
  naamId?: string;
  wanneerId?: string;
  /**
   * The day it next stands on in this klas's agenda (`ingeplandeDag`); null when it stands nowhere; undefined when
   * that could not be read, and then the card says nothing about it rather than "nog niet ingepland".
   */
  dag: string | null | undefined;
  label: ReactNode;
  doelen: ReactNode;
}) {
  return (
    <>
      <p id={naamId} className="text-body font-medium leading-snug text-inkt">
        {naam}
      </p>
      {label}
      {/* Wraps rather than overlaps: "Nog niet ingepland" beside "Nog geen doel" is wider than the column, and the
          count then moves to the next line, still on the right. */}
      <div className="mt-1 flex min-h-7 flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        <p className="mr-auto flex items-center gap-1 whitespace-nowrap text-meta text-inkt-zacht">
          {dag ? (
            <>
              <IcoonPlan aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span id={wanneerId} className="sr-only">
                {t("activiteitenpaneel.ingeplandOp", { dag })}
              </span>
              <span aria-hidden="true">{dag}</span>
            </>
          ) : dag === null ? (
            <span id={wanneerId}>{t("activiteitenpaneel.nietIngepland")}</span>
          ) : null}
        </p>
        {doelen}
      </div>
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
    <NieuweActiviteit
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
