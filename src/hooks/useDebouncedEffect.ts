import { useEffect, useRef } from "react";

export function useDebouncedEffect(effect: () => void, deps: readonly unknown[], delay = 400): void {
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    const timeout = window.setTimeout(() => effectRef.current(), delay);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
