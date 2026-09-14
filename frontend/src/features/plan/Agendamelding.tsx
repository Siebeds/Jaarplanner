import { useState } from "react";
import { Aandachtsmelding } from "../../components/ui/Aandachtsmelding";
import { ApiError } from "../../lib/api";
import { geenToegangZin } from "../../lib/rechten";
import { t } from "../../i18n";

/** Where a failure is shown: by a sheet, here once the picker has closed, or here. */
type Plek = "blad" | "naKiezer" | "pagina";

/**
 * The agenda's one strip for everything a drag or a placement can go wrong with: from the teacher's side they are one
 * thing, the drop did not do what she meant. `sleepFout` wins, since a refusal decided in the browser fired no
 * request, and any server error beside it belongs to an earlier attempt.
 *
 * **A refusal is an `Aandachtsmelding`, everything else is the strip it was** (E6-02 slice 4, fix round 1; WCAG 4.1.3).
 * The alert takes focus once, which announces it and scrolls it into view: below a grid that fills a 1440×1000 screen a
 * plain paragraph was announced to nobody and out of view.
 *
 * **It mounts only while none of the four agenda sheets that send these requests is open** (fix round 2, F7; narrowed
 * in fix round 3): the picker, the new-activiteit sheet, the activiteit sheet and the subthema planner. Each is a modal
 * dialog: its focus trap takes the alert's one focus back, the page behind it is hidden from a screen reader, and the
 * scroll moves the page under the overlay. The two hoek sheets are not counted; they send none of these requests. So
 * where a refusal is shown is decided when it arrives:
 * - with the new-activiteit sheet, the activiteit sheet or the subthema planner open, that sheet shows it as an alert
 *   of its own, and this strip never does, not after the sheet closes either;
 * - with the picker open, which has no error line, it waits here until the picker closes (the picker closes on a
 *   refusal);
 * - otherwise it shows at once.
 * An alert already on the page when a sheet opens stays mounted, so closing that sheet does not take focus again.
 */
export function Agendamelding({
  sleepFout,
  fouten,
  kiezerOpen,
  bladOpen,
}: {
  sleepFout: string | null;
  fouten: readonly unknown[];
  /** The activity picker is open. */
  kiezerOpen: boolean;
  /** A sheet that shows its own failures is open: the new-activiteit sheet, the activiteit sheet, the planner. */
  bladOpen: boolean;
}) {
  const fout = fouten.find((kandidaat) => kandidaat !== null && kandidaat !== undefined);

  // Decided when the failure changes, and kept with it. Stored during render rather than in an effect, the pattern
  // `Bestemmingsblad` uses for its search box, so the alert never mounts for one render in the wrong place.
  const [vorige, setVorige] = useState<{ fout: unknown; plek: Plek }>(() => ({ fout, plek: plekVoor(bladOpen, kiezerOpen) }));
  let plek = fout === vorige.fout ? vorige.plek : plekVoor(bladOpen, kiezerOpen);
  if (plek === "naKiezer" && !kiezerOpen && !bladOpen) plek = "pagina";
  if (fout !== vorige.fout || plek !== vorige.plek) setVorige({ fout, plek });

  if (sleepFout) return <Strook>{sleepFout}</Strook>;
  if (fout === undefined) return null;

  const geweigerd = geenToegangZin(fout);
  if (geweigerd) {
    if (plek !== "pagina") return null;
    return (
      <div className="mt-4">
        <Aandachtsmelding>{geweigerd}</Aandachtsmelding>
      </div>
    );
  }

  return <Strook>{fout instanceof ApiError && fout.detail ? fout.detail : t("periode.mislukt")}</Strook>;
}

function plekVoor(bladOpen: boolean, kiezerOpen: boolean): Plek {
  if (bladOpen) return "blad";
  return kiezerOpen ? "naKiezer" : "pagina";
}

function Strook({ children }: { children: string }) {
  return (
    <p className="mt-4 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
      {children}
    </p>
  );
}
