import { useEffect, useState } from "react";
import { useMinimumdoelen } from "../../lib/queries";
import { Spinner } from "../../components/ui/Spinner";
import type { DisciplineFacet, DomeinFacet, MinimumdoelFacetten, MinimumdoelFilterQuery, SubdomeinFacet } from "../../lib/types";

/**
 * Same Discipline → Domein → Subdomein tree as `DoelenHierarchie`, but for de wettelijke
 * minimumdoelen zelf (het decreet) in plaats van de leerplandoelen die ze concorderen. Eén
 * minimumdoel bestaat uit meerdere leerplandoelen — vandaar `concordanteLeerplandoelCodes` per
 * regel, zodat een leerkracht meteen ziet welke leerplandoelen (op de andere schakelstand van
 * deze pagina) eraan bijdragen.
 */
export function MinimumdoelenHierarchie({
  facetten,
  filter,
  autoOpen,
}: {
  facetten: MinimumdoelFacetten;
  filter: MinimumdoelFilterQuery;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState<string | null>(facetten.disciplines[0]?.nummer ?? null);

  useEffect(() => {
    if (autoOpen) setOpen(facetten.disciplines[0]?.nummer ?? null);
  }, [autoOpen, facetten.disciplines]);

  return (
    <div className="flex flex-col gap-2">
      {facetten.disciplines.map((discipline: DisciplineFacet) => (
        <div key={discipline.nummer} className="overflow-hidden rounded-2xl border border-rand bg-surface">
          <button
            onClick={() => setOpen((o) => (o === discipline.nummer ? null : discipline.nummer))}
            className="flex w-full items-center justify-between gap-2 p-3 text-left"
          >
            <span className="font-bold text-ink">{discipline.naam ?? discipline.nummer}</span>
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-zwak">
              {discipline.aantal} doelen
              <Chevron open={open === discipline.nummer} />
            </span>
          </button>
          {open === discipline.nummer && (
            <div className="border-t border-rand bg-surface-verhoogd/40 px-2 pb-2 pt-1">
              {facetten.domeinen.map((domein: DomeinFacet) => (
                <DomeinGroep key={domein.domein} domein={domein} filter={filter} autoOpen={autoOpen} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DomeinGroep({ domein, filter, autoOpen }: { domein: DomeinFacet; filter: MinimumdoelFilterQuery; autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-rand bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 p-2.5 text-left">
        <span className="text-sm font-bold text-ink">{domein.domein}</span>
        <span className="flex items-center gap-2 text-[11px] font-semibold text-ink-zwak">
          {domein.aantal}
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="border-t border-rand px-2 pb-2 pt-1">
          {domein.subdomeinen.map((subdomein) => (
            <SubdomeinGroep key={subdomein.subdomein} domein={domein.domein} subdomein={subdomein} filter={filter} autoOpen={autoOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubdomeinGroep({
  domein,
  subdomein,
  filter,
  autoOpen,
}: {
  domein: string;
  subdomein: SubdomeinFacet;
  filter: MinimumdoelFilterQuery;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const { data, isLoading } = useMinimumdoelen(
    { ...filter, domein, subdomein: subdomein.subdomein, overslaan: 0, aantal: 100 },
    { enabled: open },
  );

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left active:bg-terra-zacht"
      >
        <span className="text-sm font-semibold text-ink-zacht">{subdomein.subdomein}</span>
        <span className="flex items-center gap-2 text-[11px] font-semibold text-ink-zwak">
          {subdomein.aantal}
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 py-1.5">
          {isLoading && <Spinner label="Minimumdoelen laden…" />}
          {data?.regels.map((doel) => (
            <div key={doel.ref} className="flex items-start gap-2.5 rounded-xl border border-rand bg-surface p-2.5">
              <span className="rounded-full bg-doelsoort-md/10 px-1.5 py-0.5 text-[10px] font-semibold text-doelsoort-md">
                🎯 {doel.leeftijd} · nr {doel.nr}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{doel.omschrijving}</p>
                {doel.leerplandoelCodes.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold text-ink-zwak">
                    Leerplandoelen:
                    {doel.leerplandoelCodes.map((code) => (
                      <span key={code} className="rounded-full bg-surface-verhoogd px-1.5 py-0.5 font-mono">
                        {code}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 shrink-0 fill-current transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
