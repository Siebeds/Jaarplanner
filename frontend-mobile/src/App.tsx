import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DoelenListPage } from "./features/doelen/DoelenListPage";
import { DoelDetailPage } from "./features/doelen/DoelDetailPage";
import { ThemasListPage } from "./features/themas/ThemasListPage";
import { ThemaDetailPage } from "./features/themas/ThemaDetailPage";
import { KalenderPage } from "./features/kalender/KalenderPage";
import { DekkingPage } from "./features/dekking/DekkingPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/doelen" replace />} />
            <Route path="doelen" element={<DoelenListPage />} />
            <Route path="doelen/:code" element={<DoelDetailPage />} />
            <Route path="themas" element={<ThemasListPage />} />
            <Route path="themas/:id" element={<ThemaDetailPage />} />
            <Route path="kalender" element={<KalenderPage />} />
            <Route path="dekking" element={<DekkingPage />} />
            <Route path="*" element={<Navigate to="/doelen" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
