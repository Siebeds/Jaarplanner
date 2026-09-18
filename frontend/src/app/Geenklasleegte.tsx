import { Leegte } from "../components/ui/Leegte";
import { useRechten } from "../lib/rechten";
import { t } from "../i18n";

/**
 * The empty state of a screen about one klas when none is chosen (FB-013, ADR-0040).
 *
 * For a gebruiker who holds no relation that opens any klas (Z4), the screen's own "kies eerst een klas" would send them
 * to a klaskiezer with nothing in it, so it says why instead. It waits for `/api/ik` (`bekend`), so a failed answer
 * never tells admin they have no right. Anyone else gets the screen's own title.
 */
export function Geenklasleegte({ titel }: { titel: string }) {
  const { mag, bekend } = useRechten();

  if (bekend && mag.geenKlasInzien) {
    return (
      <Leegte
        titel={t("context.geenInzageTitel")}
        actie={<p className="text-meta text-inkt-zacht">{t("context.geenInzage")}</p>}
      />
    );
  }

  return <Leegte titel={titel} />;
}
