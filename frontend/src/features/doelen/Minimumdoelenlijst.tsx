import { Link } from "react-router-dom";
import { MINIMUMDOELEN_PAGINA, useMinimumdoelenPaginas, useMinimumdoelFacetten } from "../../lib/queries";
import type { MinimumdoelFilterQuery, MinimumdoelRegel } from "../../lib/types";
import { Knop } from "../../components/ui/Knop";
import { knopklassen } from "../../components/ui/knopklassen";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { cn } from "../../lib/cn";
import { t } from "../../i18n";

/**
 * The decreed minimumdoelen, grouped by the discipline of the leerplandoelen they are concorded to.
 *
 * A minimumdoel has no discipline of its own (Art. VII.0), so the same ref can appear under more
 * than one heading. That is the concordance being honest rather than a duplicate: the backend
 * returns one row per (minimumdoel, bucket), and forcing them into a single heading would hide that
 * a government target is taught in two subjects.
 *
 * The concorded leerplandoel codes travel with each row, so a teacher can jump from an inspection
 * level target to the goals that actually cover it.
 *
 * **A minimumdoel no loaded leerplandoel concords has a group of its own, last** (E1-22). Right after the minimumdoelen
 * import that is all 998 of them, and after the G goals six (ADR-0032 decision 5). It gets no discipline heading,
 * because it has none to borrow, and one sentence that says exactly what its render condition proves: no loaded goal
 * refers to it. Never that something is missing or uncovered, because the teachers did not leave it out: Op.stap's G
 * goals do not reach it, or its discipline is not loaded yet.
 *
 * **Three empty states, never collapsed** (the E1-16 lesson): nothing stored, nothing matching the filter, and a failed
 * read. The first used to say the minimumdoelen "come from the decretale bestand", which E1-12 made false, and it was
 * shown whenever the inner join found no concorded goal, so it said "Nog geen minimumdoelen" with 998 of them stored.
 */
export function Minimumdoelenlijst({
  filter,
  onKiesDoel,
  onWisFilters,
}: {
  filter: MinimumdoelFilterQuery;
  onKiesDoel: (code: string) => void;
  onWisFilters: () => void;
}) {
  const facetten = useMinimumdoelFacetten(filter);
  const lijst = useMinimumdoelenPaginas(filter);

  if (facetten.isPending || lijst.isPending) return <Laadlijst rijen={6} />;
  if (facetten.isError || lijst.isError) return <Leegte titel={t("doelen.foutTitel")} />;

  if (facetten.data.totaalAantalMinimumdoelen === 0) {
    return <Leegte titel={t("doelen.geenMinimumdoelenTitel")} actie={<Laadlink />} />;
  }

  const regels = lijst.data.pages.flatMap((pagina) => pagina.regels);
  if (regels.length === 0) {
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

  const totaal = lijst.data.pages[lijst.data.pages.length - 1].totaal;
  const rest = totaal - regels.length;
  const groepen = groepeerPerDiscipline(regels);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {groepen.map((groep) => {
          const zonder = groep.nummer === null;
          // The heading counts every row of the group, loaded or not, from the facets: the list arrives a page at a time.
          const aantal = zonder
            ? facetten.data.aantalZonderLeerplandoel
            : (facetten.data.disciplines.find((d) => d.nummer === groep.nummer)?.aantal ?? groep.rijen.length);

          return (
            <li key={groep.nummer ?? ""} className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
              <h2 className="flex items-center justify-between gap-3 border-b border-lijn px-4 py-3">
                <span className="font-display text-sectie text-inkt">
                  {zonder ? t("doelen.zonderLeerplandoel") : groep.naam}
                </span>
                <span className="mono text-meta text-inkt-zwak">{aantal}</span>
              </h2>
              {zonder ? (
                <p className="border-b border-lijn px-4 py-2.5 text-meta text-inkt-zacht">
                  {aantal === 1 ? t("doelen.zonderLeerplandoelEen") : t("doelen.zonderLeerplandoelMeer")}
                </p>
              ) : null}
              <ul className="divide-y divide-lijn">
                {groep.rijen.map((regel) => (
                  <li key={`${regel.ref}-${regel.domein ?? ""}-${regel.subdomein ?? ""}`} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="mono rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.625rem] font-medium text-doelsoort-md-op">
                        {regel.ref}
                      </span>
                      {regel.domein ? (
                        <span className="truncate text-meta text-inkt-zwak">
                          {regel.domein} / {regel.subdomein}
                        </span>
                      ) : null}
                    </div>
                    {/* The decreed text lists its items on lines of their own ("\n- "): keep them there. */}
                    <p className="mt-1.5 whitespace-pre-line text-body text-inkt">{regel.omschrijving}</p>
                    {regel.leerplandoelCodes.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {regel.leerplandoelCodes.map((code) => (
                          <li key={code}>
                            <button
                              type="button"
                              onClick={() => onKiesDoel(code)}
                              className="mono rounded border border-lijn px-1.5 py-0.5 text-[0.625rem] text-inkt-zacht transition-colors duration-150 hover:border-lijn-sterk hover:text-inkt"
                            >
                              {code}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {rest > 0 ? (
        <div className="mt-3 flex justify-center">
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
 * Where the curriculum is loaded: the Op.stap tab of Inladen. A link, not a button, because it navigates. Shared with the
 * leerplandoelen register's empty state, whose old text ("Importeer eerst de Op.stap-bestanden") E1-21 made false.
 */
export function Laadlink() {
  return (
    <Link to="/inladen" className={cn(knopklassen(), "h-9 min-h-9 px-3 text-meta")}>
      {t("doelen.laadIn")}
    </Link>
  );
}

interface Groep {
  /** Null for the minimumdoelen no loaded leerplandoel concords. */
  nummer: string | null;
  naam: string;
  rijen: MinimumdoelRegel[];
}

/** Groups in first-seen order, which is the order the backend already sorted them in: disciplines, then the rest. */
function groepeerPerDiscipline(regels: MinimumdoelRegel[]): Groep[] {
  const groepen = new Map<string, Groep>();
  for (const regel of regels) {
    const sleutel = regel.disciplineNummer ?? "";
    let groep = groepen.get(sleutel);
    if (!groep) {
      groep = { nummer: regel.disciplineNummer, naam: regel.disciplineNaam ?? regel.disciplineNummer ?? "", rijen: [] };
      groepen.set(sleutel, groep);
    }
    groep.rijen.push(regel);
  }
  return [...groepen.values()];
}
