/** The order codes and refs are read in: 1.2, 1.10, not 1.10, 1.2. */
export function opCode(a: string, b: string): number {
  return a.localeCompare(b, "nl", { numeric: true });
}
