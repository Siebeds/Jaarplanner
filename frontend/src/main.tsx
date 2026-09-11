import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// For its side effect: it applies the stored light/dark choice and keeps the browser's theme-color in
// step, and that has to happen at startup rather than when Instellingen is first opened.
import "./state/weergave";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
