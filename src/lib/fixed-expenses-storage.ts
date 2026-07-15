import { readJson, writeJson } from "@/lib/storage";
import { createDefaultFixedExpensesState, normalizeFixedExpensesState, type FixedExpensesState } from "@/lib/fixed-expenses";

export const FIXED_EXPENSES_STORAGE_KEY = "cotizador-mx-fixed-expenses-v1";

export function loadFixedExpensesState(): FixedExpensesState {
  return normalizeFixedExpensesState(readJson<unknown>(FIXED_EXPENSES_STORAGE_KEY, createDefaultFixedExpensesState()));
}

export function persistFixedExpensesState(state: FixedExpensesState): void {
  writeJson(FIXED_EXPENSES_STORAGE_KEY, normalizeFixedExpensesState(state));
}
