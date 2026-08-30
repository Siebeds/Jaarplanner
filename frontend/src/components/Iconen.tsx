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

/**
 * Instellingen: two rails with a knob on each, not a cog.
 *
 * A cog says "machinery", and nothing behind this destination is machinery: it is where the school
 * states what its klassen are. Rails set to different positions say "these are the values you set
 * here", which is what the screen does.
 */
export function IcoonInstellingen(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M4 8.5h16M4 15.5h16" />
      <circle cx="9.5" cy="8.5" r="2.25" />
      <circle cx="15" cy="15.5" r="2.25" />
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

export function IcoonPlus(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M12 6v12M6 12h12" />
    </Icoon>
  );
}

/**
 * Bewerken: a pencil. The owner's word for it is "penseeltje" (2026-08-30) and it is drawn as a
 * pencil rather than a brush, because a brush at 16 pixels is a smudge on a stick and every other
 * tool this teacher uses spells "edit" this way.
 */
export function IcoonPotlood(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M5 19l.9-3.6 9.2-9.2a1.9 1.9 0 0 1 2.7 2.7L8.6 18.1 5 19z" />
      <path d="M14.2 7.1l2.7 2.7" />
    </Icoon>
  );
}

/** Verwijderen: a bin. Its colour, and why it only wears it on hover, is `--color-gevaar`. */
export function IcoonVuilbak(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.6 7l.8 11.3a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.4 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Icoon>
  );
}

/** Done: a tick. Always beside the word it reinforces, never carrying the state on its own. */
export function IcoonVink(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Icoon>
  );
}

/** Rotated by the caller to point the other way; one shape, so the direction reads as a direction. */
export function IcoonPijlLinks(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
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

/** A drag handle: two short rules, the universal "this row can be picked up". */
export function IcoonGreep(props: IconProps) {
  return (
    <Icoon {...props}>
      <path d="M5 9.5h14M5 14.5h14" />
    </Icoon>
  );
}
