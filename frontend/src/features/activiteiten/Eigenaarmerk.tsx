import { IcoonPersoon } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { isEigenVan } from "../../lib/rechten";
import { useIk } from "../../lib/aanmelding";

/**
 * Whose an own activiteit is (ADR-0049): "Eigen" on one's own, "Van An" on a colleague's, nothing on a shared one.
 *
 * **No hue.** Colour in this app is spoken for (doelsoort, status, dekking, one accent), and ownership is not a state a
 * teacher acts on at a glance. So it is a small person mark beside a word, in the muted ink the soort line already
 * uses: the word carries it, the mark lets a scanning eye find it (never colour alone, WCAG 2.2 AA).
 */
export function Eigenaarmerk({
  activiteit,
  className,
}: {
  activiteit: { eigenaarId?: string | null; eigenaarNaam?: string | null };
  className?: string;
}) {
  const { data: ik } = useIk();
  if (activiteit.eigenaarId == null) return null;

  const tekst = isEigenVan(ik, activiteit)
    ? t("activiteit.eigen")
    : activiteit.eigenaarNaam
      ? t("activiteit.vanCollega", { naam: activiteit.eigenaarNaam })
      : t("activiteit.vanEenCollega");

  return (
    <span className={cn("inline-flex items-center gap-1 text-meta text-inkt-zacht", className)}>
      <IcoonPersoon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {tekst}
    </span>
  );
}
