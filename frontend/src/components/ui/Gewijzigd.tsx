import { t } from "../../i18n";

/**
 * "gewijzigd" beside a label: a field differs from what was saved (FB-061).
 *
 * A word, not a dot: the marker has to be read, and a coloured dot alone would say nothing (WCAG 2.2 AA).
 */
export function Gewijzigd() {
  return <span className="text-micro font-medium normal-case tracking-normal text-inkt-zacht">{t("algemeen.gewijzigd")}</span>;
}
