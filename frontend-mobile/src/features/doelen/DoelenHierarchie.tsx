import { useEffect, useState } from "react";
import { useLeerplandoelen } from "../../lib/queries";
import { DoelsoortBadge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import type { DisciplineFacet, DomeinFacet, LeerplandoelFacetten, LeerplandoelFilterQuery, SubdomeinFacet } from "../../lib/types";

/**
 * The Discipline → Domein → Subdomein hiërarchie, exactly like Op.stap itself. Only the facet tree
 * (cheap, aggregate) loads up front; a subdomein's actual doelen load lazily on expand. `facetten`
 * is already computed WITH the active filter/search (see DoelenListPage), so the tree itself prunes
 * to matching branches automatically — filtering never breaks the discipline/domein/subdomein
 * structure, it just narrows which parts of it have anything in them. When a filter/search is
 * active every branch auto-expands, so the teacher sees results immediately instead of having to
 * re-open three levels by hand.
 */
export function DoelenHierarchie({
  facetten,
  filter,
  autoOpen,
  onSelect,
}: {
  facetten: LeerplandoelFacetten;
  filter: LeerplandoelFilterQuery;
  autoOpen: boolean;
  onSelect: (code: string) => void;
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
                <DomeinGroep key={domein.domein} domein={domein} filter={filter} autoOpen={autoOpen} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DomeinGroep({
  domein,
  filter,
  autoOpen,
  onSelect,
}: {
  domein: DomeinFacet;
  filter: LeerplandoelFilterQuery;
  autoOpen: boolean;
  onSelect: (code: string) => void;
}) {
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
            <SubdomeinGroep
              key={subdomein.subdomein}
              domein={domein.domein}
              subdomein={subdomein}
              filter={filter}
              autoOpen={autoOpen}
              onSelect={onSelect}
            />
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
  onSelect,
}: {
  domein: string;
  subdomein: SubdomeinFacet;
  filter: LeerplandoelFilterQuery;
  autoOpen: boolean;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const { data, isLoading } = useLeerplandoelen(
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
          {isLoading && <Spinner label="Doelen laden…" />}
          {data?.regels.map((doel) => (
            <button
              key={doel.code}
              onClick={() => onSelect(doel.code)}
              className="flex items-start gap-2.5 rounded-xl border border-rand bg-surface p-2.5 text-left active:bg-terra-zacht"
            >
              <DoelsoortBadge doelsoort={doel.doelsoort} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold text-ink-zacht">{doel.code}</span>
                  <span className="rounded-full bg-surface-verhoogd px-1.5 py-0.5 text-[10px] font-semibold text-ink-zacht">
                    {doel.jaarFase}
                  </span>
                  {doel.minimumdoelRef && (
                    <span
                      title={`Gekoppeld aan minimumdoel ${doel.minimumdoelRef}`}
                      className="rounded-full bg-doelsoort-md/10 px-1.5 py-0.5 text-[10px] font-semibold text-doelsoort-md"
                    >
                      🎯 MD {doel.minimumdoelRef}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink">{doel.tekst}</p>
              </div>
            </button>
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
