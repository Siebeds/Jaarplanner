import type { ReactNode } from "react";

/**
 * An empty screen is an invitation to act, so this is one line and one next step. No paragraph
 * explaining the emptiness: if the reason cannot be said in a heading, it does not belong here.
 */
export function Leegte({ titel, actie }: { titel: string; actie?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-kaart border border-dashed border-lijn-sterk bg-kaart/60 px-6 py-12 text-center">
      <p className="text-sectie text-inkt">{titel}</p>
      {actie}
    </div>
  );
}
