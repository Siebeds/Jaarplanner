import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useThemabibliotheek } from "../../lib/queries";
import { periode as periodeTekst } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The thema's a teacher can put into one period, by hand (FR-7.1).
 *
 * Thema's already in this period are shown rather than hidden, marked and disabled. Hiding them
 * would make the list change length between two periods for no visible reason, and a teacher
 * looking for a thema they know exists would conclude it had been deleted.
 */
export function Themakiezer({
  blokStart,
  blokEind,
  reedsGepland,
  bezig,
  onKies,
  onSluit,
}: {
  blokStart: string | null;
  blokEind: string | null;
  reedsGepland: Set<string>;
  bezig: boolean;
  onKies: (themaId: string) => void;
  onSluit: () => void;
}) {
  const { data, isPending } = useThemabibliotheek();

  return (
    <Blad
      open={blokStart !== null}
      onOpenChange={(open) => !open && onSluit()}
      titel={blokStart ? periodeTekst(blokStart, blokEind) : t("plan.kiesThema")}
    >
      {isPending ? (
        <Laadlijst rijen={5} />
      ) : !data || data.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("plan.geenThemas")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.map((thema) => {
            const staatErAl = reedsGepland.has(thema.id);
            return (
              <li key={thema.id}>
                <button
                  type="button"
                  disabled={bezig || staatErAl}
                  onClick={() => onKies(thema.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-veld border px-3 py-2.5 text-left transition-colors duration-150",
                    staatErAl
                      ? "cursor-default border-lijn bg-vlak text-inkt-zwak"
                      : "border-lijn bg-kaart hover:border-accent disabled:opacity-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body text-inkt">{thema.naam}</span>
                    <span className="mono block text-[0.625rem] text-inkt-zwak">
                      {telWoord(thema.duurWeken, "themas.eenWeek", "themas.weken")} ·{" "}
                      {telWoord(thema.themadoelen.length, "themas.eenDoel", "themas.doelen")}
                    </span>
                  </span>
                  {staatErAl ? (
                    <span className="shrink-0 text-[0.6875rem] font-medium text-inkt-zwak">{t("plan.alGepland")}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Blad>
  );
}
