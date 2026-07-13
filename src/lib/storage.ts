export const STORAGE_KEY = "cotizador-mx-draft";
export const THEME_KEY = "cotizador-mx-theme";

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  window.localStorage.removeItem(key);
}
