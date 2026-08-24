import { useState } from "react";
import { useLeerplandoelen, useLeerplandoelFacetten } from "../../lib/queries";
import type { DomeinFacet, LeerplandoelFilterQuery, LeerplandoelRegel } from "../../lib/types";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Laadlijst, Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonChevron } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * Op.stap's own ordering, as a browse tree: discipline, then domein, then subdomein, then the
 * doelen themselves.
 *
 * Every level asks the facet endpoint for ITS OWN scope. That is the whole design of this file, and
 * it is worth stating why: `/api/leerplandoelen/facetten` answers with a FLAT `domeinen` array
 * scoped by whatever filter it was sent, not a list nested inside `disciplines`. Fetch it once with
 * no discipline and render the result under every discipline, and Muziek appears under Nederlands
 * with a school-wide count. So a discipline only fetches its domeinen once it is opened, which also
 * means the screen opens with one request instead of ten.
 *
 * Subdomeinen come free: they arrive nested in the domein facet that is already scoped.
 */
export function Doelenboom({
  basisFilter,
  gefilterd,
  gekozenCode,
  onKies,
}: {
  basisFilter: LeerplandoelFilterQuery;
  gefilterd: boolean;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const { data, isPending, isError } = useLeerplandoelFacetten(basisFilter);

  if (isPending) return <Laadlijst rijen={7} />;
  if (isError || !data) return null;

  const disciplines = data.disciplines.filter((d) => d.aantal > 0);

  return (
    <ul className="flex flex-col gap-2">
      {disciplines.map((discipline, index) => (
        <li key={discipline.nummer}>
          <Disciplinekaart
            nummer={discipline.nummer}
            naam={discipline.naam ?? discipline.nummer}
            aantal={discipline.aantal}
            basisFilter={basisFilter}
            // While a filter is active the first discipline with hits opens itself, so a search
            // lands on results instead of on a row the teacher has to open by hand.
            standaardOpen={gefilterd && index === 0}
            gefilterd={gefilterd}
            gekozenCode={gekozenCode}
            onKies={onKies}
          />
        </li>
      ))}
    </ul>
  );
}

function Disciplinekaart({
  nummer,
  naam,
  aantal,
  basisFilter,
  standaardOpen,
  gefilterd,
  gekozenCode,
  onKies,
}: {
  nummer: string;
  naam: string;
  aantal: number;
  basisFilter: LeerplandoelFilterQuery;
  standaardOpen: boolean;
  gefilterd: boolean;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const [open, setOpen] = useState(standaardOpen);

  return (
    <div className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={aantal}
        className="px-4 py-3.5"
        naamKlasse="font-display text-sectie text-inkt"
      >
        {naam}
      </Rij>

      {open ? (
        <div className="border-t border-lijn bg-vlak/60 py-1">
          <Domeinen
            discipline={nummer}
            basisFilter={basisFilter}
            gefilterd={gefilterd}
            gekozenCode={gekozenCode}
            onKies={onKies}
          />
        </div>
      ) : null}
    </div>
  );
}

function Domeinen({
  discipline,
  basisFilter,
  gefilterd,
  gekozenCode,
  onKies,
}: {
  discipline: string;
  basisFilter: LeerplandoelFilterQuery;
  gefilterd: boolean;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const { data, isPending } = useLeerplandoelFacetten({ ...basisFilter, discipline });

  if (isPending) {
    return (
      <div className="flex flex-col gap-1.5 px-4 py-2">
        <Laadvlak className="h-9" />
        <Laadvlak className="h-9" />
      </div>
    );
  }

  const domeinen = (data?.domeinen ?? []).filter((d) => d.aantal > 0);
  if (domeinen.length === 0) return null;

  return (
    <ul className="ml-4 flex flex-col border-l border-lijn-sterk pl-1">
      {domeinen.map((domein) => (
        <li key={domein.domein}>
          <Domein
            domein={domein}
            discipline={discipline}
            basisFilter={basisFilter}
            standaardOpen={gefilterd && domeinen.length === 1}
            gefilterd={gefilterd}
            gekozenCode={gekozenCode}
            onKies={onKies}
          />
        </li>
      ))}
    </ul>
  );
}

function Domein({
  domein,
  discipline,
  basisFilter,
  standaardOpen,
  gefilterd,
  gekozenCode,
  onKies,
}: {
  domein: DomeinFacet;
  discipline: string;
  basisFilter: LeerplandoelFilterQuery;
  standaardOpen: boolean;
  gefilterd: boolean;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const [open, setOpen] = useState(standaardOpen);
  const subdomeinen = domein.subdomeinen.filter((s) => s.aantal > 0);

  return (
    <>
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={domein.aantal}
        className="px-3 py-2.5"
        naamKlasse="text-body font-medium text-inkt"
      >
        {domein.domein}
      </Rij>

      {open ? (
        <ul className="ml-3 flex flex-col border-l border-lijn pl-1">
          {subdomeinen.map((sub) => (
            <li key={sub.subdomein}>
              <Subdomein
                subdomein={sub.subdomein}
                aantal={sub.aantal}
                filter={{ ...basisFilter, discipline, domein: domein.domein, subdomein: sub.subdomein }}
                standaardOpen={gefilterd && subdomeinen.length === 1}
                gekozenCode={gekozenCode}
                onKies={onKies}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Subdomein({
  subdomein,
  aantal,
  filter,
  standaardOpen,
  gekozenCode,
  onKies,
}: {
  subdomein: string;
  aantal: number;
  filter: LeerplandoelFilterQuery;
  standaardOpen: boolean;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const [open, setOpen] = useState(standaardOpen);
  // The page size is the subdomein's own count, so an open subdomein always shows all of itself.
  // Subdomeinen are small by construction (they are the leaves of Op.stap's ordering), and the
  // backend caps a page at 200 regardless.
  const { data, isPending } = useLeerplandoelen({ ...filter, aantal: Math.min(aantal, 200) }, { enabled: open });

  return (
    <>
      <Rij
        open={open}
        onToggle={() => setOpen((o) => !o)}
        aantal={aantal}
        className="px-3 py-2"
        naamKlasse="text-meta text-inkt-zacht"
      >
        {subdomein}
      </Rij>

      {open ? (
        <div className="pb-1.5 pl-1 pr-1">
          {isPending ? (
            <Laadlijst rijen={Math.min(aantal, 3)} />
          ) : (
            <ul className="flex flex-col gap-1">
              {(data?.regels ?? []).map((regel) => (
                <li key={regel.code}>
                  <Doelrij regel={regel} gekozen={regel.code === gekozenCode} onKies={onKies} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}

/** The shared shape of the three collapsible levels: name on the left, count and chevron on the right. */
function Rij({
  open,
  onToggle,
  aantal,
  children,
  className,
  naamKlasse,
}: {
  open: boolean;
  onToggle: () => void;
  aantal: number;
  children: string;
  className: string;
  naamKlasse: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center justify-between gap-3 text-left transition-colors duration-150 hover:bg-vlak-diep/60",
        className,
      )}
    >
      <span className={cn("min-w-0 truncate", naamKlasse)}>{children}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="mono text-meta text-inkt-zwak">{aantal}</span>
        <IcoonChevron
          aria-hidden="true"
          className={cn("h-4 w-4 text-inkt-zwak transition-transform duration-200", open && "rotate-180")}
        />
      </span>
    </button>
  );
}

/**
 * One leerplandoel.
 *
 * The code is set in the mono face and the goal text in the body face, so a teacher can tell an
 * identifier from a sentence without reading either. The doelsoort is a colour AND its Op.stap mark.
 */
function Doelrij({
  regel,
  gekozen,
  onKies,
}: {
  regel: LeerplandoelRegel;
  gekozen: boolean;
  onKies: (code: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onKies(regel.code)}
      aria-current={gekozen ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 rounded-veld border-l-2 px-3 py-2.5 text-left transition-colors duration-150",
        gekozen ? "border-inkt bg-vlak-diep" : "border-transparent hover:bg-vlak-diep/60",
      )}
    >
      <Doelsoortmerk soort={regel.doelsoort} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="mono truncate text-[0.6875rem] font-medium text-inkt-zacht">{regel.code}</span>
          <span className="mono shrink-0 rounded border border-lijn px-1 text-[0.625rem] text-inkt-zwak">
            {regel.jaarFase}
          </span>
          {regel.nietMeerInOpstap ? (
            <span className="shrink-0 rounded bg-attentie-zacht px-1.5 text-[0.625rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 line-clamp-2 text-body text-inkt">{regel.tekst}</span>
      </span>
    </button>
  );
}
