const GETAL = new Intl.NumberFormat("nl-BE");

/** "5.835": a first Op.stap import counts in thousands, and a Dutch reader groups them with a dot. */
export function getal(aantal: number): string {
  return GETAL.format(aantal);
}
