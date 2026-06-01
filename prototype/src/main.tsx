import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Marca de build para invalidar el caché de assets de Safari (cache-bust).
(window as unknown as { __EDUPLOP_BUILD__: string }).__EDUPLOP_BUILD__ = "2026-06-01-1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
