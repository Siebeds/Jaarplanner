/**
 * Minimal, dependency-free SVG chart primitives for the Dekking-pagina. Deliberately not a charting
 * library: these are small, mobile-width (~390px) bars that always pair colour with a printed number
 * (Art. XII — never colour alone), and every value shown here comes straight from data the caller
 * already computed honestly — these components only draw, they never derive or round up coverage.
 */

/** A horizontal "gedekt / niet gedekt" bar for one total (e.g. one klas, or the whole curriculum). */
export function DekkingStaaf({
  label,
  gedekt,
  totaal,
  klein,
}: {
  label: string;
  gedekt: number;
  totaal: number;
  klein?: boolean;
}) {
  const percentage = totaal > 0 ? Math.round((gedekt / totaal) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={klein ? "text-xs font-semibold text-ink-zacht" : "text-sm font-semibold text-ink"}>{label}</span>
        <span className="shrink-0 text-xs font-semibold text-ink-zwak">
          {gedekt}/{totaal} ({percentage}%)
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-dekking-niet-gedekt/15">
        <div
          className="h-full rounded-full bg-dekking-gedekt"
          style={{ width: `${percentage}%` }}
          role="img"
          aria-label={`${label}: ${gedekt} van ${totaal} doelen gedekt (${percentage}%)`}
        />
      </div>
    </div>
  );
}

/** A simple vertical bar chart — used for de per-maand dekking. Bars share one scale (maxWaarde). */
export function VerticaalStaafdiagram({
  data,
  maxWaarde,
}: {
  data: { label: string; waarde: number }[];
  maxWaarde: number;
}) {
  const max = Math.max(maxWaarde, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 120 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-ink-zwak">{d.waarde || ""}</span>
          <div
            className="w-full rounded-t-md bg-dekking-gedekt"
            style={{ height: `${Math.max((d.waarde / max) * 88, d.waarde > 0 ? 4 : 0)}px` }}
            role="img"
            aria-label={`${d.label}: ${d.waarde} doelen gedekt`}
          />
          <span className="text-[10px] text-ink-zwak">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
