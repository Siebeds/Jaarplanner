import * as Popover from "@radix-ui/react-popover";
import { useId, useRef, useState } from "react";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { IcoonInfo } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useLeerplandoel } from "../../lib/queries";
import type { Doelsoort } from "../../lib/types";
import { Doeldetailblad } from "../themas/Doeldetailblad";

/**
 * A goal as the thing that carries it knows it (FB-018).
 *
 * Always the code. The doelsoort and the text only where the list that brought it had them: an algemene fiche's goals
 * arrive whole, while an activiteit on the weekplanning carries its codes and nothing else, so `Doelregel` fetches the
 * rest.
 */
export interface Infodoel {
  code: string;
  doelsoort?: Doelsoort;
  tekst?: string;
}

/**
 * The info icon on a block of the time grid or a card in the agenda's side panel, and the small window it opens with
 * the goals that block or card works on (FB-018).
 *
 * The owner, 2026-09-15: "via info icoontje zodat het niet telkens open springt als je op een fiche klikt", and "nog
 * altijd zorgen dat je genoeg weet aan welke doelen je werkt in jouw agenda". So the goals are one press away wherever
 * a teacher meets the block, and pressing the block itself still does what it did.
 *
 * **Its own button beside the block's, never inside it.** The block is a button that drags, and a button inside a
 * button is invalid; as a sibling the icon starts no drag, opens no sheet and is its own Tab stop after the block.
 *
 * **A popover, not a sheet.** It answers one question and goes away. A sheet is what the block itself opens, and a
 * second sheet for three lines of goals is what the owner asked not to get.
 *
 * **A goal in it opens the doel's detail**, the sheet the thema page opens (TB-016). The window closes first, so she
 * is one layer deep rather than two, and focus comes back to this icon when the detail closes.
 *
 * **Only what the server counts as a goal of the block**: an activiteit's codes are its accepted and manual links
 * (the weekplanning's `Doelcodes`), and an algemene fiche's links are all manual (ADR-0029). A suggestion is never
 * listed here.
 */
export function Doelinfo({
  naam,
  doelen,
  telling = false,
  className,
}: {
  /** The block's or card's own name: it labels the icon and titles the window. */
  naam: string;
  doelen: readonly Infodoel[];
  /**
   * The count as the button's text ("3 doelen") instead of the icon: an activiteitkaart in the side panel, where the
   * count is the one fact about its goals a teacher scans the list for, and a second mark saying it would be a
   * repetition (FB-102). None is a knelpunt and wears `attentie`, as `Doelmerk` does: such an activiteit counts for
   * the dekking nowhere.
   */
  telling?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [gekozen, setGekozen] = useState<string | null>(null);
  // The detail mounts on the first goal asked for and then stays, so it can slide away when it closes. A grid of forty
  // blocks does not carry forty closed dialogs from the start.
  const [detailGevraagd, setDetailGevraagd] = useState(false);
  const [knop, setKnop] = useState<HTMLButtonElement | null>(null);
  // Set for the one close a goal caused: focus then belongs to the detail that is opening, not to this icon.
  const naarDetail = useRef(false);
  const titelId = useId();
  const aantalZin =
    doelen.length === 0 ? t("activiteit.geenDoel") : telWoord(doelen.length, "doelinfo.eenDoel", "doelinfo.aantalDoelen");

  function kies(code: string) {
    naarDetail.current = true;
    setOpen(false);
    setGekozen(code);
    setDetailGevraagd(true);
  }

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        {telling ? (
          <Popover.Trigger
            ref={setKnop}
            // The visible count leads the name, so a voice user can say what she sees (WCAG 2.5.3).
            aria-label={t("doelinfo.openMetTelling", { telling: aantalZin, naam })}
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-full border px-2 text-meta font-medium",
              "transition-colors duration-150",
              doelen.length === 0
                ? "border-attentie/40 bg-attentie-zacht text-attentie-inkt hover:border-attentie"
                : cn("border-lijn bg-kaart text-inkt hover:border-lijn-sterk hover:bg-vlak", open && "border-lijn-sterk bg-vlak"),
              className,
            )}
          >
            {aantalZin}
          </Popover.Trigger>
        ) : (
          <Popover.Trigger
            ref={setKnop}
            aria-label={t("doelinfo.open", { naam })}
            className={cn(
              // 24 by 24: the smallest target WCAG 2.2 AA (2.5.8) accepts, and what fits in a half-hour block.
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-veld text-inkt-zacht",
              "transition-colors duration-150 hover:bg-inkt/[0.07] hover:text-inkt",
              open && "bg-inkt/[0.07] text-inkt",
              className,
            )}
          >
            <IcoonInfo className="h-4 w-4" />
          </Popover.Trigger>
        )}

        <Popover.Portal>
          <Popover.Content
            aria-labelledby={titelId}
            side="bottom"
            align="end"
            sideOffset={4}
            collisionPadding={16}
            onCloseAutoFocus={(event) => {
              if (!naarDetail.current) return;
              naarDetail.current = false;
              event.preventDefault();
            }}
            className={cn(
              "z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col rounded-kaart border border-lijn bg-kaart shadow-zweef",
              "max-h-[min(24rem,var(--radix-popover-content-available-height))] outline-none",
            )}
          >
            <div className="border-b border-lijn px-4 py-3">
              <p id={titelId} className="text-meta font-medium text-inkt">
                {naam}
              </p>
              <p className="text-micro text-inkt-zacht">
                {doelen.length === 0
                  ? t("doelinfo.geen")
                  : telWoord(doelen.length, "doelinfo.eenDoel", "doelinfo.aantalDoelen")}
              </p>
            </div>

            {doelen.length > 0 ? (
              <div className="min-h-0 overflow-y-auto overscroll-contain">
                <Doelregels doelen={doelen} onKies={kies} />
              </div>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {detailGevraagd ? <Doeldetailblad code={gekozen} terugNaar={knop} onSluit={() => setGekozen(null)} /> : null}
    </>
  );
}

/**
 * The goals as rows, each opening the doel's detail.
 *
 * Shared by the window above and by the algemene fiche's own sheet, which is where a block too short to hold the icon
 * keeps its goals.
 */
export function Doelregels({
  doelen,
  onKies,
}: {
  doelen: readonly Infodoel[];
  /** `knop` is the row pressed, for a caller whose detail should give focus back to it. */
  onKies: (code: string, knop: HTMLElement) => void;
}) {
  return (
    <ul className="divide-y divide-lijn">
      {doelen.map((doel) => (
        <Doelregel key={doel.code} doel={doel} onKies={onKies} />
      ))}
    </ul>
  );
}

/**
 * One goal: the doelsoort and the code as a small line, the text under it at two lines at most, as on the thema page
 * (`Gekoppelddoel`). The whole sentence is in the detail the row opens.
 *
 * **The text is fetched only where the carrier did not bring it**, from the detail endpoint, and only once the row is
 * on screen, which for the window means after the icon was pressed. That is a heavy read for two fields (TB-017 says
 * why), taken here for the few goals of one activiteit on one press; the detail it opens is then served from cache.
 */
function Doelregel({ doel, onKies }: { doel: Infodoel; onKies: (code: string, knop: HTMLElement) => void }) {
  const ophalen = doel.tekst === undefined;
  const { data, isPending } = useLeerplandoel(ophalen ? doel.code : null);
  const doelsoort = doel.doelsoort ?? data?.doelsoort;
  const tekst = doel.tekst ?? data?.tekst;

  return (
    <li>
      <button
        type="button"
        onClick={(event) => onKies(doel.code, event.currentTarget)}
        className="block w-full px-4 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {doelsoort ? <Doelsoortmerk soort={doelsoort} /> : null}
          <span className="mono text-micro font-medium text-inkt-zacht">{doel.code}</span>
          {/* Only where the row read the doel itself, and so knows. A doel Op.stap dropped stays linked, and a list of
              goals is where a teacher has to see that it needs reviewing (Art. III.4). */}
          {data?.nietMeerInOpstap ? (
            <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
        </span>

        {/* If the doel cannot be loaded the row keeps its code; the detail it opens shows the load error. */}
        {tekst ? (
          <span className="mt-1 line-clamp-2 block text-meta text-inkt">{tekst}</span>
        ) : ophalen && isPending ? (
          <span aria-hidden="true" className="mt-1.5 block h-4 w-3/4 animate-pulse rounded-veld bg-vlak-diep" />
        ) : null}
      </button>
    </li>
  );
}
