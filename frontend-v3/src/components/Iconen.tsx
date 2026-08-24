import type { SVGProps } from "react";

/**
 * Hand-drawn icon set, one geometry for all of them: a 24 grid, 1.6 stroke, round caps and joins,
 * no fills. Drawn here rather than pulled from a set so the four destination marks can say what
 * this app's four destinations actually are, instead of what a generic set happens to offer.
 *
 * Every icon is decorative: it always sits beside its own label, so it is hidden from assistive
 * technology and the label carries the meaning.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icoon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Doelen: a target. The thing every other screen is measured against. */
export function IcoonDoelen(props: IconProps) {
  return (
    <Icoon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Icoon>
  );
}

/** Thema's: stacked sheets. A thema is a stack of subthema's and activiteiten. */
export function IcoonThemas(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M4 8.5 12 4.5l8 4-8 4z" />
      <path d="M4 12.5 12 16.5l8-4" />
      <path d="M4 16.5 12 20.5l8-4" />
    </Icoon>
  );
}

/** Plan: a year band with one period marked. The signature of this app, at 24px. */
export function IcoonPlan(props: IconProps) {
  return (
    <Icoon {...props}>
      <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
      <path d="M3 10.5h18" />
      <path d="M9.5 13.5h5" strokeWidth={2.6} />
      <path d="M7.5 4.5v3M16.5 4.5v3" />
    </Icoon>
  );
}

/** Dekking: three bars at different heights. Coverage is a measurement, not a badge. */
export function IcoonDekking(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M5.5 19.5V13" strokeWidth={2.4} />
      <path d="M12 19.5V6.5" strokeWidth={2.4} />
      <path d="M18.5 19.5v-4" strokeWidth={2.4} />
    </Icoon>
  );
}

export function IcoonZoek(props: IconProps) {
  return (
    <Icoon {...props}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="m15.6 15.6 3.4 3.4" />
    </Icoon>
  );
}

export function IcoonFilter(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </Icoon>
  );
}

export function IcoonKruis(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Icoon>
  );
}

export function IcoonPijlRechts(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Icoon>
  );
}

/** Rotated by the caller to point down or up; one shape, so the rotation reads as a state change. */
export function IcoonChevron(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icoon>
  );
}
