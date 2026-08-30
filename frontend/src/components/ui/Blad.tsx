import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { IcoonKruis } from "../Iconen";
import { t } from "../../i18n";

/**
 * One overlay component with two presentations: a bottom sheet on a phone, where the thumb is at
 * the bottom of the screen, and a right-hand panel from `sm` up, where a sheet rising out of the
 * bottom of a 27 inch monitor is absurd. Same DOM, same focus trap, same escape key.
 *
 * Radix owns the hard parts (focus trapping, inert background, escape, the labelling relationship
 * between the title and the dialog), which is the whole reason it is a dependency here.
 */
export function Blad({
  open,
  onOpenChange,
  titel,
  children,
  voet,
  maat = "normaal",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titel: string;
  children: ReactNode;
  voet?: ReactNode;
  /**
   * How wide the desktop panel is.
   *
   * `normaal` is a reading width: a filter list, one activiteit, a picker. `breed` is for a form
   * with fields that pair up, where the narrow panel forced every pair to stack and then squeezed
   * whichever field was flexible down to nothing.
   */
  maat?: "normaal" | "breed";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="waas-in fixed inset-0 z-40 bg-inkt/35 backdrop-blur-[2px]" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            const paneel = event.currentTarget as HTMLElement | null;
            const eerste = paneel?.querySelector<HTMLElement>(
              "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])",
            );
            if (!eerste) return; // nothing to fill in: let Radix do what it does
            event.preventDefault();
            eerste.focus();
          }}
          className={[
            "@container fixed z-50 flex flex-col bg-kaart shadow-zweef outline-none",
            // phone: a sheet that rises, never taller than most of the screen so the page behind
            // it stays visible and the dialog reads as a layer rather than a navigation.
            "blad-op inset-x-0 bottom-0 max-h-[86dvh] rounded-t-blad",
            // sm and up: a panel on the right, full height, fixed width.
            "sm:blad-in sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:rounded-l-blad",
            maat === "breed"
              ? "sm:w-[min(38rem,100vw)] lg:w-[min(46rem,100vw)]"
              : "sm:w-[min(26rem,100vw)]",
          ].join(" ")}
        >
          <header className="flex items-center justify-between gap-3 border-b border-lijn px-5 py-4">
            <Dialog.Title className="font-display text-sectie text-inkt">{titel}</Dialog.Title>
            <Dialog.Close
              aria-label={t("algemeen.sluiten")}
              className="-mr-2 inline-flex h-raak w-raak items-center justify-center rounded-veld text-inkt-zacht transition-colors hover:bg-vlak-diep hover:text-inkt"
            >
              <IcoonKruis className="h-5 w-5" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

          {voet ? <footer className="border-t border-lijn px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{voet}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
