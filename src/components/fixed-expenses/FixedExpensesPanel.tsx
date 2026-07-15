import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldErrors, type Path, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CopyPlus,
  Download,
  FileDown,
  Plus,
  RotateCcw,
  Search,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/Field";
import { Section } from "@/components/Section";
import { Separator } from "@/components/ui/separator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { buildFixedExpensesPdf } from "@/pdf/buildFixedExpensesPdf";
import {
  calculateFixedExpenseSummary,
  createDefaultFixedExpense,
  createDefaultFixedExpensesState,
  getExpenseMonthlyEquivalent,
  fixedExpenseCategories,
  fixedExpenseFrequencies,
  fixedExpenseFrequencyLabels,
  fixedExpensesSchema,
  normalizeExpenseForForm,
  normalizeFixedExpensesState,
  resolveExpenseCategory,
  type FixedExpenseFormValues,
  type FixedExpenseItem,
  type FixedExpenseSummary
} from "@/lib/fixed-expenses";
import { loadFixedExpensesState, persistFixedExpensesState } from "@/lib/fixed-expenses-storage";
import { formatCurrency } from "@/lib/currency";
import { nanoid } from "@/lib/nanoid";
import { findFirstErrorPath } from "@/lib/form-errors";
import { cn } from "@/lib/cn";

const percentageFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCategoryOptions(expenses: Array<Partial<FixedExpenseItem>>): string[] {
  const normalized = expenses.map((item) => normalizeExpenseForForm(item));
  const custom = normalized
    .map((item) => resolveExpenseCategory(item))
    .filter((category) => category && category !== "Otros");
  return ["Todas", ...new Set([...fixedExpenseCategories.filter((category) => category !== "Otros"), ...custom, "Otros"])];
}

function getFrequencyOptions(): Array<"Todas" | FixedExpenseItem["frecuencia"]> {
  return ["Todas", ...fixedExpenseFrequencies];
}

function sortExpenses(
  rows: Array<{ expense: FixedExpenseItem; index: number; monthlyEquivalent: number }>,
  sortMode: "manual" | "importe-asc" | "importe-desc"
) {
  if (sortMode === "importe-asc") {
    return [...rows].sort((a, b) => a.monthlyEquivalent - b.monthlyEquivalent || a.expense.concepto.localeCompare(b.expense.concepto));
  }
  if (sortMode === "importe-desc") {
    return [...rows].sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent || a.expense.concepto.localeCompare(b.expense.concepto));
  }
  return rows;
}

function SummaryStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-sm",
        tone === "primary" ? "border-primary/20 bg-primary/10" : "border-border bg-card"
      )}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold", tone === "primary" && "text-primary")}>{value}</p>
    </div>
  );
}

function BalanceBadge({ summary }: { summary: FixedExpenseSummary }) {
  if (typeof summary.ingresoMensual !== "number") {
    return <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Sin ingreso registrado</span>;
  }

  const tone =
    summary.estadoBalance === "positivo"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : summary.estadoBalance === "cero"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/10 text-rose-700 dark:text-rose-300";

  const label =
    summary.estadoBalance === "positivo" ? "Saldo positivo" : summary.estadoBalance === "cero" ? "Saldo en cero" : "Saldo negativo";

  return <span className={cn("rounded-full px-3 py-1 text-xs font-medium", tone)}>{label}</span>;
}

type FixedExpensesPanelProps = {
  onBackToQuotes?: () => void;
};

function ExpenseRowCard({
  index,
  expense,
  register,
  errors,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  manualOrder
}: {
  index: number;
  expense: FixedExpenseItem;
  register: UseFormRegister<FixedExpenseFormValues>;
  errors: FieldErrors<FixedExpenseFormValues>;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  manualOrder: boolean;
}) {
  const category = expense.categoria;
  const showCustomCategory = category === "Otros";

  return (
    <Card className="overflow-hidden border-border/80">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Gasto {index + 1}</CardTitle>
            <p className="text-sm text-muted-foreground">{expense.concepto?.trim() || "Sin concepto"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="icon" onClick={onMoveUp} disabled={!manualOrder || !canMoveUp} aria-label="Mover gasto arriba">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onMoveDown} disabled={!manualOrder || !canMoveDown} aria-label="Mover gasto abajo">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onDuplicate} aria-label="Duplicar gasto">
              <CopyPlus className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onDelete} aria-label="Eliminar gasto">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Nombre o concepto" error={errors.gastos?.[index]?.concepto?.message?.toString()} required>
            <Input {...register(`gastos.${index}.concepto`)} placeholder="Ej. Renta" />
          </Field>
          <Field label="Categoría" error={errors.gastos?.[index]?.categoria?.message?.toString()} required>
            <select
              {...register(`gastos.${index}.categoria`)}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              {fixedExpenseCategories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          {showCustomCategory ? (
            <Field
              label="Categoría personalizada"
              error={errors.gastos?.[index]?.categoriaPersonalizada?.message?.toString()}
              required
              className="lg:col-span-2"
            >
              <Input {...register(`gastos.${index}.categoriaPersonalizada`)} placeholder="Ej. Hipoteca" />
            </Field>
          ) : null}
          <Field label="Importe" error={errors.gastos?.[index]?.importe?.message?.toString()} required>
            <Input
              {...register(`gastos.${index}.importe`, { setValueAs: numberOrUndefined })}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </Field>
          <Field label="Frecuencia" error={errors.gastos?.[index]?.frecuencia?.message?.toString()} required>
            <select
              {...register(`gastos.${index}.frecuencia`)}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              {fixedExpenseFrequencies.map((option) => (
                <option key={option} value={option}>
                  {fixedExpenseFrequencyLabels[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de pago" error={errors.gastos?.[index]?.fechaPago?.message?.toString()}>
            <Input {...register(`gastos.${index}.fechaPago`)} type="date" />
          </Field>
          <Field label="Notas" error={errors.gastos?.[index]?.notas?.message?.toString()} className="lg:col-span-2">
            <Textarea {...register(`gastos.${index}.notas`)} placeholder="Detalles opcionales, referencia o recordatorio." />
          </Field>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Equivalente mensual estimado:{" "}
            <span className="font-semibold text-foreground">{formatCurrency(getExpenseMonthlyEquivalent(expense))}</span>
          </div>
          {manualOrder ? <span className="text-xs text-muted-foreground">Puedes reordenar con las flechas</span> : <span className="text-xs text-muted-foreground">Ordenado por importe</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function FixedExpensesPanel({ onBackToQuotes }: FixedExpensesPanelProps) {
  const initialState = useMemo(() => loadFixedExpensesState(), []);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState("Listo");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todas");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("Todas");
  const [sortMode, setSortMode] = useState<"manual" | "importe-asc" | "importe-desc">("manual");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const lastSavedRef = useRef<string>("");

  const form = useForm<FixedExpenseFormValues>({
    resolver: zodResolver(fixedExpensesSchema) as Resolver<FixedExpenseFormValues>,
    defaultValues: initialState,
    mode: "onChange"
  });

  const {
    register,
    control,
    watch,
    reset,
    trigger,
    getValues,
    setFocus,
    formState: { errors, isDirty }
  } = form;

  const expenseArray = useFieldArray({ control, name: "gastos", keyName: "key" });
  const values = watch();

  const normalizedValues = useMemo(() => normalizeFixedExpensesState(values), [values]);
  const summary = useMemo(() => calculateFixedExpenseSummary(normalizedValues), [normalizedValues]);
  const rawExpenses = values.gastos ?? [];
  const categoryOptions = useMemo(() => getCategoryOptions(rawExpenses), [rawExpenses]);
  const frequencyOptions = useMemo(() => getFrequencyOptions(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastSavedRef.current === JSON.stringify(normalizedValues)) return;
    lastSavedRef.current = JSON.stringify(normalizedValues);
    persistFixedExpensesState(normalizedValues);
    if (isDirty) setStatus("Cambios guardados en este dispositivo");
  }, [isDirty, normalizedValues]);

  useEffect(() => {
    reset(initialState);
  }, [initialState, reset]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const visibleRows = useMemo(() => {
    const rows = rawExpenses.map((expense, index) => ({
      expense: normalizeExpenseForForm(expense),
      index,
      monthlyEquivalent: summary.monthlyById[expense.id] ?? 0
    }));

    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const category = resolveExpenseCategory(row.expense).toLowerCase();
      const concept = (row.expense.concepto ?? "").toLowerCase();
      const matchesSearch = !query || concept.includes(query) || category.includes(query);
      const matchesCategory = categoryFilter === "Todas" || resolveExpenseCategory(row.expense) === categoryFilter;
      const matchesFrequency = frequencyFilter === "Todas" || row.expense.frecuencia === frequencyFilter;
      return matchesSearch && matchesCategory && matchesFrequency;
    });

    return sortExpenses(filtered, sortMode);
  }, [categoryFilter, frequencyFilter, rawExpenses, search, sortMode, summary.monthlyById]);

  const createPdfBlob = async (data: FixedExpenseFormValues) => buildFixedExpensesPdf(normalizeFixedExpensesState(data));

  const addExpense = () => {
    expenseArray.append(createDefaultFixedExpense());
    setStatus("Gasto agregado");
  };

  const duplicateExpense = (index: number) => {
    const current = getValues(`gastos.${index}`);
    if (!current) return;
    expenseArray.insert(index + 1, {
      ...current,
      id: nanoid(),
      concepto: current.concepto ? `${current.concepto} (copia)` : "",
      categoriaPersonalizada: current.categoriaPersonalizada ?? ""
    });
    setStatus("Gasto duplicado");
  };

  const deleteExpense = (index: number) => {
    if (window.confirm("¿Eliminar este gasto fijo?")) {
      expenseArray.remove(index);
      setStatus("Gasto eliminado");
    }
  };

  const moveExpense = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rawExpenses.length) return;
    expenseArray.move(index, nextIndex);
  };

  const clearAll = () => {
    if (!window.confirm("¿Limpiar toda la lista de gastos fijos? Esta acción no se puede deshacer.")) return;
    expenseArray.replace([]);
    reset({ ...createDefaultFixedExpensesState(), nombreDelHogar: values.nombreDelHogar ?? "", ingresoMensual: values.ingresoMensual });
    setStatus("Lista de gastos limpiada");
  };

  const generatePdf = async (download = true, preview = true) => {
    const isFormValid = await trigger();
    if (!isFormValid) {
      const firstErrorPath = findFirstErrorPath(errors);
      if (firstErrorPath) {
        setFocus(firstErrorPath as Path<FixedExpenseFormValues>);
        window.requestAnimationFrame(() => {
          const element = document.querySelector<HTMLElement>(`[name="${firstErrorPath}"]`);
          element?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      setStatus("Revisa los campos obligatorios.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const data = normalizeFixedExpensesState(getValues());
      setStatus("Generando PDF...");
      const blob = await createPdfBlob(data);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPreviewOpen(preview);

      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "gastos-fijos-resumen.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setStatus("PDF generado");
    } catch (error) {
      console.error("Error al generar PDF de gastos fijos:", error);
      setStatus("No se pudo generar el PDF.");
      alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const monthlyIncome = summary.ingresoMensual;
  const balanceTone =
    typeof monthlyIncome !== "number"
      ? "text-muted-foreground"
      : summary.estadoBalance === "positivo"
        ? "text-emerald-600 dark:text-emerald-300"
        : summary.estadoBalance === "cero"
          ? "text-amber-600 dark:text-amber-300"
          : "text-rose-600 dark:text-rose-300";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-xl">Gastos fijos</CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Administra gastos mensuales o periódicos de forma privada. Los datos se guardan únicamente en este dispositivo.
              </p>
              <p className="text-xs text-muted-foreground">Última acción: {status}</p>
            </div>
            {onBackToQuotes ? (
              <Button type="button" variant="outline" className="rounded-2xl" onClick={onBackToQuotes}>
                Volver a cotizaciones
              </Button>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Section title="Resumen en vivo" description="Los cálculos se actualizan al instante mientras editas." defaultOpen>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStat label="Total mensual" value={formatCurrency(summary.monthlyTotal)} tone="primary" />
          <SummaryStat label="Total semanal" value={formatCurrency(summary.weeklyTotal)} />
          <SummaryStat label="Total quincenal" value={formatCurrency(summary.biweeklyTotal)} />
          <SummaryStat label="Total anual" value={formatCurrency(summary.annualTotal)} />
          <SummaryStat label="Gastos registrados" value={String(summary.count)} />
          <SummaryStat label="Promedio por gasto" value={formatCurrency(summary.averagePerExpense)} />
          <SummaryStat
            label="Gasto más alto"
            value={summary.highestExpense ? formatCurrency(summary.highestExpense.monthly) : formatCurrency(0)}
          />
          <SummaryStat label="Categorías activas" value={String(summary.categoryTotals.length)} />
        </div>
        <div className="mt-4 rounded-3xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Total mensual de gastos fijos</p>
              <p className="text-3xl font-bold tracking-tight">{formatCurrency(summary.monthlyTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estado del balance</p>
              <div className={cn("mt-1 text-base font-semibold", balanceTone)}>
                <BalanceBadge summary={summary} />
              </div>
            </div>
          </div>
          {typeof monthlyIncome === "number" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryStat label="Ingreso mensual" value={formatCurrency(monthlyIncome)} />
              <SummaryStat label="Dinero restante" value={formatCurrency(summary.dineroRestante ?? 0)} tone={summary.dineroRestante && summary.dineroRestante < 0 ? "default" : "primary"} />
              <SummaryStat label="% destinado a gastos" value={`${percentageFormatter.format(summary.porcentajeIngreso ?? 0)}%`} />
              <SummaryStat label="Balance" value={summary.estadoBalance === "positivo" ? "Positivo" : summary.estadoBalance === "cero" ? "En cero" : "Negativo"} />
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Totales por categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.categoryTotals.length ? (
                summary.categoryTotals.map((item) => (
                  <div key={item.categoria} className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2">
                    <span className="text-sm text-muted-foreground">{item.categoria}</span>
                    <span className="font-semibold">{formatCurrency(item.total)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay categorías registradas.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ingreso y privacidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Nombre del hogar o usuario" error={errors.nombreDelHogar?.message?.toString()}>
                <Input {...register("nombreDelHogar")} placeholder="Ej. Familia López" />
              </Field>
              <Field label="Ingreso mensual" error={errors.ingresoMensual?.message?.toString()}>
                <Input {...register("ingresoMensual", { setValueAs: numberOrUndefined })} type="number" min="0" step="0.01" inputMode="decimal" placeholder="Opcional" />
              </Field>
              <p className="rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                Los datos se guardan únicamente en este dispositivo. No se envía nada a servicios externos.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Administración" description="Busca, filtra, ordena o limpia la lista de gastos." defaultOpen>
        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Buscar por nombre">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Renta, luz, internet..." />
            </div>
          </Field>
          <Field label="Filtrar por categoría">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filtrar por frecuencia">
            <select
              value={frequencyFilter}
              onChange={(event) => setFrequencyFilter(event.target.value)}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              {frequencyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Orden">
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              <option value="manual">Orden manual</option>
              <option value="importe-desc">Importe mayor primero</option>
              <option value="importe-asc">Importe menor primero</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" size="lg" className="rounded-2xl" onClick={addExpense}>
            <Plus className="h-4 w-4" />
            Agregar gasto
          </Button>
          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => {
            setSearch("");
            setCategoryFilter("Todas");
            setFrequencyFilter("Todas");
            setSortMode("manual");
          }}>
            <ArrowDownUp className="h-4 w-4" />
            Limpiar filtros
          </Button>
          <Button type="button" variant="outline" className="rounded-2xl" onClick={clearAll}>
            <RotateCcw className="h-4 w-4" />
            Limpiar toda la lista
          </Button>
        </div>
      </Section>

      <Section title="Lista de gastos" description="Edita cada gasto en vivo. En móvil se muestra como tarjetas." defaultOpen>
        <div className="space-y-4">
          {visibleRows.length ? (
            visibleRows.map((row) => (
              <ExpenseRowCard
                key={row.expense.id}
                index={row.index}
                expense={row.expense}
                register={register}
                errors={errors}
                onDuplicate={() => duplicateExpense(row.index)}
                onDelete={() => deleteExpense(row.index)}
                onMoveUp={() => moveExpense(row.index, -1)}
                onMoveDown={() => moveExpense(row.index, 1)}
                canMoveUp={row.index > 0}
                canMoveDown={row.index < rawExpenses.length - 1}
                manualOrder={sortMode === "manual"}
              />
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="font-medium">No hay gastos para mostrar.</p>
                <p className="mt-1 text-sm text-muted-foreground">Agrega un gasto o ajusta los filtros para ver resultados.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </Section>

      <Section title="Exportar PDF" description="Genera un resumen claro y listo para imprimir o compartir." defaultOpen>
        <div className="flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={() => void generatePdf(true, true)} className="rounded-2xl" disabled={isGeneratingPdf}>
            <FileDown className="h-4 w-4" />
            {isGeneratingPdf ? "Generando..." : "Generar PDF"}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => void generatePdf(false, true)} className="rounded-2xl" disabled={isGeneratingPdf}>
            <Download className="h-4 w-4" />
            Vista previa
          </Button>
        </div>
      </Section>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Total mensual</p>
            <p className="text-xl font-bold">{formatCurrency(summary.monthlyTotal)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => void generatePdf(false, true)} disabled={isGeneratingPdf}>
              <Download className="h-4 w-4" />
              Vista previa
            </Button>
            <Button className="rounded-2xl px-6" onClick={() => void generatePdf(true, true)} disabled={isGeneratingPdf}>
              <FileDown className="h-4 w-4" />
              Generar PDF
            </Button>
          </div>
        </div>
      </div>

      <PdfPreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} pdfUrl={pdfUrl} />
    </div>
  );
}
