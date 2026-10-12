import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Capacitor } from "@capacitor/core";
import "./index.css";

// Register the app-shell worker for installability. Authentication and API traffic are never cached.
if (
  !Capacitor.isNativePlatform() &&
  "serviceWorker" in navigator &&
  import.meta.env.PROD &&
  (window.location.protocol === "https:" || window.location.protocol === "http:")
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("App shell registration was skipped:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <App />
);
