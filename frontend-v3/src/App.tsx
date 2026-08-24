import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Schil } from "./app/Schil";
import { DoelenScherm } from "./features/doelen/DoelenScherm";
import { ThemasScherm } from "./features/themas/ThemasScherm";
import { ThemadetailScherm } from "./features/themas/ThemadetailScherm";
import { PlanScherm } from "./features/plan/PlanScherm";
import { DekkingScherm } from "./features/dekking/DekkingScherm";

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
            <Route index element={<Navigate to="/doelen" replace />} />
            <Route path="doelen" element={<DoelenScherm />} />
            <Route path="themas" element={<ThemasScherm />} />
            <Route path="themas/:themaId" element={<ThemadetailScherm />} />
            <Route path="plan" element={<PlanScherm />} />
            <Route path="dekking" element={<DekkingScherm />} />
            <Route path="*" element={<Navigate to="/doelen" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
