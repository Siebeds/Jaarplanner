import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// For its side effect: it applies the stored light/dark choice and keeps the browser's theme-color in
// step, and that has to happen at startup rather than when Instellingen is first opened.
import "./state/weergave";
import App from "./App";

async function start() {
  // Mock mode (TB-046): the API is answered in the page. In any other mode this condition is a constant false, so a
  // production build drops the import and the mock data with it.
  if (import.meta.env.MODE === "mock") {
    const { startMock } = await import("./mocks/start");
    startMock();
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
