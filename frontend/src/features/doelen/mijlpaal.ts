import type { Vertaalsleutel } from "../../i18n";

/**
 * The name of a minimumdoel's mijlpaal (its leeftijd code), shared by the mijlpaal chips and the minimumdoel detail so one
 * mijlpaal has one name on the screen (TB-010). An unknown code has no entry and is shown as the server sent it.
 */
export const MIJLPAAL: Record<string, Vertaalsleutel> = {
  "K-": "minimumdoel.mijlpaalK",
  "4-": "minimumdoel.mijlpaal4",
  "6-": "minimumdoel.mijlpaal6",
};
