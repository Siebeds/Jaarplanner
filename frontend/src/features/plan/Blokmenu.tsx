import * as ContextMenu from "@radix-ui/react-context-menu";
import { type ReactElement, useRef } from "react";
import { IcoonPotlood, IcoonVuilbak } from "../../components/Iconen";
import { t } from "../../i18n";

/**
 * What a right click on a block of the agenda offers (TB-030): open it to edit, or take it off this day.
 *
 * **Only for whoever may plan the klas.** Both rows change the plan, so for anyone else the block keeps the browser's
 * own menu rather than getting one of ours with nothing in it. Pressing the block still opens its sheet for everyone.
 *
 * **The same menu the mouse, the Menu key and Shift+F10 open** (Radix listens for `contextmenu`, which a browser fires
 * for all three on a focused element), and it is driven by the arrows, Enter and Escape. A press that is not the primary
 * button starts no drag: dnd-kit's pointer sensor only answers the left one.
 *
 * **The block's name heads the menu**, in ink-soft and not as a row, because blocks overlap in a busy morning and the
 * pointer alone does not always say which one was pressed.
 *
 * **Colour only where the house style already puts it** (ADR-0024): a row takes the hover surface when it is
 * highlighted, and the delete row wears `gevaar` then, exactly as `Verwijderknop` does on hover and focus. The bin and
 * the words say "delete" before the colour appears.
 *
 * **The chosen action runs after the menu has closed and given focus back to the block.** Both actions open a sheet (the
 * block's own, or the confirmation), and a sheet remembers what had focus when it opened in order to give it back. Run
 * inside the menu, that would be a row about to unmount, and closing the sheet would drop focus on the page.
 */
export function Blokmenu({
  naam,
  magPlannen,
  onBewerk,
  onVanDag,
  children,
}: {
  /** The block's name: it heads the menu and names it for a screen reader. */
  naam: string;
  magPlannen: boolean;
  onBewerk: () => void;
  onVanDag: () => void;
  /** The block itself: one element that takes a ref, since Radix hangs its listeners on it. */
  children: ReactElement;
}) {
  const naSluiten = useRef<(() => void) | null>(null);

  if (!magPlannen) return children;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          aria-label={naam}
          collisionPadding={16}
          onCloseAutoFocus={() => {
            const actie = naSluiten.current;
            naSluiten.current = null;
            // After the default, which is focus going back to the block.
            if (actie) window.setTimeout(actie, 0);
          }}
          className="z-50 w-56 rounded-kaart border border-lijn bg-kaart p-1 shadow-zweef outline-none"
        >
          <ContextMenu.Label className="truncate px-2.5 pb-1 pt-1.5 text-micro text-inkt-zacht">{naam}</ContextMenu.Label>
          <ContextMenu.Item
            onSelect={() => {
              naSluiten.current = onBewerk;
            }}
            className={REGEL + " data-[highlighted]:bg-vlak-diep"}
          >
            <IcoonPotlood className="h-[18px] w-[18px] shrink-0" />
            {t("blokmenu.bewerk")}
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={() => {
              naSluiten.current = onVanDag;
            }}
            className={REGEL + " data-[highlighted]:bg-gevaar-zacht data-[highlighted]:text-gevaar"}
          >
            <IcoonVuilbak className="h-[18px] w-[18px] shrink-0" />
            {t("blokmenu.vanDag")}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// 36 pixels, the row-control size of `Rijknoppen`: well over the 24 WCAG 2.2 AA asks, in a menu a finger rarely opens.
const REGEL =
  "flex h-9 cursor-default select-none items-center gap-2.5 rounded-veld px-2.5 text-meta text-inkt outline-none transition-colors duration-100";
