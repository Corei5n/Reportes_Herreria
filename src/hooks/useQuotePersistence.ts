import { useEffect, useState } from "react";
import { readJson, removeKey, writeJson, STORAGE_KEY } from "@/lib/storage";
import { createDefaultQuote } from "@/lib/defaults";
import { type QuoteFormValues } from "@/lib/quote-types";

type SavedQuote = {
  values: QuoteFormValues;
  savedAt: string;
};

export function useQuotePersistence() {
  const [initialValues, setInitialValues] = useState<QuoteFormValues>(() => {
    const saved = readJson<SavedQuote | null>(STORAGE_KEY, null);
    return saved?.values ?? createDefaultQuote();
  });
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => readJson<SavedQuote | null>(STORAGE_KEY, null)?.savedAt ?? null);

  useEffect(() => {
    const saved = readJson<SavedQuote | null>(STORAGE_KEY, null);
    if (saved) {
      setInitialValues(saved.values);
      setLastSavedAt(saved.savedAt);
    }
  }, []);

  const saveDraft = (values: QuoteFormValues) => {
    const savedAt = new Date().toISOString();
    writeJson(STORAGE_KEY, { values, savedAt } satisfies SavedQuote);
    setLastSavedAt(savedAt);
  };

  const clearDraft = () => {
    removeKey(STORAGE_KEY);
    setInitialValues(createDefaultQuote());
    setLastSavedAt(null);
  };

  return { initialValues, lastSavedAt, saveDraft, clearDraft };
}
