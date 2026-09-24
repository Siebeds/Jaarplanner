import * as Popover from "@radix-ui/react-popover";
import { useId, useState } from "react";
import { IcoonChevron } from "../../components/Iconen";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { knopklassen } from "../../components/ui/knopklassen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { volleDag } from "../../lib/datum";
import type { GeplandeActiviteit } from "../../lib/types";
import { Aimerk, Beslisknoppen } from "../themas/Subdoelplaatsing";
import { toonTijd } from "./tijd";
import { useWeekvoorstel, weekbeslisFout, weekvoorstelFout } from "./weekvoorstelacties";

/** An open proposal with the day it stands on. */
type Voorstel = GeplandeActiviteit & { datum: string };

/**
 * "Stel mijn week voor" and the open proposals it left (FB-027, ADR-0067), in the agenda's toolbar beside the week.
 *
 * **Out of the grid's way (TB-081).** The button and a count of the open proposals sit in the toolbar; the proposals
 * themselves, with their motivation and the decision, open in a panel under them, so nothing stands between the
 * coverage bar and the grid. After a request the panel opens by itself with what came back.
 *
 * **One place to decide.** The grid shows where each proposal would go, ringed; this panel says why and takes the
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
  const [open, setOpen] = useState(false);
  const titelId = useId();

  const voorstellen: Voorstel[] = dagen.flatMap((dag) =>
    dag.activiteiten.filter((a) => a.status === "Voorgesteld").map((a) => ({ ...a, datum: dag.datum })),
  );
  const bezig = beslis.isPending || aanvaardAlles.isPending;
  const beslisfout = beslis.error ?? aanvaardAlles.error;

  const uitkomst = stelVoor.isError
    ? null
    : stelVoor.data
      ? (stelVoor.data.aantalVoorgesteld === 0
          ? t("weekvoorstel.geenVoorstellen")
          : telWoord(stelVoor.data.aantalVoorgesteld, "weekvoorstel.eenVoorgesteld", "weekvoorstel.voorgesteld")) +
        (stelVoor.data.pastNiet.length > 0 ? ` ${t("weekvoorstel.pastNiet", { namen: stelVoor.data.pastNiet.join(", ") })}` : "")
      : null;
  const vraagfout = stelVoor.isError ? weekvoorstelFout(stelVoor.error) : null;
  // The panel only opens on something to show. After a request its outcome stays in the panel, also once every
  // proposal is decided; without one, deciding the last proposal closes it.
  const heeftInhoud = voorstellen.length > 0 || uitkomst !== null || vraagfout !== null || beslisfout !== null;

  return (
    <Popover.Root open={open && heeftInhoud} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="flex shrink-0 items-center gap-1">
          <AiKnop
            bezig={stelVoor.isPending}
            className="min-w-9 px-0 text-meta max-sm:min-w-raak sm:h-9 sm:min-h-9 @min-[68rem]/kop:px-3"
            title={t("weekvoorstel.vraag")}
            onClick={() => {
              beslis.reset();
              aanvaardAlles.reset();
              setOpen(false);
              stelVoor.mutate(datum, { onSettled: () => setOpen(true) });
            }}
          >
            {/* The label and the count's word show only where the toolbar (the container `kop` in `Agendascherm`) has
                room for them beside the view switch: below that, on a laptop as on a phone, the wand and the number
                alone, so the switch never jumps to a second line when proposals appear. A screen reader hears both. */}
            <span className="sr-only @min-[68rem]/kop:not-sr-only">
              {stelVoor.isPending ? t("weekvoorstel.vraagBezig") : t("weekvoorstel.vraag")}
            </span>
          </AiKnop>

          {voorstellen.length > 0 ? (
            <Popover.Trigger
              title={telWoord(voorstellen.length, "weekvoorstel.eenOpen", "weekvoorstel.open")}
              className={cn(knopklassen("stil"), "gap-1 px-2 text-meta sm:h-9 sm:min-h-9")}
            >
              <span className="tabular-nums">{voorstellen.length}</span>
              <span className="sr-only @min-[68rem]/kop:not-sr-only">
                {voorstellen.length === 1 ? t("weekvoorstel.eenTeller") : t("weekvoorstel.teller")}
              </span>
              <IcoonChevron aria-hidden="true" className={cn("h-4 w-4 transition-transform duration-150", open && "rotate-180")} />
            </Popover.Trigger>
          ) : null}
        </div>
      </Popover.Anchor>

      {/* Heard where the button is, whatever the panel does: the request's outcome and a refused decision alike. */}
      <p className="sr-only" aria-live="polite">
        {vraagfout ?? (beslisfout ? weekbeslisFout(beslisfout) : null) ?? uitkomst ?? ""}
      </p>

      <Popover.Portal>
        <Popover.Content
          aria-labelledby={titelId}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            "z-50 flex w-[min(26rem,calc(100vw-2rem))] flex-col rounded-kaart border border-lijn bg-kaart shadow-zweef",
            "max-h-[min(32rem,var(--radix-popover-content-available-height))] outline-none",
          )}
        >
          <div className="border-b border-lijn px-4 py-3">
            <p id={titelId} className="text-meta font-medium text-inkt">
              {voorstellen.length > 0
                ? telWoord(voorstellen.length, "weekvoorstel.eenOpen", "weekvoorstel.open")
                : t("weekvoorstel.vraag")}
            </p>
            {vraagfout ? (
              <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {vraagfout}
              </p>
            ) : uitkomst ? (
              <p className="text-meta text-inkt-zacht">{uitkomst}</p>
            ) : null}
            {beslisfout ? (
              <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {weekbeslisFout(beslisfout)}
              </p>
            ) : null}
          </div>

          {voorstellen.length > 0 ? (
            <>
              <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain p-3">
                {voorstellen.map((voorstel) => (
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
              <div className="flex justify-end border-t border-lijn px-3 py-2">
                <Knop
                  disabled={bezig}
                  className="text-meta sm:h-9 sm:min-h-9"
                  onClick={() => {
                    beslis.reset();
                    aanvaardAlles.mutate({ van: dagen[0].datum, tot: dagen[dagen.length - 1].datum });
                  }}
                >
                  {t("weekvoorstel.allesAanvaarden")}
                </Knop>
              </div>
            </>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
