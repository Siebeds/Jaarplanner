import * as Popover from "@radix-ui/react-popover";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { IcoonEmoji } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { eersteEmoji, zoekEmoji } from "./emojicatalogus";

/**
 * The square before a thema's naam that holds its emoji (FB-060, design A of the owner's canvas).
 *
 * **The box is the naam field's height and sits on its left**, so the emoji reads as part of the name it will stand
 * beside everywhere else. Empty, it is dashed with a face-and-plus: a slot waiting to be filled, not a control that
 * already holds something.
 *
 * **The grid is a starting point, not the set.** Its search field takes focus on open, and an emoji that arrives in
 * it (the Windows emoji panel, a paste) is chosen at once, including one the grid does not offer. Nothing on screen
 * says so: the owner wanted it allowed, not advertised.
 *
 * **Arrow keys move through the grid**, so a keyboard user is not made to tab through 36 buttons.
 */
export function Emojikiezer({
  waarde,
  onKies,
  uitgeschakeld,
}: {
  /** The chosen emoji, or null for none. */
  waarde: string | null;
  onKies: (emoji: string | null) => void;
  uitgeschakeld?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState("");
  const zoekveld = useRef<HTMLInputElement>(null);
  const raster = useRef<HTMLDivElement>(null);
  const titelId = useId();

  const groepen = zoekEmoji(zoekterm);

  function wissel(openen: boolean) {
    setOpen(openen);
    setZoekterm("");
  }

  function kies(emoji: string | null) {
    onKies(emoji);
    wissel(false);
  }

  function beweeg(event: KeyboardEvent<HTMLDivElement>) {
    const stap = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 }[event.key];
    if (stap === undefined || !raster.current) return;
    const knoppen = Array.from(raster.current.querySelectorAll<HTMLButtonElement>("button[data-emoji]"));
    const nu = knoppen.indexOf(document.activeElement as HTMLButtonElement);
    if (nu < 0) return;
    event.preventDefault();
    knoppen[Math.min(Math.max(nu + stap, 0), knoppen.length - 1)]?.focus();
  }

  return (
    <Popover.Root open={open} onOpenChange={wissel}>
      <Popover.Trigger
        type="button"
        disabled={uitgeschakeld}
        aria-label={waarde ? t("emojikiezer.wijzig", { emoji: waarde }) : t("emojikiezer.kies")}
        className={cn(
          "inline-flex h-raak w-raak shrink-0 items-center justify-center rounded-veld border bg-kaart",
          "transition-colors duration-150 hover:bg-vlak-diep disabled:opacity-60",
          waarde ? "border-lijn-veld text-2xl leading-none" : "border-dashed border-lijn-veld text-inkt-zacht",
          open && "border-inkt ring-1 ring-inkt",
        )}
      >
        {waarde ? (
          <span aria-hidden="true">
            {waarde}
          </span>
        ) : (
          <IcoonEmoji className="h-[1.375rem] w-[1.375rem]" />
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-labelledby={titelId}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            zoekveld.current?.focus();
          }}
          className={cn(
            "z-50 flex w-[min(21.75rem,calc(100vw-2rem))] flex-col gap-2.5 rounded-kaart border border-lijn bg-kaart p-3 shadow-zweef",
            "max-h-[min(26rem,var(--radix-popover-content-available-height))] outline-none",
          )}
        >
          <h2 id={titelId} className="sr-only">
            {t("emojikiezer.titel")}
          </h2>
          <input
            ref={zoekveld}
            type="search"
            value={zoekterm}
            aria-label={t("emojikiezer.zoekLabel")}
            placeholder={t("emojikiezer.zoekPlaceholder")}
            onChange={(event) => {
              const getypt = eersteEmoji(event.target.value);
              if (getypt) kies(getypt);
              else setZoekterm(event.target.value);
            }}
            className={cn(
              "h-10 w-full shrink-0 rounded-veld border border-lijn-veld bg-kaart px-3 text-body text-inkt",
              "placeholder:text-inkt-zwak",
            )}
          />

          <div ref={raster} onKeyDown={beweeg} className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1">
            {groepen.length === 0 ? (
              <p className="px-1 py-2 text-meta text-inkt-zacht">{t("emojikiezer.geenResultaat")}</p>
            ) : (
              <div className="flex flex-col gap-3 py-0.5">
                {groepen.map((groep) => (
                  <div key={groep.id} role="group" aria-labelledby={`${titelId}-${groep.id}`}>
                    <p id={`${titelId}-${groep.id}`} className="mb-1 text-micro uppercase text-inkt-zwak">
                      {t(groep.titel)}
                    </p>
                    <div className="grid grid-cols-6 gap-0.5">
                      {groep.emoji.map((keuze) => {
                        const gekozen = keuze.teken === waarde;
                        return (
                          <button
                            key={keuze.teken}
                            type="button"
                            data-emoji
                            aria-label={t(keuze.naam)}
                            aria-pressed={gekozen}
                            title={t(keuze.naam)}
                            onClick={() => kies(keuze.teken)}
                            className={cn(
                              "flex h-raak items-center justify-center rounded-veld border text-2xl leading-none",
                              "transition-colors duration-150 hover:bg-vlak-diep",
                              gekozen ? "border-accent bg-accent-zacht" : "border-transparent",
                            )}
                          >
                            <span aria-hidden="true">{keuze.teken}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 border-t border-lijn pt-2">
            <button
              type="button"
              disabled={!waarde}
              onClick={() => kies(null)}
              className={cn(
                "h-9 rounded-veld px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150",
                "hover:bg-vlak-diep hover:text-inkt disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              {t("emojikiezer.geen")}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * A thema's emoji beside its name, wherever the name is shown (FB-060). Decorative: the name next to it says what the
 * thema is, so a screen reader skips it. Nothing when the thema has none.
 */
export function Themaicoon({ icoon, className }: { icoon: string | null | undefined; className?: string }) {
  if (!icoon) return null;
  return (
    <span aria-hidden="true" className={cn("mr-[0.35em] inline-block leading-none", className)}>
      {icoon}
    </span>
  );
}
