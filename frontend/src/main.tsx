import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Typefaces, **self-hosted** — bundled by Vite from npm, never fetched from a font CDN. A third-party CDN
 * would leak every visitor's IP to it on page load, which is exactly the kind of processing Art. VI.2 and
 * the GDPR posture rule out for a school tool.
 *
 * IBM Plex Sans (variable) for the interface and IBM Plex Mono for leerplandoel codes: one superfamily, so
 * they agree by construction. Chosen over Inter — the face every product defaults to — because Plex was
 * drawn for institutional and technical interfaces and its **tabular numerals** are unusually good, and
 * this app is largely dates, week counts and goal codes in columns.
 */
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";

import App from "./App.tsx";
import "./index.css";

// TanStack Query owns server state (ADR-0014). One client for the app.
const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
