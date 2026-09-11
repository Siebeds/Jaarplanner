import { IcoonAfmelden } from "../components/Iconen";
import { t } from "../i18n";
import { useAfmelden, useIk } from "../lib/aanmelding";
import { cn } from "../lib/cn";

/**
 * Who is signed in, and the way out (E6-01).
 *
 * **Quiet on purpose.** Signing out is none of the accent's five uses, and a teacher does it once a
 * day at most, so the name is ink, the control is a `stil` text button, and the row sits below
 * everything a teacher does all year: under Instellingen in the sidebar, at the foot of Instellingen
 * on a phone. One of the two per viewport, never both.
 *
 * **Nothing while the person is not known yet.** A pending query draws nothing rather than a
 * placeholder name, and a 401 has already sent the browser to the sign-in by the time the query
 * fails (`aanmeldOmleiding`), so there is no error state to design for here.
 *
 * `smal` is the 56px rail beside a second column: the name goes, like every label in the rail, and
 * the control keeps the name in its accessible label so nobody signs out as someone they cannot see.
 */
export function Aanmeldregel({ smal = false, className }: { smal?: boolean; className?: string }) {
  const ik = useIk();
  const afmelden = useAfmelden();

  if (!ik.data) return null;

  const naam = ik.data.naam;
  const fout = afmelden.isError ? (
    <p role="alert" className="px-3 pt-1 text-meta text-gevaar">
      {t("aanmelding.afmeldenMislukt")}
    </p>
  ) : null;

  if (smal) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => afmelden.mutate()}
          disabled={afmelden.isPending}
          aria-label={t("aanmelding.afmeldenAls", { naam })}
          title={t("aanmelding.afmeldenAls", { naam })}
          className="flex min-h-11 w-full items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak hover:text-inkt disabled:opacity-45"
        >
          <IcoonAfmelden aria-hidden="true" className="h-5 w-5 shrink-0" />
        </button>
        {fout}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex min-h-11 items-center gap-2 pl-3">
        {/* The full name on hover, for a name the column cuts off. The row is not the only place it
            can be read: it is also the accessible name of the rail's control above. */}
        <p title={naam} className="min-w-0 flex-1 truncate text-meta font-medium text-inkt">
          {naam}
        </p>
        <button
          type="button"
          onClick={() => afmelden.mutate()}
          disabled={afmelden.isPending}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-veld px-2.5 text-meta font-medium text-inkt-zacht",
            "transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt disabled:opacity-45",
          )}
        >
          <IcoonAfmelden aria-hidden="true" className="h-4 w-4 shrink-0" />
          {t("aanmelding.afmelden")}
        </button>
      </div>
      {fout}
    </div>
  );
}
