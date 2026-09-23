import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRef } from "react";
import { IcoonMeer, IcoonPotlood, IcoonVuilbak } from "../Iconen";
import { cn } from "../../lib/cn";

export type Menuactie = {
  label: string;
  onSelect: () => void;
  /** The bin and the danger hue on highlight, as `Verwijderknop` wears them on hover. */
  soort: "bewerk" | "verwijder";
};

/**
 * The "…" that holds the actions on an object (FB-094): one control per object instead of a row of bordered buttons,
 * with the delete no louder than the edit.
 *
 * **Only the actions the gebruiker holds**, and no menu at all when she holds none: a menu that opens on nothing is a
 * control that does nothing. Driven by the arrows, Enter and Escape (Radix), and the trigger says what it acts on.
 *
 * **The chosen action runs after the menu has closed and given focus back to the trigger**, the reason `Blokmenu`
 * gives: both actions open a sheet, and a sheet returns focus to what had it when it opened.
 */
export function Actiemenu({
  label,
  acties,
  omrand,
  className,
}: {
  /** What the menu acts on, for the trigger's name: "Meer acties voor Herfst". */
  label: string;
  acties: Menuactie[];
  /** Bordered, beside a bordered button in a header; bare on a list row. */
  omrand?: boolean;
  className?: string;
}) {
  const naSluiten = useRef<(() => void) | null>(null);
  if (acties.length === 0) return null;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-raak w-raak shrink-0 items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:text-inkt data-[state=open]:bg-vlak-diep data-[state=open]:text-inkt",
          omrand ? "border border-lijn-veld bg-kaart hover:border-inkt" : "hover:bg-vlak-diep sm:h-9 sm:w-9",
          className,
        )}
      >
        <IcoonMeer aria-hidden="true" className="h-5 w-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={16}
          onCloseAutoFocus={() => {
            const actie = naSluiten.current;
            naSluiten.current = null;
            if (actie) window.setTimeout(actie, 0);
          }}
          className="z-50 min-w-48 rounded-kaart border border-lijn bg-kaart p-1 shadow-zweef outline-none"
        >
          {acties.map((actie) => (
            <DropdownMenu.Item
              key={actie.label}
              onSelect={() => {
                naSluiten.current = actie.onSelect;
              }}
              className={cn(
                "flex h-raak cursor-default select-none items-center gap-2.5 rounded-veld px-2.5 text-body text-inkt outline-none transition-colors duration-100 sm:h-9 sm:text-meta",
                actie.soort === "verwijder"
                  ? "data-[highlighted]:bg-gevaar-zacht data-[highlighted]:text-gevaar"
                  : "data-[highlighted]:bg-vlak-diep",
              )}
            >
              {actie.soort === "verwijder" ? (
                <IcoonVuilbak aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
              ) : (
                <IcoonPotlood aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
              )}
              {actie.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
