import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRechten } from "../../lib/rechten";
import { ONDERDELEN, isAlleenDirectie, padVan, useZichtbareOnderdelen, type Deel } from "./onderdelen";

/**
 * The route half of hiding a directie-only part. The link is already gone for anyone else
 * (`useZichtbareOnderdelen`); this is for the address typed or bookmarked, which lands on the first
 * part the person can use instead of on a screen whose every request the server refuses.
 *
 * It renders nothing while `/api/ik` is still answering, so a directie never sees a redirect flash
 * past, and a leerkracht never sees the screen render once before being sent away. It hides; it does
 * not protect. The server answers 403 to the data whatever this component does.
 */
export function Onderdeelpoort({ deel, children }: { deel: Deel; children: ReactNode }) {
  const { mag, laadt } = useRechten();
  const zichtbaar = useZichtbareOnderdelen();
  const onderdeel = ONDERDELEN.find((o) => o.deel === deel);

  if (!onderdeel || !isAlleenDirectie(onderdeel)) return <>{children}</>;
  if (laadt) return null;
  if (mag.beheer) return <>{children}</>;
  return <Navigate to={padVan(zichtbaar[0].deel)} replace />;
}
