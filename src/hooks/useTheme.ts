import { useEffect, useState } from "react";
import { readJson, writeJson, THEME_KEY } from "@/lib/storage";

type ThemeMode = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readJson<ThemeMode>(THEME_KEY, "light"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeJson(THEME_KEY, theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
  };
}
