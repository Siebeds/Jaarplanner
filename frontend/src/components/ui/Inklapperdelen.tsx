import {
  createContext,
  use,
  useId,
  useState,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { IcoonChevron } from "../Iconen";
import { cn } from "../../lib/cn";

/**
 * A fold: a button that opens and shuts a region (TB-075).
 *
 * **One component, so every fold says the same thing to a screen reader.** The button always carries `aria-expanded`,
 * and while open `aria-controls` naming the region. Only while open: a shut region is not mounted, and an
 * `aria-controls` naming an element that does not exist is invalid ARIA.
 *
 * **One arrow, one direction.** `Inklapper.Pijl` points right while shut and down once open (FB-094). The caller sets
 * its size, colour and place; the rotation is the fold's.
 *
 * `Root` draws nothing; it holds the state for whatever `Knop`, `Pijl` and `Inhoud` sit under it, so the button and
 * its region can stand wherever the layout needs them. Uncontrolled with `standaardOpen`, or controlled with `open`
 * and `onOpenChange` when the caller does more on a fold (resets a page, forgets a search).
 */
interface Staat {
  open: boolean;
  wissel: () => void;
  inhoudId: string;
}

const InklapperContext = createContext<Staat | null>(null);

function useInklapper(): Staat {
  const staat = use(InklapperContext);
  if (!staat) throw new Error("Inklapper parts must sit inside Inklapper.Root");
  return staat;
}

export function Root({
  open: gegevenOpen,
  standaardOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  standaardOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [eigenOpen, setEigenOpen] = useState(standaardOpen);
  const inhoudId = useId();
  const open = gegevenOpen ?? eigenOpen;
  const wissel = () => {
    if (gegevenOpen === undefined) setEigenOpen(!open);
    onOpenChange?.(!open);
  };
  return <InklapperContext value={{ open, wissel, inhoudId }}>{children}</InklapperContext>;
}

/** The button that folds. Every other button prop passes through; a given `onClick` runs before the fold. */
export function Knop({ onClick, children, ...rest }: Omit<ComponentPropsWithRef<"button">, "type">) {
  const { open, wissel, inhoudId } = useInklapper();
  return (
    <button
      {...rest}
      type="button"
      aria-expanded={open}
      aria-controls={open ? inhoudId : undefined}
      onClick={(event) => {
        onClick?.(event);
        wissel();
      }}
    >
      {children}
    </button>
  );
}

/** The fold arrow. Decorative: the button around it carries `aria-expanded`, which is what a screen reader announces. */
export function Pijl({ className }: { className?: string }) {
  const { open } = useInklapper();
  return (
    <IcoonChevron
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
        !open && "-rotate-90",
        className,
      )}
    />
  );
}

type Inhoudelement = "div" | "ul";

/**
 * The region, mounted only while open. `als` picks its element when the region is itself the list. `zichtbaar`
 * overrides the fold for a region that also shows while shut: a search in a shut list shows its matches there.
 */
export function Inhoud({
  als: Element = "div",
  zichtbaar,
  children,
  ...rest
}: Pick<HTMLAttributes<HTMLElement>, "className" | "role" | "aria-label" | "tabIndex"> & {
  als?: Inhoudelement;
  zichtbaar?: boolean;
  children: ReactNode;
}) {
  const { open, inhoudId } = useInklapper();
  if (!(zichtbaar ?? open)) return null;
  return (
    <Element {...rest} id={inhoudId}>
      {children}
    </Element>
  );
}
