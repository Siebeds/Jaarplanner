import { useState } from "react";
import { Link } from "react-router-dom";
import { MINIMUMDOELEN_PAGINA, useMinimumdoelenPaginas, useMinimumdoelFacetten } from "../../lib/queries";
import type { LeergebiedFacet, MinimumdoelFilterQuery, MinimumdoelRegel, RubriekFacet } from "../../lib/types";
import { Knop } from "../../components/ui/Knop";
import { knopklassen } from "../../components/ui/knopklassen";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { cn } from "../../lib/cn";
import { useRechten } from "../../lib/rechten";
import { t, telWoord } from "../../i18n";
import { Rij } from "./Doelenboom";

/**
 * The decreed minimumdoelen in the decree's own ordering, leergebied, rubriek and subrubriek (TB-010), as the same
 * browse tree the leerplandoelen have, so a teacher reads both the same way.
 *
 * Until TB-010 this was a long list grouped by the discipline of the concorded leerplandoelen: a minimumdoel taught in
 * two subdomeinen stood there twice, and one no loaded goal concords had a group of its own. The decree's ordering is
 * the minimumdoel's own, so each one has exactly one place, and the link to the leerplandoelen is summarised per row
 * and laid out per jaar/fase in the detail.
 *
 * The facet endpoint answers with the whole tree and its counts at once (about a thousand minimumdoelen in some hundred
 * branches), so the only requests after it are the leaves of a branch that opens.
 *
 * **Four empty states, never collapsed** (the E1-16 lesson): nothing stored, nothing matching the filter, a failed read,
 * and minimumdoelen whose ordering is not known, which get a group of their own last with one sentence that says
 * exactly what its condition proves.
 */
export function Minimumdoelenboom({
  filter,
  gekozenRef,
  onKies,
  onWisFilters,
}: {
  filter: MinimumdoelFilterQuery;
  gekozenRef: string | null;
  onKies: (ref: string) => void;
  onWisFilters: () => void;
}) {
  const { data, isPending, isError } = useMinimumdoelFacetten(filter);
  const { mag } = useRechten();

  if (isPending) return <Laadlijst rijen={7} />;
  if (isError) return <Leegte titel={t("doelen.foutTitel")} />;

  if (data.totaalAantalMinimumdoelen === 0) {
    return <Leegte titel={t("doelen.geenMinimumdoelenTitel")} actie={mag.curriculumbeheer ? <Laadlink /> : undefined} />;
  }

  if (data.aantalTreffers === 0) {
    return (
      <Leegte
        titel={t("doelen.geenMinimumdoelTreffersTitel")}
        actie={
          <Knop rang="rustig" onClick={onWisFilters}>
            {t("doelen.geenTreffersActie")}
          </Knop>
        }
      />
    );
  }

  const gedeeld = { gekozenRef, onKies };

  return (
    <ul className="flex flex-col gap-2">
      {data.leergebieden.map((leergebied) => (
        <li key={leergebied.naam}>
          <Leergebiedkaart
            leergebied={leergebied}
            filter={filter}
            {...gedeeld}
          />
        </li>
      ))}
      {data.aantalZonderOrdening > 0 ? (
        <li>
          <ZonderOrdening
            aantal={data.aantalZonderOrdening}
            filter={filter}
            {...gedeeld}
          />
        </li>
      ) : null}
    </ul>
  );
}

interface Gedeeld {
  gekozenRef: string | null;
  onKies: (ref: string) => void;
}

function Leergebiedkaart({
  leergebied,
  filter,
  ...gedeeld
}: Gedeeld & { leergebied: LeergebiedFacet; filter: MinimumdoelFilterQuery }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={leergebied.aantal}
        className="px-4 py-3.5"
        naamKlasse="font-display text-sectie text-inkt"
      >
        {leergebied.naam}
      </Rij>

      {open ? (
        <div className="border-t border-lijn bg-vlak/60 py-1">
          <ul className="ml-4 flex flex-col border-l border-lijn-sterk pl-1">
            {leergebied.rubrieken.map((rubriek) => (
              <li key={rubriek.naam}>
                <Rubriek
                  rubriek={rubriek}
                  filter={{ ...filter, leergebied: leergebied.naam, rubriek: rubriek.naam }}
                  {...gedeeld}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Rubriek({
  rubriek,
  filter,
  ...gedeeld
}: Gedeeld & { rubriek: RubriekFacet; filter: MinimumdoelFilterQuery }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={rubriek.aantal}
        className="px-3 py-2.5"
        naamKlasse="text-body font-medium text-inkt"
      >
        {rubriek.naam}
      </Rij>

      {open ? (
        <div className="ml-3 flex flex-col border-l border-lijn pl-1">
          {/* A rubriek the decree gives no third level holds its minimumdoelen directly. */}
          {rubriek.aantalZonderSubrubriek > 0 ? (
            <div className="pb-1.5 pl-1 pr-1">
              <Bladeren filter={{ ...filter, zonderSubrubriek: true }} aantal={rubriek.aantalZonderSubrubriek} {...gedeeld} />
            </div>
          ) : null}
          <ul className="flex flex-col">
            {rubriek.subrubrieken.map((sub) => (
              <li key={sub.naam}>
                <Subrubriek
                  naam={sub.naam}
                  aantal={sub.aantal}
                  filter={{ ...filter, subrubriek: sub.naam }}
                  {...gedeeld}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Subrubriek({
  naam,
  aantal,
  filter,
  ...gedeeld
}: Gedeeld & { naam: string; aantal: number; filter: MinimumdoelFilterQuery }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={aantal}
        className="px-3 py-2"
        naamKlasse="text-meta text-inkt-zacht"
      >
        {naam}
      </Rij>
      {open ? (
        <div className="pb-1.5 pl-1 pr-1">
          <Bladeren filter={filter} aantal={aantal} {...gedeeld} />
        </div>
      ) : null}
    </>
  );
}

/**
 * The minimumdoelen whose place in the decree's ordering is not known. The sentence says what that condition proves and
 * what changes it; it does not guess which of the two causes applies (an import from before TB-010, or a path Op.stap
 * did not deliver in a usable shape).
 */
function ZonderOrdening({
  aantal,
  filter,
  ...gedeeld
}: Gedeeld & { aantal: number; filter: MinimumdoelFilterQuery }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={aantal}
        className="px-4 py-3.5"
        naamKlasse="font-display text-sectie text-inkt"
      >
        {t("doelen.zonderOrdening")}
      </Rij>
      {open ? (
        <div className="border-t border-lijn bg-vlak/60 px-2 pb-1.5 pt-2.5">
          <p className="mb-2 max-w-[60ch] px-2 text-meta text-inkt-zacht">
            {aantal === 1 ? t("doelen.zonderOrdeningEen") : t("doelen.zonderOrdeningMeer")}
          </p>
          <Bladeren filter={{ ...filter, zonderOrdening: true }} aantal={aantal} {...gedeeld} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The minimumdoelen of one branch, fetched when it opens. A page at a time: a branch of the decree is small, but the
 * group without an ordering holds every minimumdoel between the migration and the next import, and the server caps a
 * page at 200.
 */
function Bladeren({
  filter,
  aantal,
  gekozenRef,
  onKies,
}: Gedeeld & { filter: MinimumdoelFilterQuery; aantal: number }) {
  const lijst = useMinimumdoelenPaginas(filter);

  if (lijst.isPending) return <Laadlijst rijen={Math.min(aantal, 3)} />;
  if (lijst.isError) return <p className="px-3 py-2 text-meta text-inkt-zacht">{t("doelen.foutTitel")}</p>;

  const regels = lijst.data.pages.flatMap((pagina) => pagina.regels);
  const rest = lijst.data.pages[lijst.data.pages.length - 1].totaal - regels.length;

  return (
    <>
      <ul className="flex flex-col gap-1">
        {regels.map((regel) => (
          <li key={regel.ref}>
            <Minimumdoelrij regel={regel} gekozen={regel.ref === gekozenRef} onKies={onKies} />
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <div className="mt-2 flex justify-center">
          <Knop rang="rustig" disabled={lijst.isFetchingNextPage} onClick={() => void lijst.fetchNextPage()}>
            {lijst.isFetchingNextPage
              ? t("algemeen.bezig")
              : t("doelen.nogTonen", { aantal: Math.min(rest, MINIMUMDOELEN_PAGINA) })}
          </Knop>
        </div>
      ) : null}
    </>
  );
}

/**
 * One minimumdoel: its ref in the MD hue (Art. XII), the doelzin, and in the mono face how many leerplandoelen work it
 * out and over which years. The decree's list items stay for the detail; the row is for finding, not for reading.
 */
function Minimumdoelrij({
  regel,
  gekozen,
  onKies,
}: {
  regel: MinimumdoelRegel;
  gekozen: boolean;
  onKies: (ref: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onKies(regel.ref)}
      aria-current={gekozen ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 rounded-veld border-l-2 px-3 py-2.5 text-left transition-colors duration-150",
        gekozen ? "border-accent bg-accent-zacht" : "border-transparent hover:bg-vlak-diep/60",
      )}
    >
      <span className="mono mt-0.5 h-fit shrink-0 rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.625rem] font-medium text-doelsoort-md-op">
        {regel.ref}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-body text-inkt">{regel.omschrijving.split("\n")[0]}</span>
        <span className="mono mt-1 block text-[0.6875rem] text-inkt-zacht">{samenvatting(regel)}</span>
      </span>
    </button>
  );
}

/**
 * "16 ingeladen leerplandoelen · L1, L2, L3, L4": the count and every jaar/fase that holds one, in the server's order. Listed
 * rather than spanned: "K3–L5" would claim the years between, and the row knows only the years it lists (the E5-03
 * rule). Without a concorded goal it says only that, never that something is missing (the E1-22 guard).
 */
function samenvatting(regel: MinimumdoelRegel): string {
  if (regel.aantalLeerplandoelen === 0 || regel.jaarFasen.length === 0) return t("doelen.geenLeerplandoel");
  const aantal = telWoord(regel.aantalLeerplandoelen, "doelen.eenLeerplandoel", "doelen.aantalLeerplandoelen");
  return `${aantal} · ${regel.jaarFasen.join(", ")}`;
}

/**
 * Where the curriculum is loaded: the Op.stap tab of Inladen. A link, not a button, because it navigates. Shared with the
 * leerplandoelen register's empty state, whose old text ("Importeer eerst de Op.stap-bestanden") E1-21 made false.
 *
 * **Only for whoever may load Op.stap** (E6-02, closing the E1-22 carry-forward): `mag.curriculumbeheer`, directie. Its
 * words say "load them", and themabeheer loads the school's thema's, not the goals, so for anyone else it would be a
 * link to something they cannot do (the E3-06 rule). Each caller asks; this component does not, so a caller that
 * forgets shows a link rather than a silent hole in its layout. It opens the Op.stap section, not the first one.
 */
export function Laadlink() {
  return (
    <Link to="/inladen?bron=opstap" className={cn(knopklassen(), "h-9 min-h-9 px-3 text-meta")}>
      {t("doelen.laadIn")}
    </Link>
  );
}
