import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Segment } from "../../components/ui/Segment";
import { Invoer } from "../../components/ui/Veld";
import { IcoonKnop } from "../../components/ui/Knop";
import { Blad } from "../../components/ui/Blad";
import { Leegte } from "../../components/ui/Leegte";
import { Knop } from "../../components/ui/Knop";
import { knopklassen } from "../../components/ui/knopklassen";
import { cn } from "../../lib/cn";
import { IcoonFilter, IcoonKruis, IcoonZoek } from "../../components/Iconen";
import { useLeerplandoelFacetten, useMinimumdoelFacetten } from "../../lib/queries";
import { useMediaQuery, BREED } from "../../lib/scherm";
import { t, telWoord } from "../../i18n";
import type { LeerplandoelFilterQuery, MinimumdoelFilterQuery } from "../../lib/types";
import { Doelenboom } from "./Doelenboom";
import { Doeldetail } from "./Doeldetail";
import { Bestemmingsblad } from "../koppelen/Bestemmingsblad";
import { Minimumdoelenlijst } from "./Minimumdoelenlijst";
import { Filterblad } from "./Filterblad";
import { useActieveSelectie } from "../../lib/selectie";
import { useDoelenfilter } from "../../state/doelenfilter";
import { Doelsoortbalk } from "./Doelsoortbalk";

/**
 * The curriculum register: Op.stap's leerplandoelen, and the decreed minimumdoelen behind the same
 * search box.
 *
 * One layout decision drives the file. Up to `lg` a chosen doel opens in a sheet, because there is
 * no room to put a list and a detail side by side on a phone without making both cramped. From
 * `lg` the detail is a column that stays open while the teacher keeps browsing, which is the whole
 * reason to have a wide screen. Same component, two presentations, one selection state.
 */
export function DoelenScherm() {
  // Filter, search and view live in a store rather than in this component, because this component
  // unmounts on every navigation and the teacher's narrowing should not. See `state/doelenfilter.ts`.
  const { filter, zoek, bron, faseVanKlas, stelFilter, stelZoek, stelBron, volgKlasFase, wisAlles: wisFilter } =
    useDoelenfilter();
  const [zoekInvoer, setZoekInvoer] = useState(zoek);
  /**
   * THE REGISTER OPENS ON THE SELECTED CLASS'S JAAR/FASE (owner ruling, 2026-08-25).
   *
   * A naslagwerk over 2491 doelen of which 554 apply to the class you have open is a naslagwerk you have to filter
   * before it says anything, and the teacher already told the app which class they are working in. So the filter
   * starts there, and it starts VISIBLE: it counts towards `aantalFilters` and clears with "Alles wissen" like any
   * other, because a preset the teacher cannot see is a preset they will read as missing data.
   *
   * Only when the class has exactly ONE code. A kleutergroep that has not recorded its year answers three, and this
   * dimension is single-select on purpose (its facet list is a count per code); presetting one of the three would be
   * the guess the 2026-08-04 ruling forbids, and presetting none is the honest widest answer.
   */
  const { klas, laadt: selectieLaadt } = useActieveSelectie();
  const eigenFase = (klas?.jaarFasen.length === 1 ? klas.jaarFasen[0] : undefined) ?? null;

  // Applied when the class arrives or changes, not at mount: `useActieveSelectie` resolves its fallback after the
  // klassen query lands, so a `useState` initialiser would run before there is a class to read. Held off entirely
  // while that query is in flight, because a pending klassen list also reads as "no class": acting on it would clear
  // a jaar/fase the teacher chose themselves and then replace it with the class's own, one render later.
  if (!selectieLaadt && eigenFase !== faseVanKlas) {
    volgKlasFase(eigenFase);
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [gekozenCode, setGekozenCode] = useState<string | null>(null);

  /**
   * WHICH SHEET IS SHOWING, and never both.
   *
   * Up to `lg` the doel detail is itself a `Blad`, so the destination sheet cannot be opened from
   * inside it: two bottom sheets stacked, the phone showed two titles and two close buttons, and the
   * destinations were behind the detail. Both sheets live here instead, and the detail closes while
   * the destination sheet is up. Closing that one brings the detail back, because `gekozenCode` is
   * untouched by all of this.
   */
  const [koppelenOpen, setKoppelenOpen] = useState(false);

  const breed = useMediaQuery(BREED);

  // Debounced rather than applied per keystroke: every character would otherwise be a request, and
  // on a phone keyboard that is a request per thumb press.
  useEffect(() => {
    const timer = setTimeout(() => stelZoek(zoekInvoer.trim()), 300);
    return () => clearTimeout(timer);
  }, [zoekInvoer, stelZoek]);

  const doelenFilter = useMemo<LeerplandoelFilterQuery>(
    () => ({ ...filter, zoek: zoek || undefined }),
    [filter, zoek],
  );

  const minimumdoelFilter = useMemo<MinimumdoelFilterQuery>(
    () => ({ zoek: zoek || undefined, domein: filter.domein, subdomein: filter.subdomein, jaarFase: filter.jaarFase }),
    [filter.domein, filter.subdomein, filter.jaarFase, zoek],
  );

  const { data: facetten } = useLeerplandoelFacetten(doelenFilter);
  const { data: minimumdoelFacetten } = useMinimumdoelFacetten(minimumdoelFilter, {
    enabled: bron === "minimumdoelen",
  });

  const aantalFilters = Object.values(filter).filter(Boolean).length;
  const gefilterd = aantalFilters > 0 || zoek.length > 0;

  // Each doel sits in exactly one domein, so the domein counts under the active filter add up to
  // the number of doelen the filter matches.
  const aantalDoelen = facetten?.domeinen.reduce((som, d) => som + d.aantal, 0) ?? 0;
  const aantalMinimumdoelen = minimumdoelFacetten?.domeinen.reduce((som, d) => som + d.aantal, 0) ?? 0;

  const leegRegister = bron === "leerplandoelen" && facetten !== undefined && facetten.totaalAantalDoelen === 0;
  const geenTreffers = bron === "leerplandoelen" && !leegRegister && facetten !== undefined && aantalDoelen === 0;

  function wisAlles() {
    wisFilter();
    setZoekInvoer("");
  }

  const telling =
    bron === "leerplandoelen"
      ? telWoord(aantalDoelen, "doelen.eenDoel", "doelen.aantalDoelen")
      : telWoord(aantalMinimumdoelen, "doelen.eenMinimumdoel", "doelen.aantalMinimumdoelen");

  return (
    <>
      <Schermkop
        titel={t("doelen.titel")}
        rechts={
          <Link to="/inladen" className={cn(knopklassen(), "h-9 min-h-9 px-3 text-meta")}>
            {t("navigatie.inladen")}
          </Link>
        }
        onder={
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IcoonZoek
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-inkt-zwak"
              />
              <Invoer
                type="search"
                value={zoekInvoer}
                onChange={(e) => setZoekInvoer(e.target.value)}
                placeholder={t("doelen.zoeken")}
                aria-label={t("doelen.zoeken")}
                className="pl-10 pr-10"
              />
              {zoekInvoer.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setZoekInvoer("")}
                  aria-label={t("doelen.zoekWissen")}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-inkt-zwak transition-colors hover:bg-vlak-diep hover:text-inkt"
                >
                  <IcoonKruis className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="relative">
              <IcoonKnop
                aria-label={aantalFilters > 0 ? t("doelen.filtersActief", { aantal: aantalFilters }) : t("doelen.filters")}
                onClick={() => setFilterOpen(true)}
              >
                <IcoonFilter className="h-5 w-5" />
              </IcoonKnop>
              {aantalFilters > 0 ? (
                <span
                  aria-hidden="true"
                  className="mono pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-medium text-accent-op"
                >
                  {aantalFilters}
                </span>
              ) : null}
            </div>
          </div>
        }
      />

      <Schermvlak>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segment
            label={t("doelen.toon")}
            waarde={bron}
            onKies={stelBron}
            opties={[
              { waarde: "leerplandoelen", label: t("doelen.leerplandoelen") },
              { waarde: "minimumdoelen", label: t("doelen.minimumdoelen") },
            ]}
          />
          <p aria-live="polite" className="mono text-meta text-inkt-zwak">
            {telling}
          </p>
        </div>

        {/* Only over the leerplandoelen: a minimumdoel has no doelsoort, so under that view the bar
            would be measuring something that does not exist. */}
        {bron === "leerplandoelen" ? (
          <div className="mb-5">
            <Doelsoortbalk
              facetten={facetten}
              actief={filter.doelsoort}
              onKies={(doelsoort) => stelFilter({ ...filter, doelsoort })}
            />
          </div>
        ) : null}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {bron === "leerplandoelen" ? (
              leegRegister ? (
                <Leegte titel={t("doelen.leegTitel")} actie={<p className="text-meta text-inkt-zacht">{t("doelen.leegActie")}</p>} />
              ) : geenTreffers ? (
                <Leegte
                  titel={t("doelen.geenTreffersTitel")}
                  actie={
                    <Knop rang="rustig" onClick={wisAlles}>
                      {t("doelen.geenTreffersActie")}
                    </Knop>
                  }
                />
              ) : (
                <Doelenboom
                  // Remounting on a filter change resets which branches are open, which is what a
                  // teacher expects from a new search. Doing it with a key rather than an effect
                  // keeps the open state where it belongs: inside each level, set once on mount.
                  key={JSON.stringify(doelenFilter)}
                  basisFilter={doelenFilter}
                  gefilterd={gefilterd}
                  gekozenCode={gekozenCode}
                  onKies={setGekozenCode}
                />
              )
            ) : (
              <Minimumdoelenlijst filter={minimumdoelFilter} onKiesDoel={setGekozenCode} />
            )}
          </div>

          {/* The detail column. `top` clears the sticky screen header above it. */}
          <aside className="hidden lg:sticky lg:top-[13.5rem] lg:block">
            <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto rounded-kaart border border-lijn bg-kaart p-5 shadow-licht">
              <Doeldetail code={gekozenCode} onKies={setGekozenCode} onKoppel={() => setKoppelenOpen(true)} />
            </div>
          </aside>
        </div>
      </Schermvlak>

      {/* Up to lg the same detail is a sheet. Mounted only on a narrow screen, so the detail never
          exists twice in the accessibility tree. */}
      {!breed ? (
        <Blad
          open={gekozenCode !== null && !koppelenOpen}
          onOpenChange={(open) => !open && setGekozenCode(null)}
          titel={t("doel.titel")}
        >
          <Doeldetail code={gekozenCode} onKies={setGekozenCode} onKoppel={() => setKoppelenOpen(true)} />
        </Blad>
      ) : null}

      <Bestemmingsblad code={gekozenCode} open={koppelenOpen} onOpenChange={setKoppelenOpen} />

      <Filterblad open={filterOpen} onOpenChange={setFilterOpen} filter={filter} onWijzig={stelFilter} facetten={facetten} />
    </>
  );
}
