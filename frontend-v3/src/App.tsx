import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Schil } from "./app/Schil";
import { NogNietGebouwd } from "./app/NogNietGebouwd";
import { DoelenScherm } from "./features/doelen/DoelenScherm";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reference data that changes when someone runs an import, not while a teacher browses.
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
            <Route path="themas" element={<NogNietGebouwd titelSleutel="navigatie.themas" />} />
            <Route path="plan" element={<NogNietGebouwd titelSleutel="navigatie.plan" />} />
            <Route path="dekking" element={<NogNietGebouwd titelSleutel="navigatie.dekking" />} />
            <Route path="*" element={<Navigate to="/doelen" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
