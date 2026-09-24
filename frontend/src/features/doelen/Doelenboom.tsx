import { useState } from "react";
import { useLeerplandoelen, useLeerplandoelFacetten } from "../../lib/queries";
import type { DomeinFacet, LeerplandoelFilterQuery, LeerplandoelRegel } from "../../lib/types";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Laadlijst, Laadvlak } from "../../components/ui/Laadvlak";
import { Inklapper } from "../../components/ui/Inklapper";
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
 * Every level starts closed, whatever the filter or search (FB-041): the teacher opens what she wants to see.
 *
 * Subdomeinen come free: they arrive nested in the domein facet that is already scoped.
 */
export function Doelenboom({
  basisFilter,
  gekozenCode,
  onKies,
}: {
  basisFilter: LeerplandoelFilterQuery;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const { data, isPending, isError } = useLeerplandoelFacetten(basisFilter);

  if (isPending) return <Laadlijst rijen={7} />;
  if (isError || !data) return null;

  const disciplines = data.disciplines.filter((d) => d.aantal > 0);

  return (
    <ul className="flex flex-col gap-2">
      {disciplines.map((discipline) => (
        <li key={discipline.nummer}>
          <Disciplinekaart
            nummer={discipline.nummer}
            naam={discipline.naam ?? discipline.nummer}
            aantal={discipline.aantal}
            basisFilter={basisFilter}
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
  gekozenCode,
  onKies,
}: {
  nummer: string;
  naam: string;
  aantal: number;
  basisFilter: LeerplandoelFilterQuery;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  return (
    <Inklapper.Root>
      <div className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
        <Rij
          aantal={aantal}
          className="px-4 py-3.5"
          naamKlasse="font-display text-sectie text-inkt"
        >
          {naam}
        </Rij>

        <Inklapper.Inhoud className="border-t border-lijn bg-vlak/60 py-1">
          <Domeinen
            discipline={nummer}
            basisFilter={basisFilter}
            gekozenCode={gekozenCode}
            onKies={onKies}
          />
        </Inklapper.Inhoud>
      </div>
    </Inklapper.Root>
  );
}

function Domeinen({
  discipline,
  basisFilter,
  gekozenCode,
  onKies,
}: {
  discipline: string;
  basisFilter: LeerplandoelFilterQuery;
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
  gekozenCode,
  onKies,
}: {
  domein: DomeinFacet;
  discipline: string;
  basisFilter: LeerplandoelFilterQuery;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const subdomeinen = domein.subdomeinen.filter((s) => s.aantal > 0);

  return (
    <Inklapper.Root>
      <Rij
        aantal={domein.aantal}
        className="px-3 py-2.5"
        naamKlasse="text-body font-medium text-inkt"
      >
        {domein.domein}
      </Rij>

      <Inklapper.Inhoud als="ul" className="ml-3 flex flex-col border-l border-lijn pl-1">
        {subdomeinen.map((sub) => (
          <li key={sub.subdomein}>
            <Subdomein
              subdomein={sub.subdomein}
              aantal={sub.aantal}
              filter={{ ...basisFilter, discipline, domein: domein.domein, subdomein: sub.subdomein }}
              gekozenCode={gekozenCode}
              onKies={onKies}
            />
          </li>
        ))}
      </Inklapper.Inhoud>
    </Inklapper.Root>
  );
}

function Subdomein({
  subdomein,
  aantal,
  filter,
  gekozenCode,
  onKies,
}: {
  subdomein: string;
  aantal: number;
  filter: LeerplandoelFilterQuery;
  gekozenCode: string | null;
  onKies: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The page size is the subdomein's own count, so an open subdomein always shows all of itself.
  // Subdomeinen are small by construction (they are the leaves of Op.stap's ordering), and the
  // backend caps a page at 200 regardless.
  const { data, isPending } = useLeerplandoelen({ ...filter, aantal: Math.min(aantal, 200) }, { enabled: open });

  return (
    <Inklapper.Root open={open} onOpenChange={setOpen}>
      <Rij
        aantal={aantal}
        className="px-3 py-2"
        naamKlasse="text-meta text-inkt-zacht"
      >
        {subdomein}
      </Rij>

      <Inklapper.Inhoud className="pb-1.5 pl-1 pr-1">
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
      </Inklapper.Inhoud>
    </Inklapper.Root>
  );
}

/**
 * The shared shape of the three collapsible levels: name on the left, count and chevron on the right. Exported for the
 * minimumdoelen tree (TB-010), so the two registers open and read the same way.
 */
export function Rij({
  aantal,
  children,
  className,
  naamKlasse,
}: {
  aantal: number;
  children: string;
  className: string;
  naamKlasse: string;
}) {
  return (
    <Inklapper.Knop
      className={cn(
        "flex w-full items-center justify-between gap-3 text-left transition-colors duration-150 hover:bg-vlak-diep/60",
        className,
      )}
    >
      <span className={cn("min-w-0 truncate", naamKlasse)}>{children}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="mono text-meta text-inkt-zwak">{aantal}</span>
        <Inklapper.Pijl className="h-4 w-4 text-inkt-zwak" />
      </span>
    </Inklapper.Knop>
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
        gekozen ? "border-accent bg-accent-zacht" : "border-transparent hover:bg-vlak-diep/60",
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
