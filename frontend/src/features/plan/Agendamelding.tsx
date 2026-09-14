import { Aandachtsmelding } from "../../components/ui/Aandachtsmelding";
import { ApiError } from "../../lib/api";
import { geenToegangZin } from "../../lib/rechten";
import { t } from "../../i18n";

/**
 * The agenda's one strip for everything a drag or a placement can go wrong with: from the teacher's side they are one
 * thing, the drop did not do what she meant. `sleepFout` wins, since a refusal decided in the browser fired no
 * request, and any server error beside it belongs to an earlier attempt.
 *
 * **A refusal is an `Aandachtsmelding`, everything else is the strip it was** (E6-02 slice 4, fix round 1; WCAG 4.1.3).
 * A 403 arrives after the control that caused it has gone: the picker closes and the add buttons disappear with the
 * refetched rights. The sentence sits under a grid that fills a 1440×1000 screen, so a plain paragraph was
 * announced to nobody, out of view, with focus on the page body. The alert takes focus once, which announces it and
 * scrolls it into view. Other failures keep their quiet strip: the control that failed is still under the pointer,
 * and taking focus from it would be the wrong move.
 */
export function Agendamelding({ sleepFout, fouten }: { sleepFout: string | null; fouten: readonly unknown[] }) {
  if (sleepFout) return <Strook>{sleepFout}</Strook>;

  const fout = fouten.find((kandidaat) => kandidaat !== null && kandidaat !== undefined);
  if (fout === undefined) return null;

  const geweigerd = geenToegangZin(fout);
  if (geweigerd) {
    return (
      <div className="mt-4">
        <Aandachtsmelding>{geweigerd}</Aandachtsmelding>
      </div>
    );
  }

  return <Strook>{fout instanceof ApiError && fout.detail ? fout.detail : t("periode.mislukt")}</Strook>;
}

function Strook({ children }: { children: string }) {
  return (
    <p className="mt-4 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
      {children}
    </p>
  );
}
