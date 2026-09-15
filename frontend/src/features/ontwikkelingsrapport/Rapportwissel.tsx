import { Navigate, NavLink } from "react-router-dom";
import { useRechten } from "../../lib/rechten";
import { cn } from "../../lib/cn";
import { t } from "../../i18n";
import { rapportpad, useZichtbareRapportdelen } from "./rapportdelen";

/**
 * The parts of the ontwikkelingsrapport, under the title at every width: three fit a phone, so there is no column
 * version as Instellingen has. Links, not a radiogroup, because each part is an address. Drawn like Instellingen's
 * phone switch (`Onderdeelwissel`), so the app has one look for "which of these parts am I in".
 */
export function Rapportwissel() {
  const delen = useZichtbareRapportdelen();
  return (
    <nav aria-label={t("ontwikkelingsrapport.onderdelen")}>
      <ul className="inline-flex max-w-full overflow-x-auto rounded-veld border border-lijn bg-vlak-diep p-1">
        {delen.map((onderdeel) => (
          <li key={onderdeel.deel} className="shrink-0">
            <NavLink
              to={rapportpad(onderdeel.deel)}
              className={({ isActive }) =>
                cn(
                  "flex min-h-9 items-center whitespace-nowrap rounded-[0.5rem] border px-3 text-meta font-medium transition-colors duration-150",
                  isActive
                    ? "border-lijn-sterk bg-kaart text-inkt shadow-licht"
                    : "border-transparent text-inkt-zacht hover:text-inkt",
                )
              }
            >
              {t(onderdeel.labelSleutel)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The bare `/ontwikkelingsrapport`: the first part this person may open. The sidebar and the phone card both link here.
 * Nothing renders while `/api/ik` answers, so a K3 leerkracht is not sent to the rapportdoelen for a moment first.
 */
export function Rapportstart() {
  const { laadt } = useRechten();
  const delen = useZichtbareRapportdelen();
  if (laadt) return null;
  return <Navigate to={rapportpad(delen[0].deel)} replace />;
}
