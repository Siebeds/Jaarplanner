import { Badge } from "./ui/badge";
import { t } from "../i18n";

/**
 * Sample design-system component (E0-09 acceptance criterion: "a sample component
 * renders from the design tokens"). Renders an Op.stap doelsoort as a coloured badge
 * whose colour comes entirely from the doelsoort design tokens (via the Badge
 * variant → tailwind.config.js → CSS variables in index.css).
 *
 * Accessibility (WCAG 2.2 AA, ADR-0017 §4): colour is never the only signal — the
 * badge always shows the doelsoort abbreviation (MD / G / + / …) and exposes the full
 * Dutch label as an accessible name, both sourced from nl.json via `t()` (Art. II.3).
 */
export type Doelsoort =
  | "md"
  | "gemeenschappelijk"
  | "verdieping"
  | "precurriculum"
  | "specifiek"
  | "anderstalige";

export interface DoelsoortBadgeProps {
  doelsoort: Doelsoort;
}

export function DoelsoortBadge({ doelsoort }: DoelsoortBadgeProps) {
  const afkorting = t(`doelsoortAfkorting.${doelsoort}`);
  const label = t(`doelsoort.${doelsoort}`);

  return (
    <Badge variant={doelsoort} aria-label={label} title={label}>
      {afkorting}
    </Badge>
  );
}
