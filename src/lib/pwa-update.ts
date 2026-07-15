export const APP_VERSION = "2026-07-15-7";
export const APP_VERSION_KEY = "cotizador-mx-app-version";

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

    window.localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  } catch (error) {
    console.error("No se pudo reparar la caché de la PWA:", error);
  } finally {
    window.location.reload();
  }
}

export async function cleanupStalePwaCache(): Promise<void> {
  if (typeof window === "undefined") return;

  const storedVersion = window.localStorage.getItem(APP_VERSION_KEY);
  if (storedVersion === APP_VERSION) return;

  await repairPwaApp();
}
