import { Segment } from "../../components/ui/Segment";
import { t } from "../../i18n";
import type { Weergave } from "./weergave";

/** What the switch offers: the agenda's four views, and the jaarplan before them as the widest zoom. */
export type Zicht = Weergave | "jaar";

/**
 * The one view switch of the agenda and the jaarplan (FB-089): Jaar, Maand, Week, Werkweek, Dag.
 *
 * **Both screens show it, in the same place, so switching between them is one gesture wherever you are.** The jaarplan
 * is a screen of its own (`/agenda/periodes`) and not a fifth view of the grid, so what choosing an option does is the
 * screen's to say: the agenda keeps its day when it changes view and navigates to the jaarplan for Jaar, and the
 * jaarplan opens the agenda in the chosen view. The switch itself only reports the choice.
 */
export function Weergavekeuze({
  waarde,
  onKies,
  className,
}: {
  waarde: Zicht;
  onKies: (zicht: Zicht) => void;
  className?: string;
}) {
  return (
    <Segment<Zicht>
      label={t("periode.weergave")}
      waarde={waarde}
      onKies={onKies}
      opties={[
        { waarde: "jaar", label: t("periode.jaar") },
        { waarde: "maand", label: t("periode.maand") },
        { waarde: "week", label: t("periode.week") },
        { waarde: "werkweek", label: t("periode.werkweek") },
        { waarde: "dag", label: t("periode.dag") },
      ]}
      className={className}
    />
  );
}
