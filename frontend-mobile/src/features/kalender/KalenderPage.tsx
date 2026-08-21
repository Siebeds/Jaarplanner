import { useMemo, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { Spinner } from "../../components/ui/Spinner";
import { FoutState } from "../../components/ui/EmptyState";
import { IconPlus } from "../../components/Icons";
import { useJaarplan, useThemas } from "../../lib/queries";
import { useAppState } from "../../state/appState";
import type { AgendaItem } from "../../state/appState";
import { isoDatum } from "../../lib/utils";
import {
  DAG_EIND_UUR,
  DAG_START_UUR,
  agendaKleurKlassen,
  dagnamen,
  halfUurBlokken,
  isActiefOp,
  maandRooster,
  minutenSindsStart,
  themaBannerLabel,
  themaKleurKlasse,
  subthemaNaamVoorKlas,
  voegDagenToe,
  voegMaandenToe,
  weekBanners,
  weekRooster,
} from "./kalenderHulp";
import { ActiviteitKiezerSheet } from "./ActiviteitKiezerSheet";
import { AgendaItemDetailPanel } from "./AgendaItemDetailPanel";
import type { ThemaplaatsingWeergave } from "../../lib/types";

type Zoom = "maand" | "week" | "dag";

export function KalenderPage() {
  const { klasId, agenda, plaatsInAgenda, werkAgendaItemBij, verwijderUitAgenda } = useAppState();
  const { data: jaarplan, isLoading, isError } = useJaarplan(klasId ?? undefined);
  const { data: themas } = useThemas();
  const [zoom, setZoom] = useState<Zoom>("maand");
  const [cursor, setCursor] = useState(() => new Date());
  const [kiezerOpen, setKiezerOpen] = useState(false);
  const [kiezerDag, setKiezerDag] = useState<Date | null>(null);
  const [bewerkItem, setBewerkItem] = useState<AgendaItem | null>(null);

  const plaatsingen = jaarplan?.plaatsingen ?? [];
  // Filtert corrupte agenda-items (bv. een oud item uit localStorage zonder geldig startUur/eindUur,
  // bijvoorbeeld door een vroegere app-versie of een handmatig aangepaste devtools-state) weg vóór het
  // renderen — anders crasht het hele dag-/weekoverzicht op één kapot item i.p.v. gewoon de rest te tonen.
  const isGeldigAgendaItem = (i: AgendaItem) =>
    typeof i.datum === "string" && /^\d{2}:\d{2}$/.test(i.startUur ?? "") && /^\d{2}:\d{2}$/.test(i.eindUur ?? "");
  const lokaleAgenda = klasId ? (agenda[klasId] ?? []).filter(isGeldigAgendaItem) : [];

  const actievePlaatsingenOp = (dag: Date) => plaatsingen.filter((p) => isActiefOp(p, dag));
  // "Water" alleen, of "Water: Regen" als deze klas een subthema heeft lopen binnen dat thema (Art. IX).
  const themaLabel = (p: ThemaplaatsingWeergave) =>
    themaBannerLabel(p.themaNaam, klasId ? subthemaNaamVoorKlas(themas ?? [], p.themaId, klasId) : undefined);
  const agendaItemsOp = (dag: Date) => lokaleAgenda.filter((i) => i.datum === isoDatum(dag));

  function navigeer(richting: -1 | 1) {
    setCursor((c) => (zoom === "maand" ? voegMaandenToe(c, richting) : voegDagenToe(c, zoom === "week" ? richting * 7 : richting)));
  }

  function openKiezer(vasteDag: Date | null) {
    setKiezerDag(vasteDag);
    setKiezerOpen(true);
  }

  const titel = useMemo(() => {
    if (zoom === "maand") return cursor.toLocaleDateString("nl-BE", { month: "long", year: "numeric" });
    if (zoom === "dag") return cursor.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
    const week = weekRooster(cursor);
    return `${week[0].toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} – ${week[6].toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}`;
  }, [cursor, zoom]);

  return (
    <div>
      <TopBar title="Kalender" />
      <div className="px-4 pb-6">
        {!klasId && <FoutState titel="Kies eerst een klas" beschrijving="Gebruik de klas-wissel bovenaan." />}

        {klasId && (
          <>
            <div className="mb-3 flex rounded-2xl bg-surface-verhoogd p-1">
              {(["maand", "week", "dag"] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`h-9 flex-1 rounded-xl text-sm font-semibold capitalize transition-colors ${
                    zoom === z ? "bg-terra text-terra-foreground shadow-kaart" : "text-ink-zacht"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => navigeer(-1)}
                aria-label="Vorige"
                className="flex h-touch w-touch items-center justify-center rounded-xl border border-rand bg-surface text-lg font-bold text-ink active:bg-terra-zacht"
              >
                ‹
              </button>
              <div className="text-center">
                <p className="text-sm font-bold capitalize text-ink">{titel}</p>
                <button onClick={() => setCursor(new Date())} className="text-xs font-semibold text-terra">
                  Vandaag
                </button>
              </div>
              <button
                onClick={() => navigeer(1)}
                aria-label="Volgende"
                className="flex h-touch w-touch items-center justify-center rounded-xl border border-rand bg-surface text-lg font-bold text-ink active:bg-terra-zacht"
              >
                ›
              </button>
            </div>

            {isLoading && <Spinner label="Jaarplan laden…" />}
            {isError && <FoutState titel="Kon het jaarplan niet laden" />}

            {jaarplan && zoom === "maand" && (
              <MaandGrid
                anker={cursor}
                actievePlaatsingenOp={actievePlaatsingenOp}
                agendaItemsOp={agendaItemsOp}
                themaLabel={themaLabel}
                onKiesDag={(d) => {
                  setCursor(d);
                  setZoom("week");
                }}
              />
            )}

            {jaarplan && zoom === "week" && (
              <WeekRooster
                anker={cursor}
                plaatsingen={plaatsingen}
                agendaItemsOp={agendaItemsOp}
                themaLabel={themaLabel}
                onKiesItem={(item) => setBewerkItem(item)}
              />
            )}

            {jaarplan && zoom === "dag" && (
              <DagRooster
                actievePlaatsingen={actievePlaatsingenOp(cursor)}
                agendaItems={agendaItemsOp(cursor)}
                themaLabel={themaLabel}
                onKiesItem={(item) => setBewerkItem(item)}
                onVerwijder={(id) => klasId && verwijderUitAgenda(klasId, id)}
              />
            )}

            <ActiviteitKiezerSheet
              open={kiezerOpen}
              onClose={() => setKiezerOpen(false)}
              vasteDag={kiezerDag}
              plaatsingen={plaatsingen}
              klasId={klasId}
              onKies={(item) => klasId && plaatsInAgenda(klasId, item)}
            />

            <AgendaItemDetailPanel
              open={!!bewerkItem}
              onClose={() => setBewerkItem(null)}
              item={bewerkItem}
              onOpslaan={(id, wijziging) => klasId && werkAgendaItemBij(klasId, id, wijziging)}
              onVerwijder={(id) => {
                if (klasId) verwijderUitAgenda(klasId, id);
                setBewerkItem(null);
              }}
            />

            <button
              onClick={() => openKiezer(zoom === "dag" ? cursor : null)}
              aria-label="Activiteit toevoegen aan mijn agenda"
              className="fixed bottom-[calc(2.75rem+env(safe-area-inset-bottom)+0.75rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-terra text-terra-foreground shadow-zweven active:opacity-90"
            >
              <IconPlus className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MaandGrid({
  anker,
  actievePlaatsingenOp,
  agendaItemsOp,
  onKiesDag,
  themaLabel,
}: {
  anker: Date;
  actievePlaatsingenOp: (d: Date) => ThemaplaatsingWeergave[];
  agendaItemsOp: (d: Date) => AgendaItem[];
  onKiesDag: (d: Date) => void;
  themaLabel: (p: ThemaplaatsingWeergave) => string;
}) {
  const dagen = maandRooster(anker);
  const vandaag = isoDatum(new Date());

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-ink-zwak">
        {dagnamen().map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dagen.map((dag) => {
          const inMaand = dag.getMonth() === anker.getMonth();
          const actief = actievePlaatsingenOp(dag);
          const agendaItems = agendaItemsOp(dag);
          const isVandaag = isoDatum(dag) === vandaag;
          return (
            <button
              key={isoDatum(dag)}
              onClick={() => onKiesDag(dag)}
              className={`flex min-h-[4.25rem] flex-col items-start gap-0.5 rounded-xl p-1 text-left text-xs ${
                inMaand ? "bg-surface" : "bg-transparent opacity-40"
              } ${isVandaag ? "ring-2 ring-terra" : "border border-rand"}`}
            >
              <span className={`font-semibold ${inMaand ? "text-ink" : "text-ink-zwak"}`}>{dag.getDate()}</span>
              <span className="flex w-full flex-col gap-0.5">
                {actief.slice(0, 2).map((p) => (
                  <span
                    key={p.id}
                    className={`w-full truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight text-white ${themaKleurKlasse(p.themaId)}`}
                  >
                    {themaLabel(p)}
                  </span>
                ))}
                {actief.length > 2 && <span className="text-[9px] font-semibold text-ink-zwak">+{actief.length - 2} thema</span>}
                {agendaItems.length > 0 && (
                  <span className="w-full truncate rounded bg-surface-verhoogd px-1 py-0.5 text-[9px] font-semibold text-terra">
                    {agendaItems.length} activiteit{agendaItems.length === 1 ? "" : "en"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekRooster({
  anker,
  plaatsingen,
  agendaItemsOp,
  onKiesItem,
  themaLabel,
}: {
  anker: Date;
  plaatsingen: ThemaplaatsingWeergave[];
  agendaItemsOp: (d: Date) => AgendaItem[];
  onKiesItem: (item: AgendaItem) => void;
  themaLabel: (p: ThemaplaatsingWeergave) => string;
}) {
  const dagen = weekRooster(anker);
  const vandaag = isoDatum(new Date());
  const banners = weekBanners(dagen, plaatsingen);
  const blokken = halfUurBlokken();
  const totaalMinuten = (DAG_EIND_UUR - DAG_START_UUR) * 60;
  const PX_PER_MINUUT = 1.1;
  const rooosterHoogte = totaalMinuten * PX_PER_MINUUT;

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {dagen.map((dag) => {
          const isVandaag = isoDatum(dag) === vandaag;
          return (
            <div
              key={isoDatum(dag)}
              className={`rounded-lg py-1.5 text-xs font-semibold ${isVandaag ? "bg-terra text-terra-foreground" : "text-ink-zwak"}`}
            >
              <span className="block uppercase">{dag.toLocaleDateString("nl-BE", { weekday: "short" })}</span>
              <span className="block text-sm text-ink">{dag.getDate()}</span>
            </div>
          );
        })}
      </div>

      <p className="mb-1 mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-zwak">Thema's deze week</p>
      <div className="mb-3 flex flex-col gap-1.5">
        {banners.length === 0 && <p className="text-xs text-ink-zwak">Geen thema gepland deze week.</p>}
        {banners.map(({ plaatsing, startIdx, eindIdx }) => (
          <div key={plaatsing.id} className="grid grid-cols-7 gap-1">
            <span
              style={{ gridColumnStart: startIdx + 1, gridColumnEnd: eindIdx + 2 }}
              className={`truncate rounded-full px-3 py-1.5 text-left text-xs font-semibold text-white ${themaKleurKlasse(plaatsing.themaId)}`}
            >
              {themaLabel(plaatsing)}
            </span>
          </div>
        ))}
      </div>

      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-zwak">Mijn agenda</p>
      {/* Hourly grid, exactly like dagoverzicht: the uur-labels live in their own narrow column so
          they stay legible, and each day gets its own column for the activiteiten laid over the
          uren — never inside a label, so both stay readable regardless of how many items overlap.
          De dagkolom zelf navigeert nergens meer heen (geen doorklik naar dagplanning); enkel een
          activiteit-kaart zelf is klikbaar, om ze te bekijken/aan te passen. */}
      <div className="flex gap-1">
        <div className="relative w-10 shrink-0" style={{ height: rooosterHoogte }}>
          {blokken
            .filter((b) => !b.half)
            .map((b, i) => (
              <span
                key={i}
                className="absolute left-0 text-[10px] font-semibold text-ink-zwak"
                style={{ top: i * 60 * PX_PER_MINUUT - 6 }}
              >
                {b.label}
              </span>
            ))}
        </div>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {dagen.map((dag) => {
            const agendaItems = agendaItemsOp(dag);
            const isVandaag = isoDatum(dag) === vandaag;
            return (
              <div
                key={isoDatum(dag)}
                className={`relative overflow-hidden rounded-xl border bg-surface ${
                  isVandaag ? "border-terra" : "border-rand"
                }`}
                style={{ height: rooosterHoogte }}
              >
                {blokken.map((b, i) => (
                  <div
                    key={i}
                    className={`absolute left-0 right-0 border-t ${b.half ? "border-rand/30" : "border-rand/60"}`}
                    style={{ top: i * 30 * PX_PER_MINUUT }}
                  />
                ))}
                {agendaItems.map((item) => {
                  const top = minutenSindsStart(item.startUur) * PX_PER_MINUUT;
                  const hoogte = Math.max(minutenSindsStart(item.eindUur) - minutenSindsStart(item.startUur), 16) * PX_PER_MINUUT;
                  const { vlak, tekst } = agendaKleurKlassen(item.kleur);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onKiesItem(item)}
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1 py-0.5 text-left shadow-kaart active:opacity-90 ${vlak}`}
                      style={{ top, height: hoogte }}
                    >
                      <p className={`truncate text-[9px] font-bold leading-tight ${tekst}`}>{item.activiteitNaam}</p>
                      <p className={`truncate text-[8px] leading-tight ${tekst}/80`}>
                        {item.startUur}–{item.eindUur}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DagRooster({
  actievePlaatsingen,
  agendaItems,
  onKiesItem,
  onVerwijder,
  themaLabel,
}: {
  actievePlaatsingen: ThemaplaatsingWeergave[];
  agendaItems: AgendaItem[];
  onKiesItem: (item: AgendaItem) => void;
  onVerwijder: (agendaItemId: string) => void;
  themaLabel: (p: ThemaplaatsingWeergave) => string;
}) {
  const blokken = halfUurBlokken();
  const totaalMinuten = (DAG_EIND_UUR - DAG_START_UUR) * 60;
  const PX_PER_MINUUT = 1.1;
  const roosterHoogte = totaalMinuten * PX_PER_MINUUT;

  return (
    <div>
      {actievePlaatsingen.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {actievePlaatsingen.map((p) => (
            <span
              key={p.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${themaKleurKlasse(p.themaId)}`}
            >
              {themaLabel(p)}
            </span>
          ))}
        </div>
      )}
      {actievePlaatsingen.length === 0 && <p className="mb-3 text-sm text-ink-zwak">Geen thema gepland op deze dag.</p>}

      {/* Uurlabels leven in hun eigen kolom, net als het weekoverzicht — zo kan een activiteit-kaart
          nooit meer over een label heen schuiven en het onleesbaar maken. */}
      <div className="flex gap-1.5">
        <div className="relative w-11 shrink-0" style={{ height: roosterHoogte }}>
          {blokken
            .filter((b) => !b.half)
            .map((b, i) => (
              <span
                key={i}
                className="absolute left-0 text-[10px] font-semibold text-ink-zwak"
                style={{ top: i * 60 * PX_PER_MINUUT - 6 }}
              >
                {b.label}
              </span>
            ))}
        </div>

        <div className="relative flex-1 rounded-2xl border border-rand bg-surface" style={{ height: roosterHoogte }}>
          {blokken.map((b, i) => (
            <div
              key={i}
              className={`absolute left-0 right-0 border-t ${b.half ? "border-rand/40" : "border-rand"}`}
              style={{ top: i * 30 * PX_PER_MINUUT }}
            />
          ))}

          <div className="absolute inset-0 px-1.5">
            {agendaItems.map((item) => {
              const top = minutenSindsStart(item.startUur) * PX_PER_MINUUT;
              const hoogte = Math.max(minutenSindsStart(item.eindUur) - minutenSindsStart(item.startUur), 20) * PX_PER_MINUUT;
              const { vlak, tekst } = agendaKleurKlassen(item.kleur);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onKiesItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onKiesItem(item);
                  }}
                  className={`absolute left-1.5 right-1.5 cursor-pointer overflow-hidden rounded-lg p-1.5 shadow-kaart active:opacity-90 ${vlak}`}
                  style={{ top, height: hoogte }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-bold ${tekst}`}>
                        {item.startUur}–{item.eindUur} · {item.activiteitNaam}
                      </p>
                      {item.themaNaam !== "—" && (
                        <p className={`truncate text-[10px] ${tekst}/80`}>
                          {item.themaNaam} · {item.subthemaNaam}
                        </p>
                      )}
                      {item.beschrijving && <p className={`truncate text-[10px] ${tekst}/80`}>{item.beschrijving}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerwijder(item.id);
                      }}
                      aria-label={`${item.activiteitNaam} verwijderen`}
                      className="shrink-0 text-[11px] font-semibold text-suggestie-geweigerd"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-zwak">
        Enkel zichtbaar op dit toestel — nog niet gedeeld met collega's (de backend heeft nog geen agenda per
        leerkracht).
      </p>
    </div>
  );
}
