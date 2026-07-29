import { t } from "../../i18n";
import { Periodeblok } from "./Periodeblok";
import { Themakaart } from "./Themakaart";
import {
  bouwRibbon,
  formatteerDatum,
  plaatsingenIn,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { useJaarplan, usePlanningsrooster } from "./useJaarplan";

/**
 * The kalender: a class's jaarplan rendered over the school year's derived periods (E3-06, FR-6.1).
 *
 * **The year is a ribbon of unequal periods, and the vakanties are literal gaps in it** — the one
 * structural idea from the approved E3-10 wireframe. Block width is proportional to teaching days, so a
 * teacher *sees* why periode 1 is shorter than periode 3 rather than being told. A uniform month grid is
 * refused: the school year runs September→June and Belgian vakanties fall mid-month, so twelve equal
 * columns would misstate the year twice over (Art. IX.3 forbids assuming months; ADR-0013 forbids
 * referencing them in planning at all).
 *
 * **This is the first clickable draft, built to be assessed and changed** (owner, 2026-07-29). It is
 * deliberately read-only: dragging is E3-07, which also owns the confirmation protecting an accepted or
 * locked placement. The zoom toggle (E3-08) and the ongeplande-doelen tray (E3-09) are likewise absent
 * rather than faked — a control that does nothing teaches a review the wrong thing.
 */
export interface JaarplankalenderProps {
  klasId: string;
}

export function Jaarplankalender({ klasId }: JaarplankalenderProps) {
  const jaarplan = useJaarplan(klasId);
  const rooster = usePlanningsrooster(jaarplan.data?.schooljaarId);

  if (klasId.length === 0) {
    return <p className="text-sm text-slate-500">{t("kalender.geenKlas")}</p>;
  }

  if (jaarplan.isPending || rooster.isPending) {
    return <p className="text-sm text-slate-500">{t("kalender.laden")}</p>;
  }

  if (jaarplan.isError) {
    return <p className="text-sm text-red-700">{t("kalender.fout")}</p>;
  }

  if (rooster.isError) {
    return <p className="text-sm text-red-700">{t("kalender.roosterFout")}</p>;
  }

  const plan = jaarplan.data;
  const grid = rooster.data;
  const segmenten = bouwRibbon(grid.blokken, grid.onderbrekingen);

  // Placements pointing at a date that is no longer a period boundary. Collected FIRST and always
  // rendered: never silently relocated, never dropped (directie 2026-07-28).
  const vervallen = vervallenPlaatsingen(plan.plaatsingen, grid.blokken);

  return (
    <section className="w-full" aria-labelledby="kalender-titel">
      <header className="mb-3">
        <h2 id="kalender-titel" className="text-lg font-semibold text-slate-900">
          {t("kalender.titel")} — {plan.klasNaam}
        </h2>
        <p className="text-xs text-slate-500">
          {t("kalender.schooljaarLabel")}: {plan.schooljaarNaam} ·{" "}
          {t("kalender.indelingLabel")}: {grid.blokindeling}
        </p>
      </header>

      {/* Says out loud what the draft cannot do yet, so the review does not mistake absence for a bug.
          A plain div, not an <aside>: a complementary landmark may not nest inside this labelled
          section's region landmark, and this note is content within the kalender, not beside it. */}
      <div className="mb-4 rounded-md border border-slate-300 bg-slate-50 p-3">
        <h3 className="text-sm font-medium text-slate-900">{t("kalender.conceptTitel")}</h3>
        <p className="mt-1 text-xs text-slate-600">{t("kalender.conceptUitleg")}</p>
      </div>

      {vervallen.length > 0 && <TeHerzien plaatsingen={vervallen} />}

      {grid.blokken.length === 0 ? (
        <p className="text-sm text-slate-500">{t("kalender.leegRooster")}</p>
      ) : (
        <ol
          className="flex items-stretch gap-1 overflow-x-auto pb-2"
          aria-label={t("kalender.ribbonLabel")}
        >
          {segmenten.map((segment) =>
            segment.soort === "blok" ? (
              <Periodeblok
                key={`blok-${segment.blok.start}`}
                blok={segment.blok}
                plaatsingen={plaatsingenIn(plan.plaatsingen, segment.blok)}
              />
            ) : (
              <li
                key={`gat-${segment.onderbreking.start}`}
                /* A real break in the ribbon, named in the gap — not a period. */
                className="flex w-8 shrink-0 items-center justify-center rounded bg-slate-100 px-1"
                title={t("kalender.vakantie", { naam: segment.onderbreking.naam })}
              >
                <span className="whitespace-nowrap text-[0.625rem] uppercase tracking-wide text-slate-500 [writing-mode:vertical-rl]">
                  {segment.onderbreking.naam}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}

/**
 * The stale-placement notice.
 *
 * Rendered inline above the ribbon and **not dismissible** — there is no close control, by design. A
 * thema whose period no longer exists must stay visible until a human resolves it, and while it does the
 * plan's dekking cannot be trusted (directie 2026-07-28, Art. V.2). E3-07 owns the inline re-placement
 * action and E3-09 the full non-dismissible treatment; this draft owes the review an honest signal, not
 * a silent omission that would make the ribbon look complete when it is not.
 */
function TeHerzien({ plaatsingen }: { plaatsingen: ReturnType<typeof vervallenPlaatsingen> }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border-2 border-amber-600 bg-amber-50 p-3"
    >
      <h3 className="text-sm font-semibold text-amber-900">
        <span aria-hidden="true">▲</span>{" "}
        {t("kalender.herzienTitel", { aantal: plaatsingen.length })}
      </h3>
      <p className="mt-1 text-xs text-amber-900">{t("kalender.herzienUitleg")}</p>

      <ul className="mt-2 flex flex-col gap-1.5">
        {plaatsingen.map((plaatsing) => (
          <li key={plaatsing.id}>
            <Themakaart plaatsing={plaatsing} />
            <p className="mt-0.5 text-xs text-amber-900">
              {t("kalender.herzienDatum", { datum: formatteerDatum(plaatsing.blokStart) })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
