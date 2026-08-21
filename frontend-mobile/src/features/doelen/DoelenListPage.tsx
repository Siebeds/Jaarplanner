import { useMemo, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { useLeerplandoelFacetten, useMinimumdoelFacetten } from "../../lib/queries";
import type { LeerplandoelFilterQuery } from "../../lib/types";
import { DOELSOORT_LABEL } from "../../lib/types";
import { EmptyState } from "../../components/ui/EmptyState";
import { Sheet } from "../../components/ui/Sheet";
import { Field, Select, TextInput } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { IconFilter, IconSearch } from "../../components/Icons";
import { DoelenHierarchie } from "./DoelenHierarchie";
import { MinimumdoelenHierarchie } from "./MinimumdoelenHierarchie";
import { DoelDetailPanel } from "./DoelDetailPanel";
import { AiKoppelWizard } from "./AiKoppelWizard";

export function DoelenListPage() {
  const [zoekInvoer, setZoekInvoer] = useState("");
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState<Omit<LeerplandoelFilterQuery, "zoek" | "overslaan" | "aantal">>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [geselecteerdeCode, setGeselecteerdeCode] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [toonMinimumdoelen, setToonMinimumdoelen] = useState(false);

  const actieveFacetFilter = useMemo<LeerplandoelFilterQuery>(() => ({ ...filter, zoek: zoek || undefined }), [filter, zoek]);
  const minimumdoelFilter = useMemo(
    () => ({ zoek: zoek || undefined, domein: filter.domein, subdomein: filter.subdomein, jaarFase: filter.jaarFase }),
    [filter.domein, filter.subdomein, filter.jaarFase, zoek],
  );

  const aantalActieveFilters = Object.values(filter).filter(Boolean).length;
  const heeftActieveFilter = aantalActieveFilters > 0 || zoek.length > 0;

  const { data: facetten, isLoading, isError } = useLeerplandoelFacetten(actieveFacetFilter);
  const { data: minimumdoelFacetten, isLoading: minimumdoelenLaden, isError: minimumdoelenError } = useMinimumdoelFacetten(
    minimumdoelFilter,
  );
  const aantalOnderFilter = facetten?.domeinen.reduce((som, d) => som + d.aantal, 0) ?? 0;
  const aantalMinimumdoelenOnderFilter = minimumdoelFacetten?.domeinen.reduce((som, d) => som + d.aantal, 0) ?? 0;

  function pasZoekToe() {
    setZoek(zoekInvoer.trim());
  }

  return (
    <div>
      <TopBar title="Doelen" />
      <div className="px-4">
        <form
          className="mb-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            pasZoekToe();
          }}
        >
          <div className="relative flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-zwak" />
            <TextInput
              value={zoekInvoer}
              onChange={(e) => setZoekInvoer(e.target.value)}
              placeholder="Zoek op code of tekst…"
              className="pl-9"
              aria-label="Zoek leerplandoelen"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label="Filters"
            className="relative flex h-touch w-touch items-center justify-center rounded-xl border border-rand bg-surface text-ink active:bg-terra-zacht"
          >
            <IconFilter className="h-5 w-5" />
            {aantalActieveFilters > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-terra text-[10px] font-bold text-terra-foreground">
                {aantalActieveFilters}
              </span>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setToonMinimumdoelen((t) => !t)}
          className="mb-3 text-xs font-semibold text-terra underline underline-offset-2"
        >
          {toonMinimumdoelen ? "Bekijk leerplandoelen (Op.stap)" : "Bekijk minimumdoelen"}
        </button>

        {!toonMinimumdoelen && (
          <button
            onClick={() => setWizardOpen(true)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-terra/30 bg-terra-zacht/60 p-3 text-sm font-semibold text-terra active:bg-terra-zacht"
          >
            ✨ AI doelen laten koppelen aan thema's
          </button>
        )}

        {!toonMinimumdoelen && facetten && facetten.totaalAantalDoelen === 0 && (
          <EmptyState
            titel="Nog geen leerplandoelen geladen"
            beschrijving="Een beheerder moet eerst de Op.stap leerplandoelen importeren voor je hier iets ziet."
          />
        )}

        {!toonMinimumdoelen && isLoading && <p className="py-6 text-center text-sm text-ink-zwak">Doelen laden…</p>}
        {!toonMinimumdoelen && isError && (
          <EmptyState titel="Kon de doelen niet laden" beschrijving="Controleer of de backend draait." />
        )}

        {!toonMinimumdoelen && facetten && facetten.totaalAantalDoelen > 0 && aantalOnderFilter > 0 && (
          <DoelenHierarchie
            facetten={facetten}
            filter={actieveFacetFilter}
            autoOpen={heeftActieveFilter}
            onSelect={setGeselecteerdeCode}
          />
        )}

        {!toonMinimumdoelen && facetten && facetten.totaalAantalDoelen > 0 && heeftActieveFilter && aantalOnderFilter === 0 && (
          <EmptyState
            titel="Geen doelen voor deze filters"
            beschrijving="Probeer een andere zoekterm of wis een filter."
            actie={
              <Button
                variant="geest"
                onClick={() => {
                  setFilter({});
                  setZoek("");
                  setZoekInvoer("");
                }}
              >
                Filters wissen
              </Button>
            }
          />
        )}

        {toonMinimumdoelen && minimumdoelenLaden && <p className="py-6 text-center text-sm text-ink-zwak">Minimumdoelen laden…</p>}
        {toonMinimumdoelen && minimumdoelenError && (
          <EmptyState titel="Kon de minimumdoelen niet laden" beschrijving="Controleer of de backend draait." />
        )}
        {toonMinimumdoelen && minimumdoelFacetten && minimumdoelFacetten.totaalAantalMinimumdoelen === 0 && (
          <EmptyState
            titel="Nog geen minimumdoelen geladen"
            beschrijving="Een beheerder moet eerst de Op.stap leerplandoelen importeren voor je hier iets ziet."
          />
        )}
        {toonMinimumdoelen && minimumdoelFacetten && minimumdoelFacetten.totaalAantalMinimumdoelen > 0 && aantalMinimumdoelenOnderFilter > 0 && (
          <MinimumdoelenHierarchie facetten={minimumdoelFacetten} filter={minimumdoelFilter} autoOpen={heeftActieveFilter} />
        )}
        {toonMinimumdoelen &&
          minimumdoelFacetten &&
          minimumdoelFacetten.totaalAantalMinimumdoelen > 0 &&
          heeftActieveFilter &&
          aantalMinimumdoelenOnderFilter === 0 && (
            <EmptyState
              titel="Geen minimumdoelen voor deze filters"
              beschrijving="Probeer een andere zoekterm of wis een filter."
              actie={
                <Button
                  variant="geest"
                  onClick={() => {
                    setFilter({});
                    setZoek("");
                    setZoekInvoer("");
                  }}
                >
                  Filters wissen
                </Button>
              }
            />
          )}
      </div>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter doelen">
        <Field label="Discipline">
          <Select
            value={filter.discipline ?? ""}
            onChange={(e) => setFilter((f) => ({ ...f, discipline: e.target.value || undefined }))}
          >
            <option value="">Alle disciplines</option>
            {facetten?.disciplines.map((d) => (
              <option key={d.nummer} value={d.nummer}>
                {d.naam ?? d.nummer} ({d.aantal})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kleuter/leerjaar (jaar/fase)">
          <Select
            value={filter.jaarFase ?? ""}
            onChange={(e) => setFilter((f) => ({ ...f, jaarFase: e.target.value || undefined }))}
          >
            <option value="">Alle jaren</option>
            {facetten?.jaarFasen.map((j) => (
              <option key={j.jaarFase} value={j.jaarFase}>
                {j.jaarFase} ({j.aantal})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Domein">
          <Select
            value={filter.domein ?? ""}
            onChange={(e) => setFilter((f) => ({ ...f, domein: e.target.value || undefined, subdomein: undefined }))}
          >
            <option value="">Alle domeinen</option>
            {facetten?.domeinen.map((d) => (
              <option key={d.domein} value={d.domein}>
                {d.domein} ({d.aantal})
              </option>
            ))}
          </Select>
        </Field>
        {filter.domein && (
          <Field label="Subdomein">
            <Select
              value={filter.subdomein ?? ""}
              onChange={(e) => setFilter((f) => ({ ...f, subdomein: e.target.value || undefined }))}
            >
              <option value="">Alle subdomeinen</option>
              {facetten?.domeinen
                .find((d) => d.domein === filter.domein)
                ?.subdomeinen.map((s) => (
                  <option key={s.subdomein} value={s.subdomein}>
                    {s.subdomein} ({s.aantal})
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field label="Doelsoort">
          <Select
            value={filter.doelsoort ?? ""}
            onChange={(e) => setFilter((f) => ({ ...f, doelsoort: (e.target.value || undefined) as never }))}
          >
            <option value="">Alle types</option>
            {facetten?.doelsoorten.map((d) => (
              <option key={d.doelsoort} value={d.doelsoort}>
                {DOELSOORT_LABEL[d.doelsoort]} ({d.aantal})
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-2 flex gap-2">
          <Button
            variant="secundair"
            className="flex-1"
            onClick={() => {
              setFilter({});
            }}
          >
            Wissen
          </Button>
          <Button className="flex-1" onClick={() => setFilterOpen(false)}>
            Toepassen
          </Button>
        </div>
      </Sheet>

      <DoelDetailPanel code={geselecteerdeCode} open={!!geselecteerdeCode} onClose={() => setGeselecteerdeCode(null)} />
      <AiKoppelWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
