import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.tsx";
import { ThemeSync } from "./components/ThemeSync.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeSync />
    <App />
  </StrictMode>,
);
