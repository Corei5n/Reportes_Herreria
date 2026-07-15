import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

const APP_VERSION = "2026-07-15-5";
const APP_VERSION_KEY = "cotizador-mx-app-version";

async function cleanupStaleCache() {
  if (typeof window === "undefined") return;

  const storedVersion = window.localStorage.getItem(APP_VERSION_KEY);
  if (storedVersion === APP_VERSION) return;

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    window.localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  } catch (error) {
    console.error("No se pudo limpiar la caché antigua de la PWA:", error);
  }
}

await cleanupStaleCache();

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
