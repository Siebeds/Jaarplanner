/**
 * The Jaarplanner mark: unequal bars with a gap — a school year as a stretch of teaching
 * time broken by a vakantie.
 *
 * Deliberately **not** a calendar page or a checkmark. A uniform month grid is the one
 * picture ADR-0013 and the approved E3-10 wireframe refuse, so the app's own mark should
 * not draw one either. Same shape as `public/favicon.svg`, at UI scale.
 *
 * `aria-hidden` because the wordmark beside it already says "Jaarplanner"; announcing it
 * twice is noise for a screen-reader user.
 */
export function Merkteken({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <g fill="hsl(var(--petrol-wash))">
        <rect x="6" y="9" width="7" height="14" rx="1.75" />
        <rect x="15" y="9" width="4" height="14" rx="1.75" />
        {/* the gap between 19 and 22 is the vakantie: a period never runs through it */}
        <rect x="22" y="9" width="4" height="14" rx="1.75" />
      </g>
    </svg>
  );
}
