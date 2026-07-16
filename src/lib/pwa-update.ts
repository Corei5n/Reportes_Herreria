export const APP_VERSION = "2026-07-15-8";
export const APP_VERSION_KEY = "cotizador-mx-app-version";
export const APP_UPDATED_AT_KEY = "cotizador-mx-app-updated-at";

function nowIso(): string {
  return new Date().toISOString();
}

export function getPwaUpdatedAtLabel(): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(APP_UPDATED_AT_KEY);
  if (!stored) return "";

  const date = new Date(stored);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function touchPwaVersion(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  window.localStorage.setItem(APP_UPDATED_AT_KEY, nowIso());
}

export async function repairPwaApp(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.error("No se pudo reparar la caché de la PWA:", error);
  } finally {
    touchPwaVersion();
    window.location.reload();
  }
}

export async function cleanupStalePwaCache(): Promise<void> {
  if (typeof window === "undefined") return;

  const storedVersion = window.localStorage.getItem(APP_VERSION_KEY);
  if (storedVersion !== APP_VERSION) {
    await repairPwaApp();
    return;
  }

  if (!window.localStorage.getItem(APP_UPDATED_AT_KEY)) {
    touchPwaVersion();
  }
}
