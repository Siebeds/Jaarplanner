import type { ReactNode } from "react";

import { Button } from "../../components/ui/button";
import { t, tAantal } from "../../i18n";
import { ApiError } from "../../lib/api";
import { Jaarspine } from "./Jaarspine";
import { Periodeblok } from "./Periodeblok";
import { Spreidingsoverzicht } from "./Spreidingsoverzicht";
import { Themakaart } from "./Themakaart";
import {
  bouwRibbon,
  formatteerDatum,
  geplandeIn,
  isTeVol,
  plaatsingenIn,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { useGenereerJaarplan, useJaarplan, usePlanningsrooster } from "./useJaarplan";

/**
 * The kalender: a class's jaarplan over the school year's derived periods (E3-06, FR-6.1).
 *
 * **The year is a sequence of unequal periods, and the vakanties are literal gaps in it** — the structural
 * idea from the approved E3-10 wireframe. It is rendered twice, on purpose: the {@link Jaarspine} carries
 * the *proportional* view (width ∝ teaching days, vakanties as openings), and the grid below carries the
 * *planning* view in uniform, readable cards. A uniform month grid is refused either way — the school year
 * runs September→June and Belgian vakanties fall mid-month, so twelve equal columns would misstate the
 * year twice over (Art. IX.3 forbids assuming months; ADR-0013 forbids referencing them in planning).
 *
 * **This is still the first clickable draft, built to be assessed and changed.** Deliberately read-only:
 * dragging is E3-07, which also owns the confirmation protecting an accepted or locked placement. The zoom
 * toggle (E3-08) and the ongeplande-doelen tray (E3-09) are absent rather than faked.
 */
export interface JaarplankalenderProps {
  klasId: string;
}

export function Jaarplankalender({ klasId }: JaarplankalenderProps) {
  const jaarplan = useJaarplan(klasId);
  const rooster = usePlanningsrooster(jaarplan.data?.schooljaarId);
  const generatie = useGenereerJaarplan(klasId);

  if (klasId.length === 0) {
    return <Melding soort="rustig">{t("kalender.geenKlas")}</Melding>;
  }

  // Errors are checked BEFORE pending, and the order is load-bearing rather than stylistic. `rooster` is
  // chained behind the schooljaarId the jaarplan returns, so while that id is unknown the rooster query is
  // *disabled* — and a disabled TanStack Query v5 query reports `isPending === true`, not idle. With the
  // pending guard first, a failed jaarplan fetch never reached its error branch: the screen showed
  // "Jaarplan laden…" forever and `kalender.fout` was dead code.
  if (jaarplan.isError) {
    return <Melding soort="fout">{t("kalender.fout")}</Melding>;
  }

  if (rooster.isError) {
    return <Melding soort="fout">{t("kalender.roosterFout")}</Melding>;
  }

  if (jaarplan.isPending || rooster.isPending) {
    return <Melding soort="rustig">{t("kalender.laden")}</Melding>;
  }

  const plan = jaarplan.data;
  const grid = rooster.data;
  const segmenten = bouwRibbon(grid.blokken, grid.onderbrekingen);

  // Placements pointing at a date that is no longer a period boundary. Collected FIRST and always
  // rendered: never silently relocated, never dropped (directie 2026-07-28).
  const vervallen = vervallenPlaatsingen(plan.plaatsingen, grid.blokken);

  // Derived once and shared with the spine, so the strip and the cards can never disagree about which
  // period is full or over-full.
  const gevuldeOrdinalen = new Set<number>();
  const teVolleOrdinalen = new Set<number>();
  for (const blok of grid.blokken) {
    const inBlok = plaatsingenIn(plan.plaatsingen, blok);
    if (geplandeIn(inBlok).length > 0) {
      gevuldeOrdinalen.add(blok.ordinaal);
    }
    if (isTeVol(inBlok)) {
      teVolleOrdinalen.add(blok.ordinaal);
    }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="kalender-titel">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h2 id="kalender-titel" className="text-2xl font-bold text-ink sm:text-[1.75rem]">
            {t("kalender.titel")}
          </h2>
          {/* The class is the subtitle rather than being spliced into the heading with a dash, which read
              as three unrelated things joined by punctuation. */}
          <p className="mt-1 text-base text-ink-zacht">
            {plan.klasNaam}
            <span aria-hidden="true" className="px-2 text-border">
              |
            </span>
            <span data-cijfers>{plan.schooljaarNaam}</span>
          </p>
        </div>

        {/* Says out loud what the draft cannot do yet, so the review does not mistake absence for a bug. */}
        <p className="max-w-md rounded-md bg-petrol-wash px-3.5 py-2.5 text-xs leading-snug text-petrol">
          <span className="font-semibold">{t("kalender.conceptTitel")}. </span>
          {t("kalender.conceptUitleg")}
        </p>
      </header>

      {vervallen.length > 0 && <TeHerzien plaatsingen={vervallen} />}

      {grid.blokken.length === 0 ? (
        <Melding soort="rustig">{t("kalender.leegRooster")}</Melding>
      ) : (
        <Jaarspine
          segmenten={segmenten}
          onderbrekingen={grid.onderbrekingen}
          gevuldeOrdinalen={gevuldeOrdinalen}
          teVolleOrdinalen={teVolleOrdinalen}
        />
      )}

      {/* Generation (FR-5.1) with its spreading report (E3-02, FR-5.2). This is the only action on the
          screen, and it is safe to offer before E3-07 exists because it only ADDS proposals — it never
          discards a teacher's decision or a locked placement (Art. IV.1, Art. IX.3). */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
        {/* Stacked on a phone, side by side from `sm`. As a single wrapping flex row the explanation
            shrank into a narrow column beside the button and clipped it. */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
          <Button
            type="button"
            onClick={() => generatie.mutate()}
            disabled={generatie.isPending}
            className="w-full sm:w-auto"
          >
            {generatie.isPending ? t("kalender.genereerBezig") : t("kalender.genereer")}
          </Button>
          <p className="max-w-2xl text-xs leading-snug text-ink-zacht">
            {t("kalender.genereerUitleg")}
          </p>
        </div>

        {/* The 422 body is an English operator diagnostic (a model parse failure a teacher cannot act on),
            so it is never echoed — the teacher gets Dutch copy from nl.json keyed on the STATUS.
            422 and 5xx are told apart deliberately: 422 means the model answered badly and retrying is
            sensible, while anything else means the tool is broken or unconfigured (with no AzureAI:ApiKey
            set the client throws, which surfaces as a 500). Showing "de AI gaf geen bruikbaar antwoord" for
            a missing API key would blame the model for a configuration fault and send the teacher into a
            pointless retry loop. Both messages state that nothing changed, which Art. IV.5 guarantees. */}
        {generatie.isError && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
          >
            {generatie.error instanceof ApiError && generatie.error.status === 422
              ? t("kalender.genereerMislukt")
              : t("kalender.genereerOnbeschikbaar")}
          </p>
        )}

        {generatie.isSuccess && <Spreidingsoverzicht resultaat={generatie.data} />}
      </div>

      {grid.blokken.length > 0 && (
        <ol
          // A vertical sequence of full-width bands. Proportional length lives in the spine above; here the
          // year reads strictly top to bottom and each period's thema's flow across the available width.
          // Both tile layouts tried before this one left dead space beside a short period — see Periodeblok.
          className="flex flex-col gap-3"
          aria-label={t("kalender.ribbonLabel")}
        >
          {grid.blokken.map((blok) => (
            <Periodeblok
              key={`blok-${blok.start}`}
              blok={blok}
              plaatsingen={plaatsingenIn(plan.plaatsingen, blok)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

/** A single line of page-level feedback: loading, empty, or failed. */
function Melding({ soort, children }: { soort: "rustig" | "fout"; children: ReactNode }) {
  const isFout = soort === "fout";

  return (
    <p
      {...(isFout ? { role: "alert" as const } : {})}
      className={[
        "rounded-lg border px-4 py-6 text-center text-sm",
        isFout
          ? "border-suggestie-geweigerd/30 bg-suggestie-geweigerd/5 font-medium text-suggestie-geweigerd"
          : "border-dashed border-border bg-card/60 text-ink-zacht",
      ].join(" ")}
    >
      {children}
    </p>
  );
}

/**
 * The stale-placement notice.
 *
 * Rendered above everything and **not dismissible** — there is no close control, by design. A thema whose
 * period no longer exists must stay visible until a human resolves it, and while it does the plan's dekking
 * cannot be trusted (directie 2026-07-28, Art. V.2). E3-07 owns the inline re-placement action and E3-09
 * the full treatment; this draft owes the review an honest signal, not a silent omission that would make
 * the plan look complete when it is not.
 */
function TeHerzien({ plaatsingen }: { plaatsingen: ReturnType<typeof vervallenPlaatsingen> }) {
  return (
    <div role="alert" className="rounded-lg border-2 border-attentie bg-attentie-zacht p-4 sm:p-5">
      <h3 className="text-base font-bold text-attentie-ink">
        <span aria-hidden="true">▲</span>{" "}
        {/* Via the shared helper rather than an inline ternary: the same singular/plural bug turned up in
            five separate strings before `tAantal` existed, and each was fixed on its own. */}
        {tAantal(plaatsingen.length, "kalender.herzienTitelEnkelvoud", "kalender.herzienTitel")}
      </h3>
      <p className="mt-1.5 max-w-3xl text-sm leading-snug text-attentie-ink">
        {t("kalender.herzienUitleg")}
      </p>

      <ul className="mt-4 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plaatsingen.map((plaatsing) => (
          <li key={plaatsing.id}>
            <Themakaart plaatsing={plaatsing} />
            <p className="mt-1 text-xs font-medium text-attentie-ink" data-cijfers>
              {t("kalender.herzienDatum", { datum: formatteerDatum(plaatsing.blokStart) })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
