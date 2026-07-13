import { useEffect, useMemo, useState } from "react";
import {
  clearLegacyDraft,
  createNewQuoteRecord,
  loadQuoteLibrary,
  persistQuoteLibrary,
  quoteTitleFromValues,
  updateRecord,
  type QuoteLibraryState
} from "@/lib/quote-library";
import { createDefaultQuote } from "@/lib/defaults";
import { type QuoteFormValues } from "@/lib/quote-types";

export function useQuoteLibrary() {
  const [state, setState] = useState<QuoteLibraryState>(() => loadQuoteLibrary());

  useEffect(() => {
    persistQuoteLibrary(state);
  }, [state]);

  useEffect(() => {
    clearLegacyDraft();
  }, []);

  const activeQuote = useMemo(
    () => state.quotes.find((quote) => quote.id === state.activeQuoteId) ?? state.quotes[0],
    [state.activeQuoteId, state.quotes]
  );

  const setActiveQuoteId = (id: string) => {
    setState((current) => ({ ...current, activeQuoteId: id }));
  };

  const saveActiveQuote = (values: QuoteFormValues) => {
    setState((current) => {
      const index = current.quotes.findIndex((quote) => quote.id === current.activeQuoteId);
      if (index === -1) return current;

      const updatedQuotes = current.quotes.map((quote) =>
        quote.id === current.activeQuoteId ? updateRecord(quote, values) : quote
      );
      return {
        ...current,
        quotes: updatedQuotes
      };
    });
  };

  const createQuote = (values?: QuoteFormValues, title?: string) => {
    const record = createNewQuoteRecord(values ?? createDefaultQuote(), title);
    setState((current) => ({
      activeQuoteId: record.id,
      quotes: [record, ...current.quotes]
    }));
    return record.id;
  };

  const duplicateQuote = (values: QuoteFormValues) => {
    const duplicateTitle = `${quoteTitleFromValues(values)} - copia`;
    return createQuote(values, duplicateTitle);
  };

  const deleteQuote = (id: string) => {
    setState((current) => {
      const remaining = current.quotes.filter((quote) => quote.id !== id);
      if (!remaining.length) {
        const newRecord = createNewQuoteRecord(createDefaultQuote());
        return {
          activeQuoteId: newRecord.id,
          quotes: [newRecord]
        };
      }

      const nextActiveId = current.activeQuoteId === id ? remaining[0].id : current.activeQuoteId;
      return {
        activeQuoteId: nextActiveId,
        quotes: remaining
      };
    });
  };

  const renameQuote = (id: string, title: string) => {
    setState((current) => ({
      ...current,
      quotes: current.quotes.map((quote) =>
        quote.id === id ? { ...quote, title: title.trim() || quote.title, updatedAt: new Date().toISOString() } : quote
      )
    }));
  };

  return {
    quotes: state.quotes,
    activeQuote,
    setActiveQuoteId,
    saveActiveQuote,
    createQuote,
    duplicateQuote,
    deleteQuote,
    renameQuote
  };
}
