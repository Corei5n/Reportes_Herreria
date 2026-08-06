import { createDefaultQuote } from "@/lib/defaults";
import { COMPANY_PROFILE } from "@/lib/company-profile";
import { generateQuoteFolio } from "@/lib/folio";
import { nanoid } from "@/lib/nanoid";
import { readJson, writeJson, removeKey } from "@/lib/storage";
import { type QuoteFormValues } from "@/lib/quote-types";

export const QUOTE_LIBRARY_KEY = "cotizador-mx-quote-library-v1";
export const LEGACY_DRAFT_KEY = "cotizador-mx-draft";

export type SavedQuoteRecord = {
  id: string;
  title: string;
  values: QuoteFormValues;
  createdAt: string;
  updatedAt: string;
};

export type QuoteLibraryState = {
  activeQuoteId: string;
  quotes: SavedQuoteRecord[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function textOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

function companyNameOrFallback(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return COMPANY_PROFILE.name;
  if (trimmed.toLowerCase() === "herreria moderna") return COMPANY_PROFILE.name;
  return trimmed;
}

export function normalizeQuoteValues(values: QuoteFormValues): QuoteFormValues {
  const fallback = createDefaultQuote();
  return {
    ...fallback,
    ...values,
    empresa: textOrFallback(values.empresa, ""),
    anticipoPorcentaje: values.anticipoPorcentaje ?? fallback.anticipoPorcentaje,
    tiempoEntregaDias: values.tiempoEntregaDias ?? fallback.tiempoEntregaDias,
    garantiaDias: values.garantiaDias ?? fallback.garantiaDias,
    vigenciaDias: values.vigenciaDias ?? fallback.vigenciaDias,
    notas: textOrFallback(values.notas, ""),
    obraDireccion: textOrFallback(values.obraDireccion, ""),
    logoDataUrl: values.logoDataUrl ?? "",
    companiaNombre: companyNameOrFallback(values.companiaNombre),
    companiaTelefono: textOrFallback(values.companiaTelefono, COMPANY_PROFILE.phone),
    companiaDireccion: textOrFallback(values.companiaDireccion, COMPANY_PROFILE.workshopAddress),
    ivaActivo: typeof values.ivaActivo === "boolean" ? values.ivaActivo : fallback.ivaActivo
  };
}

export function quoteTitleFromValues(values: QuoteFormValues): string {
  const client = values.cliente.trim();
  const quoteNumber = values.numeroCotizacion.trim();
  if (client && quoteNumber) return `${client} · ${quoteNumber}`;
  if (client) return client;
  if (quoteNumber) return quoteNumber;
  return "Cotización nueva";
}

function createRecord(values?: QuoteFormValues, title?: string): SavedQuoteRecord {
  const timestamp = nowIso();
  const resolvedValues = normalizeQuoteValues(values ?? createDefaultQuote());
  return {
    id: nanoid(),
    title: title?.trim() || quoteTitleFromValues(resolvedValues),
    values: {
      ...resolvedValues,
      numeroCotizacion: generateQuoteFolio()
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function loadQuoteLibrary(): QuoteLibraryState {
  const saved = readJson<QuoteLibraryState | null>(QUOTE_LIBRARY_KEY, null);
  if (saved?.quotes?.length) {
    return saved;
  }

  const legacyDraft = readJson<{ values: QuoteFormValues; savedAt: string } | null>(LEGACY_DRAFT_KEY, null);
  if (legacyDraft?.values) {
    const record = createRecord(legacyDraft.values);
    return {
      activeQuoteId: record.id,
      quotes: [record]
    };
  }

  const record = createRecord();
  return {
    activeQuoteId: record.id,
    quotes: [record]
  };
}

export function persistQuoteLibrary(state: QuoteLibraryState): void {
  writeJson(QUOTE_LIBRARY_KEY, state);
}

export function clearLegacyDraft(): void {
  removeKey(LEGACY_DRAFT_KEY);
}

export function createNewQuoteRecord(values?: QuoteFormValues, title?: string): SavedQuoteRecord {
  return createRecord(values, title);
}

export function updateRecord(record: SavedQuoteRecord, values: QuoteFormValues): SavedQuoteRecord {
  return {
    ...record,
    title: quoteTitleFromValues(values),
    values: normalizeQuoteValues(values),
    updatedAt: nowIso()
  };
}
