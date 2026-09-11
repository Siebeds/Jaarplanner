import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Schil } from "./app/Schil";
import { DoelenScherm } from "./features/doelen/DoelenScherm";
import { ThemasScherm } from "./features/themas/ThemasScherm";
import { ThemadetailScherm } from "./features/themas/ThemadetailScherm";
import { PlanScherm } from "./features/plan/PlanScherm";
import { Agendascherm } from "./features/plan/Agendascherm";
import { DekkingScherm } from "./features/dekking/DekkingScherm";
import { ImportScherm } from "./features/import/ImportScherm";
import { Instellingenindeling } from "./features/instellingen/Instellingenindeling";
import { KlassenScherm } from "./features/instellingen/KlassenScherm";
import { HoekenScherm } from "./features/instellingen/HoekenScherm";
import { AlgemeneFichesScherm } from "./features/instellingen/AlgemeneFichesScherm";
import { ONDERDELEN, type Deel } from "./features/instellingen/onderdelen";
import type { ComponentType } from "react";

/**
 * The screen behind each part of Instellingen. A `Record` over the parts' own type, so a part added
 * to `ONDERDELEN` without a screen here is a type error rather than a link that falls into `*`.
 */
const INSTELLINGEN: Record<Deel, ComponentType> = {
  klassen: KlassenScherm,
  hoeken: HoekenScherm,
  "algemene-fiches": AlgemeneFichesScherm,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reference data changes when someone runs an import, not while a teacher browses. Plan and
      // dekking are refetched by their own mutations rather than by a shorter stale time.
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Schil />}>
            {/* The app opens on the agenda (owner, 2026-09-11: "ik wil niet dat er default doelen
                wordt geopend"), and an address it does not know lands there too, below. */}
            <Route index element={<Navigate to="/agenda" replace />} />
            <Route path="doelen" element={<DoelenScherm />} />
            <Route path="themas" element={<ThemasScherm />} />
            <Route path="themas/:themaId" element={<ThemadetailScherm />} />
            <Route path="agenda" element={<Agendascherm />} />
            <Route path="agenda/dag/:datum" element={<Agendascherm />} />
            <Route path="agenda/periodes" element={<PlanScherm />} />
            <Route path="dekking" element={<DekkingScherm />} />
            {/* A frame with parts, each at its own address (owner, 2026-09-11). The bare address
                opens the first part, so the navigation item and every old link still land somewhere. */}
            <Route path="instellingen" element={<Instellingenindeling />}>
              <Route index element={<Navigate to={ONDERDELEN[0].deel} replace />} />
              {ONDERDELEN.map(({ deel }) => {
                const Scherm = INSTELLINGEN[deel];
                return <Route key={deel} path={deel} element={<Scherm />} />;
              })}
            </Route>
            {/* Not in the bottom bar: see the note in ImportScherm. Reached from Doelen and Thema's. */}
            <Route path="inladen" element={<ImportScherm />} />
            <Route path="*" element={<Navigate to="/agenda" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
