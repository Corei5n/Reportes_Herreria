import { z } from "zod";
import { nanoid } from "@/lib/nanoid";

export const fixedExpenseCategories = ["Servicios", "Créditos", "Gasolina", "Otros"] as const;

export const fixedExpenseFrequencies = ["Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual"] as const;

export type FixedExpenseCategoryOption = (typeof fixedExpenseCategories)[number];
export type FixedExpenseFrequency = (typeof fixedExpenseFrequencies)[number];

export const fixedExpenseFrequencyLabels: Record<FixedExpenseFrequency, string> = {
  Semanal: "Semanal",
  Quincenal: "Quincenal",
  Mensual: "Mensual",
  Bimestral: "Bimestral",
  Trimestral: "Trimestral",
  Semestral: "Semestral",
  Anual: "Anual"
};

const monthlyFactors: Record<FixedExpenseFrequency, number> = {
  Semanal: 52 / 12,
  Quincenal: 24 / 12,
  Mensual: 1,
  Bimestral: 1 / 2,
  Trimestral: 1 / 3,
  Semestral: 1 / 6,
  Anual: 1 / 12
};

const fromMonthlyFactors: Record<FixedExpenseFrequency, number> = {
  Semanal: 12 / 52,
  Quincenal: 12 / 24,
  Mensual: 1,
  Bimestral: 2,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12
};

function isFixedExpenseCategory(value: unknown): value is FixedExpenseCategoryOption {
  return typeof value === "string" && (fixedExpenseCategories as readonly string[]).includes(value);
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toMonthlyAmount(amount: number, frequency: FixedExpenseFrequency): number {
  return roundMoney(Number(amount || 0) * monthlyFactors[frequency]);
}

export function fromMonthlyAmount(monthlyAmount: number, frequency: FixedExpenseFrequency): number {
  return roundMoney(Number(monthlyAmount || 0) * fromMonthlyFactors[frequency]);
}

export type FixedExpenseItem = {
  id: string;
  concepto: string;
  categoria: FixedExpenseCategoryOption;
  categoriaPersonalizada: string;
  importe?: number;
  frecuencia: FixedExpenseFrequency;
  fechaPago: string;
  notas: string;
};

export type FixedExpensesState = {
  nombreDelHogar: string;
  ingresoMensual?: number;
  gastos: FixedExpenseItem[];
};

export function resolveExpenseCategory(expense: Pick<FixedExpenseItem, "categoria" | "categoriaPersonalizada"> | Partial<FixedExpenseItem>): string {
  if (expense.categoria === "Otros") {
    const custom = (expense.categoriaPersonalizada ?? "").trim();
    return custom || "Otros";
  }
  return isFixedExpenseCategory(expense.categoria) ? expense.categoria : "Otros";
}

export function getPrimaryExpenseCategory(expense: Pick<FixedExpenseItem, "categoria"> | Partial<FixedExpenseItem>): FixedExpenseCategoryOption {
  return isFixedExpenseCategory(expense.categoria) ? expense.categoria : "Otros";
}

export function createDefaultFixedExpense(category: FixedExpenseCategoryOption = "Otros"): FixedExpenseItem {
  return {
    id: nanoid(),
    concepto: "",
    categoria: category,
    categoriaPersonalizada: "",
    importe: undefined,
    frecuencia: "Mensual",
    fechaPago: "",
    notas: ""
  };
}

export function createDefaultFixedExpensesState(): FixedExpensesState {
  return {
    nombreDelHogar: "",
    ingresoMensual: undefined,
    gastos: []
  };
}

export const fixedExpenseItemSchema = z
  .object({
    id: z.string(),
    concepto: z.string().trim().optional().or(z.literal("")),
    categoria: z.enum(fixedExpenseCategories),
    categoriaPersonalizada: z.string().trim().optional().or(z.literal("")),
    importe: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }, z.number().positive("El importe debe ser mayor que 0.").optional()),
    frecuencia: z.enum(fixedExpenseFrequencies),
    fechaPago: z.string().optional().or(z.literal("")),
    notas: z.string().optional().or(z.literal(""))
  })
  .superRefine((value, ctx) => {
    const hasAnyMeaningfulValue =
      (value.concepto ?? "").trim() !== "" ||
      value.categoria !== "Otros" ||
      (value.categoriaPersonalizada ?? "").trim() !== "" ||
      typeof value.importe === "number" ||
      (value.fechaPago ?? "").trim() !== "" ||
      (value.notas ?? "").trim() !== "";

    if (hasAnyMeaningfulValue && (value.concepto ?? "").trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["concepto"],
        message: "Escribe el nombre o concepto del gasto."
      });
    }

    if (hasAnyMeaningfulValue && typeof value.importe !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["importe"],
        message: "El importe debe ser mayor que 0."
      });
    }
  });

export const fixedExpensesSchema = z.object({
  nombreDelHogar: z.string().trim().optional().or(z.literal("")),
  ingresoMensual: z.number().min(0, "El ingreso no puede ser negativo.").optional(),
  gastos: z.array(fixedExpenseItemSchema)
});

export type FixedExpenseFormValues = z.infer<typeof fixedExpensesSchema>;

function isBlankExpense(expense: Partial<FixedExpenseItem>): boolean {
  const concepto = (expense.concepto ?? "").trim();
  const categoriaPersonalizada = (expense.categoriaPersonalizada ?? "").trim();
  const notas = (expense.notas ?? "").trim();
  const fechaPago = (expense.fechaPago ?? "").trim();
  const importe = Number(expense.importe ?? 0);
  return concepto === "" && categoriaPersonalizada === "" && notas === "" && fechaPago === "" && roundMoney(importe) <= 0;
}

function normalizeCategoryAndCustom(expense: Partial<FixedExpenseItem>) {
  const originalCategoria = typeof expense.categoria === "string" ? expense.categoria.trim() : "";
  const categoria = isFixedExpenseCategory(originalCategoria) ? originalCategoria : "Otros";
  const categoriaPersonalizada =
    typeof expense.categoriaPersonalizada === "string" && expense.categoriaPersonalizada.trim()
      ? expense.categoriaPersonalizada.trim()
      : categoria === "Otros" && originalCategoria && originalCategoria !== "Otros"
        ? originalCategoria
        : "";

  return { categoria, categoriaPersonalizada };
}

export function normalizeFixedExpensesState(value: unknown): FixedExpensesState {
  const fallback = createDefaultFixedExpensesState();
  if (!value || typeof value !== "object") return fallback;

  const raw = value as Partial<FixedExpensesState>;
  const gastos = Array.isArray(raw.gastos)
    ? raw.gastos
        .map((item) => {
          const expense = item as Partial<FixedExpenseItem>;
          const { categoria, categoriaPersonalizada } = normalizeCategoryAndCustom(expense);
          const frecuencia = fixedExpenseFrequencies.includes(expense.frecuencia as FixedExpenseFrequency)
            ? (expense.frecuencia as FixedExpenseFrequency)
            : "Mensual";
          return {
            id: typeof expense.id === "string" && expense.id ? expense.id : nanoid(),
            concepto: typeof expense.concepto === "string" ? expense.concepto.trim() : "",
            categoria,
            categoriaPersonalizada,
            importe: Number.isFinite(Number(expense.importe)) ? roundMoney(Number(expense.importe)) : undefined,
            frecuencia,
            fechaPago: typeof expense.fechaPago === "string" ? expense.fechaPago : "",
            notas: typeof expense.notas === "string" ? expense.notas : ""
          };
        })
        .filter((expense) => !isBlankExpense(expense))
    : [];

  const ingresoMensual = Number.isFinite(Number(raw.ingresoMensual)) ? roundMoney(Number(raw.ingresoMensual)) : undefined;

  return {
    nombreDelHogar: typeof raw.nombreDelHogar === "string" ? raw.nombreDelHogar.trim() : "",
    ingresoMensual,
    gastos
  };
}

export function normalizeExpenseForForm(expense: Partial<FixedExpenseItem>): FixedExpenseItem {
  const { categoria, categoriaPersonalizada } = normalizeCategoryAndCustom(expense);
  const frecuencia = fixedExpenseFrequencies.includes(expense.frecuencia as FixedExpenseFrequency)
    ? (expense.frecuencia as FixedExpenseFrequency)
    : "Mensual";

  return {
    id: typeof expense.id === "string" && expense.id ? expense.id : nanoid(),
    concepto: typeof expense.concepto === "string" ? expense.concepto : "",
    categoria,
    categoriaPersonalizada,
    importe: Number.isFinite(Number(expense.importe)) ? roundMoney(Number(expense.importe)) : undefined,
    frecuencia,
    fechaPago: typeof expense.fechaPago === "string" ? expense.fechaPago : "",
    notas: typeof expense.notas === "string" ? expense.notas : ""
  };
}

export function getExpenseMonthlyEquivalent(expense: Pick<FixedExpenseItem, "importe" | "frecuencia"> | Partial<FixedExpenseItem>): number {
  return toMonthlyAmount(Number(expense.importe || 0), (expense.frecuencia ?? "Mensual") as FixedExpenseFrequency);
}

export function getExpensePeriodEquivalent(
  expense: Pick<FixedExpenseItem, "importe" | "frecuencia"> | Partial<FixedExpenseItem>,
  target: FixedExpenseFrequency
): number {
  const monthly = getExpenseMonthlyEquivalent(expense);
  return fromMonthlyAmount(monthly, target);
}

export type FixedExpenseSummary = {
  count: number;
  weeklyTotal: number;
  biweeklyTotal: number;
  monthlyTotal: number;
  annualTotal: number;
  averagePerExpense: number;
  monthlyById: Record<string, number>;
  highestExpense: {
    concepto: string;
    categoria: string;
    monthly: number;
  } | null;
  categoryTotals: Array<{ categoria: string; total: number }>;
  ingresoMensual?: number;
  dineroRestante?: number;
  porcentajeIngreso?: number;
  estadoBalance: "sin-ingreso" | "positivo" | "cero" | "negativo";
};

export function calculateFixedExpenseSummary(values: FixedExpensesState): FixedExpenseSummary {
  const gastos = values.gastos ?? [];
  const normalizedExpenses = gastos
    .map((expense) => ({
      ...expense,
      importe: Number(expense.importe || 0),
      concepto: (expense.concepto ?? "").trim(),
      categoriaPersonalizada: (expense.categoriaPersonalizada ?? "").trim(),
      categoria: expense.categoria
    }))
    .filter((expense) => expense.concepto || Number(expense.importe) > 0 || expense.categoriaPersonalizada);

  const monthlyTotals = normalizedExpenses.map((expense) => getExpenseMonthlyEquivalent(expense));
  const monthlyById = Object.fromEntries(normalizedExpenses.map((expense, index) => [expense.id, monthlyTotals[index]]));
  const monthlyTotal = roundMoney(monthlyTotals.reduce((acc, value) => acc + value, 0));
  const weeklyTotal = roundMoney(fromMonthlyAmount(monthlyTotal, "Semanal"));
  const biweeklyTotal = roundMoney(fromMonthlyAmount(monthlyTotal, "Quincenal"));
  const annualTotal = roundMoney(fromMonthlyAmount(monthlyTotal, "Anual"));
  const count = normalizedExpenses.length;
  const averagePerExpense = count ? roundMoney(monthlyTotal / count) : 0;
  const highestIndex = monthlyTotals.reduce((bestIndex, current, index, array) => (current > array[bestIndex] ? index : bestIndex), 0);
  const highestExpense = normalizedExpenses.length
    ? {
        concepto: normalizedExpenses[highestIndex].concepto || "Sin concepto",
        categoria: resolveExpenseCategory(normalizedExpenses[highestIndex]),
        monthly: roundMoney(monthlyTotals[highestIndex])
      }
    : null;

  const categoryMap = new Map<string, number>();
  normalizedExpenses.forEach((expense) => {
    const category = getPrimaryExpenseCategory(expense);
    categoryMap.set(category, roundMoney((categoryMap.get(category) ?? 0) + getExpenseMonthlyEquivalent(expense)));
  });

  const categoryTotals = Array.from(categoryMap.entries())
    .map(([categoria, total]) => ({ categoria, total: roundMoney(total) }))
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria));

  const ingresoMensual = Number.isFinite(Number(values.ingresoMensual)) ? roundMoney(Number(values.ingresoMensual)) : undefined;
  const dineroRestante = typeof ingresoMensual === "number" ? roundMoney(ingresoMensual - monthlyTotal) : undefined;
  const porcentajeIngreso = typeof ingresoMensual === "number" && ingresoMensual > 0 ? roundMoney((monthlyTotal / ingresoMensual) * 100) : undefined;
  const estadoBalance: FixedExpenseSummary["estadoBalance"] =
    typeof ingresoMensual !== "number"
      ? "sin-ingreso"
      : typeof dineroRestante === "number" && dineroRestante > 0
        ? "positivo"
        : dineroRestante === 0
          ? "cero"
          : "negativo";

  return {
    count,
    weeklyTotal,
    biweeklyTotal,
    monthlyTotal,
    annualTotal,
    averagePerExpense,
    monthlyById,
    highestExpense,
    categoryTotals,
    ingresoMensual,
    dineroRestante,
    porcentajeIngreso,
    estadoBalance
  };
}
