import { weeknummer } from "../../lib/datum";

/**
 * The ISO week the days in view make up, or null when they are not one week.
 *
 * Null in the month view, where the heading already names the month and one number over five weeks
 * would name only the first. Null too in a phone's three-day window when it starts on a Saturday or a
 * Sunday and so reaches into the next week: "Week 37" over a Monday of week 38 is the month's mistake
 * at a smaller scale. The day view is one day and the desktop week runs Monday to Sunday, so both are
 * always exactly one week.
 */
export function weekInBeeld(weergave: string, van: string, tot: string): number | null {
  if (weergave === "maand") return null;

  const nummer = weeknummer(van);
  return nummer === weeknummer(tot) ? nummer : null;
}
