import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/** The nine codes `/api/jaarfasen` serves, in its order. */
export const ALLE_JAARFASEN = ["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"];

/**
 * Renders `ui` under a query client that already holds the jaarfasen, for a component that reads them with
 * `useJaarfasen` and is otherwise tested without a server (the thema form, FB-012).
 */
export function renderMetJaarfasen(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["jaarfasen"], ALLE_JAARFASEN);
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
