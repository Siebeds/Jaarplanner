import { AiKnop, Knop } from "../../components/ui/Knop";
import { t, telWoord } from "../../i18n";
import { volleDag } from "../../lib/datum";
import type { GeplandeActiviteit } from "../../lib/types";
import { Aimerk, Beslisknoppen } from "../themas/Subdoelplaatsing";
import { toonTijd } from "./tijd";
import { useWeekvoorstel, weekbeslisFout, weekvoorstelFout } from "./weekvoorstelacties";

/** An open proposal with the day it stands on. */
type Voorstel = GeplandeActiviteit & { datum: string };

/**
 * "Stel mijn week voor" and the open proposals it left (FB-027, ADR-0067), above the week's grid.
 *
 * **One place to decide.** The grid shows where each proposal would go, ringed; this strip says why and takes the
 * decision, so the blocks keep their size and the grid stays readable (ADR-0051: the faint ring, the wand with its word,
 * the quiet check and cross). Only for whoever may plan the klas: the proposals are hers to decide.
 *
 * **It lists what is on screen.** On a phone the week shows three days, and "Alles aanvaarden" takes exactly the ones
 * listed, so nothing is accepted that she has not seen.
 */
export function Weekvoorstel({
  klasId,
  datum,
  dagen,
}: {
  klasId: string;
  /** Any day of the week to propose; the server takes that week, from today on. */
  datum: string;
  /** The days on screen, with their blocks. */
  dagen: readonly { datum: string; activiteiten: readonly GeplandeActiviteit[] }[];
}) {
  const { stelVoor, beslis, aanvaardAlles } = useWeekvoorstel(klasId);

  const open: Voorstel[] = dagen.flatMap((dag) =>
    dag.activiteiten.filter((a) => a.status === "Voorgesteld").map((a) => ({ ...a, datum: dag.datum })),
  );
  const bezig = beslis.isPending || aanvaardAlles.isPending;
  const beslisfout = beslis.error ?? aanvaardAlles.error;

  return (
    <section className="mb-3 flex flex-col gap-2" aria-label={t("weekvoorstel.vraag")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiKnop
          bezig={stelVoor.isPending}
          onClick={() => {
            beslis.reset();
            aanvaardAlles.reset();
            stelVoor.mutate(datum);
          }}
        >
          {stelVoor.isPending ? t("weekvoorstel.vraagBezig") : t("weekvoorstel.vraag")}
        </AiKnop>

        {open.length > 0 ? (
          <>
            <span className="text-meta text-inkt-zacht">{telWoord(open.length, "weekvoorstel.eenOpen", "weekvoorstel.open")}</span>
            <Knop
              rang="stil"
              disabled={bezig}
              onClick={() => {
                beslis.reset();
                aanvaardAlles.mutate({ van: dagen[0].datum, tot: dagen[dagen.length - 1].datum });
              }}
            >
              {t("weekvoorstel.allesAanvaarden")}
            </Knop>
          </>
        ) : null}
      </div>

      <div aria-live="polite">
        {stelVoor.isError ? (
          <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {weekvoorstelFout(stelVoor.error)}
          </p>
        ) : stelVoor.data ? (
          <p className="text-meta text-inkt-zacht">
            {stelVoor.data.aantalVoorgesteld === 0
              ? t("weekvoorstel.geenVoorstellen")
              : telWoord(stelVoor.data.aantalVoorgesteld, "weekvoorstel.eenVoorgesteld", "weekvoorstel.voorgesteld")}
            {stelVoor.data.pastNiet.length > 0
              ? ` ${t("weekvoorstel.pastNiet", { namen: stelVoor.data.pastNiet.join(", ") })}`
              : ""}
          </p>
        ) : null}
        {beslisfout ? (
          <p className="mt-1 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {weekbeslisFout(beslisfout)}
          </p>
        ) : null}
      </div>

      {open.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {open.map((voorstel) => (
            <li key={voorstel.plaatsingId} className="voorstel-ai flex items-start gap-2 rounded-veld px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Aimerk label={t("weekvoorstel.voorstel")} />
                  <span className="text-meta tabular-nums text-inkt-zacht">
                    {volleDag(voorstel.datum)}, {toonTijd(voorstel.begin)}–{toonTijd(voorstel.einde)}
                  </span>
                </div>
                <p className="mt-0.5 text-body font-medium text-inkt">{voorstel.activiteitNaam}</p>
                {voorstel.aiMotivatie ? <p className="text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p> : null}
              </div>
              <Beslisknoppen
                naam={voorstel.activiteitNaam}
                bezig={bezig}
                onAanvaard={() => {
                  aanvaardAlles.reset();
                  beslis.mutate({ plaatsingId: voorstel.plaatsingId, aanvaard: true });
                }}
                onWeiger={() => {
                  aanvaardAlles.reset();
                  beslis.mutate({ plaatsingId: voorstel.plaatsingId, aanvaard: false });
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
