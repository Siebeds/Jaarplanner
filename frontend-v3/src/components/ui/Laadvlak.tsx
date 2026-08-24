import { cn } from "../../lib/cn";

/**
 * A placeholder shaped like the thing that is coming. It pulses rather than spins: a list of rows
 * arriving one shape at a time reads as progress, where a spinner reads as a stall.
 *
 * Hidden from assistive technology; the live region that announces loading belongs to the screen,
 * not to each grey rectangle.
 */
export function Laadvlak({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-veld bg-vlak-diep", className)} />;
}

export function Laadlijst({ rijen = 6 }: { rijen?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rijen }, (_, i) => (
        <Laadvlak key={i} className="h-14" />
      ))}
    </div>
  );
}
