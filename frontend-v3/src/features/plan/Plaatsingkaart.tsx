import type { Planningsblok, Themaplaatsing } from "../../lib/types";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Knop } from "../../components/ui/Knop";
import { Keuze } from "../../components/ui/Veld";
import { periode } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * One thema in one period, and everything a teacher can do to it (FR-7).
 *
 * The accept and reject buttons appear only while the placement is still `Voorgesteld`, because
 * after a verdict there is nothing left to accept. The lock and the move stay available in every
 * state: a teacher may re-plan a decision they already made.
 *
 * A locked placement survives a regeneration. So does one the teacher has decided on, lock or no
 * lock (Art. IX.3) - which is why the lock is offered plainly rather than sold as the way to keep
 * something.
 */
export function Plaatsingkaart({
  plaatsing,
  blokken,
  bezig,
  onBeoordeel,
  onVergrendel,
  onVerplaats,
  onVerwijder,
}: {
  plaatsing: Themaplaatsing;
  blokken: Planningsblok[];
  bezig: boolean;
  onBeoordeel: (status: "Aanvaard" | "Geweigerd") => void;
  onVergrendel: (vergrendeld: boolean) => void;
  onVerplaats: (blokStart: string) => void;
  onVerwijder: () => void;
}) {
  const teBeoordelen = plaatsing.status === "Voorgesteld";

  return (
    <article
      className={cn(
        "rounded-kaart border bg-kaart p-4 shadow-licht transition-opacity",
        plaatsing.isVervallen ? "border-attentie/50" : "border-lijn",
        bezig && "opacity-60",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-sectie text-inkt">{plaatsing.themaNaam}</h3>
          <p className="mono mt-0.5 text-meta text-inkt-zwak">
            {periode(plaatsing.blokStart, plaatsing.blokEind)} ·{" "}
            {telWoord(plaatsing.duurWeken, "plan.eenWeek", "plan.weken")} ·{" "}
            {telWoord(plaatsing.doelcodes.length, "plan.eenDoel", "plan.doelen")}
          </p>
        </div>
        <Statusmerk status={plaatsing.status} />
      </header>

      {plaatsing.isVervallen ? (
        <p className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {t("plan.vervallen")}
        </p>
      ) : null}

      {plaatsing.aiMotivatie ? (
        <p className="mt-3 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">
          {plaatsing.aiMotivatie}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {teBeoordelen ? (
          <>
            <Knop rang="hoofd" className="h-9 min-h-9 px-3 text-meta" disabled={bezig} onClick={() => onBeoordeel("Aanvaard")}>
              {t("plan.aanvaard")}
            </Knop>
            <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" disabled={bezig} onClick={() => onBeoordeel("Geweigerd")}>
              {t("plan.weiger")}
            </Knop>
          </>
        ) : null}

        {/* A toggle button rather than a checkbox. A 16px checkbox is under WCAG 2.2 AA 2.5.8's
            24px floor, and while its label extends the hit area, a control that measures as too
            small is a control somebody will later copy. The pressed state travels three ways:
            aria-pressed, the dot going from hollow to filled, and the border. */}
        <button
          type="button"
          aria-pressed={plaatsing.vergrendeld}
          disabled={bezig}
          onClick={() => onVergrendel(!plaatsing.vergrendeld)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-veld border px-3 text-meta transition-colors duration-150",
            plaatsing.vergrendeld ? "border-inkt bg-vlak-diep text-inkt" : "border-lijn text-inkt-zacht hover:border-lijn-veld",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 rounded-full border",
              plaatsing.vergrendeld ? "border-inkt bg-inkt" : "border-lijn-veld bg-transparent",
            )}
          />
          {t("plan.vergrendeld")}
        </button>

        <Keuze
          aria-label={t("plan.verplaatsNaar")}
          className="h-9 w-auto min-w-40 text-meta"
          disabled={bezig}
          value={plaatsing.blokStart}
          onChange={(e) => onVerplaats(e.target.value)}
        >
          {blokken.map((blok) => (
            <option key={blok.start} value={blok.start}>
              {periode(blok.start, blok.eind)}
            </option>
          ))}
        </Keuze>

        <Knop rang="stil" className="ml-auto h-9 min-h-9 px-3 text-meta" disabled={bezig} onClick={onVerwijder}>
          {t("plan.verwijder")}
        </Knop>
      </div>
    </article>
  );
}
