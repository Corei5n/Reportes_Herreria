export function findFirstErrorPath(value: unknown, prefix = ""): string | null {
  if (!value || typeof value !== "object") return null;

  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && "message" in child) {
      return path;
    }
    const nested = findFirstErrorPath(child, path);
    if (nested) return nested;
  }

  return null;
}
