import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Segment } from "../../components/ui/Segment";
import { Veld, Keuze, Invoer } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { knopklassen } from "../../components/ui/knopklassen";
import { useThemasVoorKlas } from "../../lib/queries";
import type { Dagweergave, ThemaWeergave } from "../../lib/types";
import { dagMaand } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { verdeelDagen, type Verdeling } from "./verdeling";
import { lijstMeldingen, sleepUitleg, useSleepSensors } from "./sleep";
import { IcoonGreep, IcoonPijlRechts } from "../../components/Iconen";

interface Voorstel {
  activiteitId: string;
  activiteitNaam: string;
  datum: string;
}

/**
 * A whole subthema onto the calendar in one go.
 *
 * Placing activiteiten one day at a time is the obvious way to build this and the wrong one: a
 * subthema is planned as a unit, so the unit is what the teacher should be able to move onto the
 * week.
 *
 * There is no bulk endpoint on the server and this deliberately does not ask for one. It issues the
 * same POST per activiteit that a single placement issues, one after the other, and reports what
 * actually happened. That keeps the server contract untouched, and it means a partial result is a
 * partial result: whatever landed stays landed, and the rows that failed are named with the reason
 * the server gave.
 */
export function Subthemaplanner({
  open,
  klasId,
  klasNaam,
  themaIds,
  dagen,
  bezig,
  resultaat,
  onPlan,
  onSluit,
}: {
  open: boolean;
  klasId: string | null;
  /** Named in the empty state, because which klas is selected is exactly what makes it empty. */
  klasNaam: string | null;
  themaIds: string[];
  dagen: Dagweergave[];
  bezig: boolean;
  resultaat: { gelukt: number; totaal: number; fouten: string[] } | null;
  /**
   * The chosen activiteiten AND the window they were chosen in.
   *
   * The window travels separately because it is not derivable from the voorstellen: a subthema with one activiteit
   * over five marked-off days yields one voorstel, and the four remaining days are exactly what the caller has to
   * store. That was the defect the owner reported.
   */
  onPlan: (voorstellen: Voorstel[], venster: { subthemaId: string; van: string; tot: string }) => void;
  onSluit: () => void;
}) {
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);
  const [subthemaId, setSubthemaId] = useState("");
  const [verdeling, setVerdeling] = useState<Verdeling>("achterElkaar");
  const [startdag, setStartdag] = useState("");
  const [einddag, setEinddag] = useState("");
  // The order the activiteiten go onto the days, once the teacher has dragged it away from the one
  // the subthema stores. Null means "as the subthema has them", which is not the same as a copy of
  // that order: a copy would go stale the moment the subthema changed underneath it.
  const [volgorde, setVolgorde] = useState<string[] | null>(null);
  const sensors = useSleepSensors();

  // Only teaching days can carry an activiteit; the server refuses a closed one. Vakanties are
  // therefore skipped rather than counted, which is what makes "achter elkaar" mean five school
  // days instead of five calendar days across a holiday.
  const lesdagen = useMemo(() => dagen.filter((dag) => dag.isLesdag).map((dag) => dag.datum), [dagen]);

  /**
   * EVERY subthema of the period, including the ones with no activiteiten yet.
   *
   * They used to be filtered out, on the reasoning that a subthema with nothing in it has nothing to plan. That
   * stopped being true when the chosen window became something the plan stores (owner ruling, 2026-08-25): marking off
   * a fortnight for a subthema whose activiteiten do not exist yet is now a real outcome, and it is the ordinary order
   * of work. Filtering them out made the one subthema a teacher most needs to reach the one they could not.
   */
  const subthemas = useMemo(
    () => themas.flatMap((thema) => thema.subthemas.map((sub) => ({ ...sub, themaNaam: thema.naam }))),
    [themas],
  );

  const gekozen = subthemas.find((sub) => sub.id === subthemaId) ?? null;

  // Both ends default to the period, so the sheet opens on the widest sensible window and a teacher
  // who wants exactly that never has to touch either field.
  const eersteDag = startdag || lesdagen[0] || "";
  const laatsteDag = einddag || lesdagen[lesdagen.length - 1] || "";

  // The teaching days the subthema may use. Compared as strings rather than looked up by index:
  // `yyyy-MM-dd` sorts as it reads, so a date picked outside the school week (a Saturday, a day in
  // the vakantie) narrows the window instead of emptying it.
  //
  // Memoised because it is a dependency of the preview below, and a fresh array on every render
  // would recompute the preview on every keystroke elsewhere in the sheet.
  const beschikbaar = useMemo(
    () => lesdagen.filter((dag) => dag >= eersteDag && dag <= laatsteDag),
    [lesdagen, eersteDag, laatsteDag],
  );

  // The activiteiten in the order they will be planned. A dragged order is applied by id, and any
  // id it does not mention is appended, so an order captured before the subthema gained an
  // activiteit still places every one of them.
  const activiteiten = useMemo(() => {
    const eigen = gekozen?.activiteiten ?? [];
    if (!volgorde) return eigen;
    const plaats = new Map(volgorde.map((id, i) => [id, i]));
    return [...eigen].sort((a, b) => (plaats.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (plaats.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [gekozen, volgorde]);

  const voorstellen = useMemo<Voorstel[]>(() => {
    if (!gekozen) return [];
    // What does not fit is left out here rather than squeezed in, and reported as a tekort below.
    const dagenVoorActiviteit = verdeelDagen(beschikbaar, activiteiten.length, verdeling);
    return dagenVoorActiviteit.map((datum, i) => ({
      activiteitId: activiteiten[i].id,
      activiteitNaam: activiteiten[i].naam,
      datum,
    }));
  }, [gekozen, activiteiten, beschikbaar, verdeling]);

  const tekort = gekozen ? gekozen.activiteiten.length - voorstellen.length : 0;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={t("periode.planSubthema")}
      voet={
        // No footer when the period has nothing to plan: the sheet then says why, and a button
        // that can never become enabled is a button that should not be there.
        subthemas.length === 0 ? undefined : (
          <Knop
            rang="hoofd"
            vol
            // NOT disabled for having nothing to place. Marking off the days is now an outcome of its own, so a
            // subthema with no activiteiten yet is plannable, which is the whole point of storing the window. What
            // still blocks is a subthema not chosen (nothing to mark off), a window with no teaching day in it, and a
            // tekort: five activiteiten into three days would silently drop two, and widening the window is the fix.
            disabled={bezig || gekozen === null || beschikbaar.length === 0 || tekort > 0}
            onClick={() => onPlan(voorstellen, { subthemaId, van: eersteDag, tot: laatsteDag })}
          >
            {bezig
              ? t("periode.bezig")
              : tekort > 0
                ? // The count would be of what FITS rather than of what this button does, which is all of it or
                  // nothing. The tekort notice beside it says how many days short the window is.
                  t("periode.planIn")
                : voorstellen.length === 0
                  ? // Nothing to place, and something to do all the same: the days get marked off so the subthema has
                    // a period before it has content.
                    t("periode.markeerPeriode")
                  : telWoord(voorstellen.length, "periode.planEen", "periode.planAantal")}
          </Knop>
        )
      }
    >
      {laadt ? (
        <Laadlijst rijen={4} />
      ) : subthemas.length === 0 ? (
        <Nietsomteplannen klasNaam={klasNaam} themas={themas} />
      ) : (
        <div className="flex flex-col gap-4">
          <Veld label={t("periode.subthema")}>
            {(id) => (
              <Keuze id={id} value={subthemaId} onChange={(e) => {
                  setSubthemaId(e.target.value);
                  setVolgorde(null);
                }}>
                <option value="">{t("periode.kiesSubthema")}</option>
                {subthemas.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.themaNaam} / {sub.naam} ({sub.activiteiten.length})
                  </option>
                ))}
              </Keuze>
            )}
          </Veld>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Veld label={t("periode.eersteDag")}>
              {(id) => (
                <Invoer
                  id={id}
                  type="date"
                  min={lesdagen[0]}
                  max={laatsteDag}
                  value={eersteDag}
                  onChange={(e) => setStartdag(e.target.value)}
                />
              )}
            </Veld>

            <Veld label={t("periode.laatsteDag")}>
              {(id) => (
                <Invoer
                  id={id}
                  type="date"
                  min={eersteDag}
                  max={lesdagen[lesdagen.length - 1]}
                  value={laatsteDag}
                  onChange={(e) => setEinddag(e.target.value)}
                />
              )}
            </Veld>
          </div>

          {/* Not wrapped in Veld: that renders a <label for=...>, and a radiogroup has no single
              form control for a label to point at. The radiogroup names itself instead. */}
          <Segment
            label={t("periode.verdeling")}
            waarde={verdeling}
            onKies={setVerdeling}
            className="w-full"
            opties={[
              { waarde: "achterElkaar", label: t("periode.achterElkaar") },
              { waarde: "verspreid", label: t("periode.verspreid") },
            ]}
          />

          {gekozen ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-micro uppercase text-inkt-zwak">{t("periode.voorbeeld")}</h3>

              {voorstellen.length === 0 ? (
                <p className="text-meta text-inkt-zwak">{t("periode.geenLesdagen")}</p>
              ) : (
                /* The dates stay put and the activiteiten move between them. That is the whole
                   point of reordering here: the teacher is choosing what happens first, not moving
                   a card to a date, and the window above already decided which dates exist. */
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  accessibility={{
                    announcements: lijstMeldingen(
                      (id) => voorstellen.find((v) => v.activiteitId === id)?.activiteitNaam ?? "",
                      voorstellen.length,
                    ),
                    screenReaderInstructions: sleepUitleg,
                  }}
                  onDragEnd={({ active, over }: DragEndEvent) => {
                    if (!over || active.id === over.id) return;
                    const ids = voorstellen.map((v) => v.activiteitId);
                    const van = ids.indexOf(String(active.id));
                    const naar = ids.indexOf(String(over.id));
                    if (van < 0 || naar < 0) return;
                    setVolgorde(arrayMove(ids, van, naar));
                  }}
                >
                  <SortableContext
                    items={voorstellen.map((v) => v.activiteitId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ol className="flex flex-col gap-1">
                      {voorstellen.map((voorstel) => (
                        <Voorstelregel key={voorstel.activiteitId} voorstel={voorstel} />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}

              {/* Only next to a preview. With an empty window the line above already says why there
                  is nothing, and repeating it as an arithmetic shortfall says less, not more. */}
              {tekort > 0 && voorstellen.length > 0 ? (
                <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                  {t("periode.pastNiet", { tekort })}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* What actually happened, after the fact. It names the rows that failed with the reason
              the server gave, and it never says everything worked when some of it did not. */}
          {resultaat ? (
            <section className="flex flex-col gap-2">
              <p className="text-meta text-inkt-zacht">
                {t("periode.deelsGelukt", { gelukt: resultaat.gelukt, totaal: resultaat.totaal })}
              </p>
              {resultaat.fouten.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {resultaat.fouten.map((fout) => (
                    <li
                      key={fout}
                      className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
                    >
                      {fout}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {gekozen && beschikbaar.length > 0 ? (
            <p className="text-meta text-inkt-zwak">
              {telWoord(beschikbaar.length, "periode.eenLesdag", "periode.aantalLesdagen")}
            </p>
          ) : null}
        </div>
      )}
    </Blad>
  );
}

/**
 * The sheet with nothing to offer, and the two different reasons why.
 *
 * **A subthema belongs to one leeftijd** (Art. IX.2 as amended 2026-08-30), so "this thema has no
 * subthema" and "this klas has no subthema under this thema" are different facts, and the copy this
 * replaces stated the first while it could only mean the second. The owner hit exactly that: the
 * period's thema had a subthema, it was for an age this klas does not teach, and the sheet reported
 * the thema as empty. It now names the klas, says why a subthema for another age is not in the list,
 * and links to the screen where the missing one is made.
 *
 * *(The sentence originally read "een subthema hoort bij één klas", which the amendment made false
 * eight hours after it shipped. Rewritten rather than deleted, because the empty state itself is
 * still needed: a K3 class and an L3 class still see different subthema's.)*
 *
 * A period holding no thema at all is a third state, and it says so rather than being folded into the
 * second: there is no thema to make a subthema under, so the way out is a different screen.
 */
function Nietsomteplannen({ klasNaam, themas }: { klasNaam: string | null; themas: ThemaWeergave[] }) {
  if (themas.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-inkt">{t("periode.geenThemaInPeriode")}</p>
        <p className="text-meta text-inkt-zacht">{t("periode.geenThemaUitleg")}</p>
        <Link to="/agenda/periodes" className={cn(knopklassen(), "mt-1")}>
          {t("periode.themasPerPeriode")}
        </Link>
      </div>
    );
  }

  // Never the raw id: with the klas still loading the sentence loses the name rather than the point.
  const klas = klasNaam ?? t("periode.dezeKlas");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-inkt">
        {/* One thema is the ordinary case and it gets named, which is the whole fix: the teacher is
            looking at that name on the day behind this sheet. Two or more would need a list, and a
            list of names in a sentence says less than the buttons below it already do. */}
        {themas.length === 1
          ? t("periode.geenSubthemaVoorKlasEen", { klas, thema: themas[0].naam })
          : t("periode.geenSubthemaVoorKlasMeer", { klas })}
      </p>
      <p className="text-meta text-inkt-zacht">{t("periode.subthemaHoortBijLeeftijd")}</p>

      {/* A destination, so a link and not a Knop: it goes in the address bar and takes a middle
          click. One per thema, because the subthema has to be made under one of them. */}
      <ul className="mt-1 flex flex-col gap-2">
        {themas.map((thema) => (
          <li key={thema.id}>
            <Link
              to={`/themas/${thema.id}`}
              className={cn(knopklassen(), "w-full justify-between gap-3 text-left")}
            >
              <span className="min-w-0 truncate">{t("periode.maakSubthemaBij", { thema: thema.naam })}</span>
              <IcoonPijlRechts aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One row of the preview: a handle to reorder by, the activiteit, and the day it would land on. */
function Voorstelregel({ voorstel }: { voorstel: Voorstel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: voorstel.activiteitId,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-veld border border-lijn bg-kaart py-2 pl-1.5 pr-3",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      {/* A handle rather than the whole row. The row is not otherwise pressable, so making it one
          big drag target would give a keyboard user a control with no other purpose to discover. */}
      <button
        type="button"
        aria-label={t("slepen.versleep", { naam: voorstel.activiteitNaam })}
        {...listeners}
        {...attributes}
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
      >
        <IcoonGreep className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-body text-inkt">{voorstel.activiteitNaam}</span>
      <span className="mono shrink-0 text-[0.6875rem] text-inkt-zacht">{dagMaand(voorstel.datum)}</span>
    </li>
  );
}

export type { Voorstel };
