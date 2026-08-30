/** How a subthema's activiteiten are laid out over the teaching days a teacher picked. */
export type Verdeling = "achterElkaar" | "verspreid";

/**
 * Which of the available teaching days each of `aantal` activiteiten gets.
 *
 * A pure function with its own test, because this is the part of the sheet that can be wrong without
 * looking wrong: a preview of five plausible dates is exactly what a proposal that puts two
 * activiteiten on the same day also looks like, and the server takes one per day per plan.
 *
 * "Achter elkaar" takes the first days. "Verspreid" walks the whole window in equal steps, so the
 * first activiteit lands on the first day and the last one on the last: with both ends of the window
 * chosen by the teacher, spreading has to reach the end they picked rather than stop near it.
 *
 * Never returns more days than there are, and never the same day twice. Rounding cannot collide:
 * the step is at least 1 whenever the count fits, which is the only case it is asked about.
 */
export function verdeelDagen(beschikbaar: string[], aantal: number, verdeling: Verdeling): string[] {
  const n = Math.min(aantal, beschikbaar.length);
  if (n <= 0) return [];
  if (verdeling === "achterElkaar" || n === 1) return beschikbaar.slice(0, n);

  const laatste = beschikbaar.length - 1;
  return Array.from({ length: n }, (_, i) => beschikbaar[Math.round((i * laatste) / (n - 1))]);
}
