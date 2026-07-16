import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFieldArray, useForm, type FieldErrors, type Path, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Download,
  FileDown,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/Field";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { buildFixedExpensesPdf } from "@/pdf/buildFixedExpensesPdf";
import {
  calculateFixedExpenseSummary,
  createDefaultFixedExpense,
  createDefaultFixedExpensesState,
  fixedExpenseCategories,
  fixedExpenseFrequencies,
  fixedExpenseFrequencyLabels,
  fixedExpensesSchema,
  normalizeExpenseForForm,
  normalizeFixedExpensesState,
  resolveExpenseCategory,
  roundMoney,
  type FixedExpenseFormValues,
  type FixedExpenseItem,
  type FixedExpenseSummary
} from "@/lib/fixed-expenses";
import { loadFixedExpensesState, persistFixedExpensesState } from "@/lib/fixed-expenses-storage";
import { formatCurrency } from "@/lib/currency";
import { nanoid } from "@/lib/nanoid";
import { findFirstErrorPath } from "@/lib/form-errors";
import { getPwaUpdatedAtLabel, repairPwaApp } from "@/lib/pwa-update";
import { cn } from "@/lib/cn";

const percentageFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function numberOrUndefined(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sortRows(
  rows: Array<{ expense: FixedExpenseItem; index: number; monthlyEquivalent: number }>,
  sortMode: "manual" | "monthly-desc"
) {
  if (sortMode === "monthly-desc") {
    return [...rows].sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent || a.expense.concepto.localeCompare(b.expense.concepto));
  }
  return rows;
}

function toneForIndex(index: number): string {
  const tones = [
    "border-rose-200 bg-rose-50/80 dark:border-rose-400/20 dark:bg-rose-500/10",
    "border-sky-200 bg-sky-50/80 dark:border-sky-400/20 dark:bg-sky-500/10",
    "border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-emerald-500/10",
    "border-amber-200 bg-amber-50/80 dark:border-amber-400/20 dark:bg-amber-500/10",
    "border-violet-200 bg-violet-50/80 dark:border-violet-400/20 dark:bg-violet-500/10"
  ];
  return tones[index % tones.length];
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

function ExpenseCard({
  index,
  expense,
  monthlyEquivalent,
  register,
  errors,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  sortMode
}: {
  index: number;
  expense: FixedExpenseItem;
  monthlyEquivalent: number;
  register: UseFormRegister<FixedExpenseFormValues>;
  errors: FieldErrors<FixedExpenseFormValues>;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  sortMode: "manual" | "monthly-desc";
}) {
  const category = resolveExpenseCategory(expense);
  const categoryError = errors.gastos?.[index]?.categoriaPersonalizada?.message?.toString();

  return (
    <Card className={cn("overflow-hidden border shadow-sm", toneForIndex(index))}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Gasto fijo</p>
            <h3 className="truncate text-lg font-semibold sm:text-xl">{expense.concepto || "Sin nombre"}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-background/80 px-3 py-1 font-medium text-foreground">{fixedExpenseFrequencyLabels[expense.frecuencia]}</span>
              <span className="rounded-full bg-background/80 px-3 py-1 font-medium text-foreground">{category}</span>
              {expense.fechaPago ? <span className="rounded-full bg-background/80 px-3 py-1 font-medium text-foreground">Pago: {expense.fechaPago}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Mensual</p>
            <p className="text-xl font-bold sm:text-2xl">{formatCurrency(monthlyEquivalent)}</p>
          </div>
        </div>

        <details className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2">
          <summary className="cursor-pointer list-none text-sm font-medium">Editar detalles</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Concepto" error={errors.gastos?.[index]?.concepto?.message?.toString()} required>
              <Input {...register(`gastos.${index}.concepto`)} placeholder="Ej. Renta" autoComplete="off" />
            </Field>
            <Field label="Importe" error={errors.gastos?.[index]?.importe?.message?.toString()} required>
              <Input {...register(`gastos.${index}.importe`, { setValueAs: numberOrUndefined })} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" />
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
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Categoria" error={errors.gastos?.[index]?.categoria?.message?.toString()}>
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
            <Field
              label="Categoria personalizada"
              error={categoryError}
              hint={category === "Otros" ? "Se usa cuando eliges Otros." : "Solo se usa cuando la categoria es Otros."}
            >
              <Input {...register(`gastos.${index}.categoriaPersonalizada`)} placeholder="Opcional" />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Notas" error={errors.gastos?.[index]?.notas?.message?.toString()}>
              <Textarea {...register(`gastos.${index}.notas`)} placeholder="Opcional" />
            </Field>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onMoveUp}
            disabled={sortMode !== "manual" || !canMoveUp}
            aria-label="Mover gasto hacia arriba"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onMoveDown}
            disabled={sortMode !== "manual" || !canMoveDown}
            aria-label="Mover gasto hacia abajo"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate} aria-label="Duplicar gasto">
            <CopyPlus className="h-4 w-4" />
            Duplicar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} aria-label="Eliminar gasto">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", emphasis ? "border-primary/20 bg-primary/10" : "border-border bg-card")}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold", emphasis && "text-primary")}>{value}</p>
    </div>
  );
}

export function FixedExpensesPanel({ onBackToQuotes }: FixedExpensesPanelProps) {
  const initialState = useMemo(() => loadFixedExpensesState(), []);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState("Listo");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [quickConcept, setQuickConcept] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickFrequency, setQuickFrequency] = useState<FixedExpenseFormValues["gastos"][number]["frecuencia"]>("Mensual");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<"manual" | "monthly-desc">("manual");
  const [updatedAtLabel, setUpdatedAtLabel] = useState("");
  const lastSavedRef = useRef<string>("");
  const quickConceptRef = useRef<HTMLInputElement | null>(null);
  const quickAmountRef = useRef<HTMLInputElement | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

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
  const rows = useMemo(
    () =>
      sortRows(
        (values.gastos ?? []).map((expense, index) => ({
          expense: normalizeExpenseForForm(expense),
          index,
          monthlyEquivalent: summary.monthlyById[expense.id] ?? 0
        })),
        sortMode
      ).filter((row) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        const concept = row.expense.concepto.toLowerCase();
        const category = resolveExpenseCategory(row.expense).toLowerCase();
        return concept.includes(term) || category.includes(term);
      }),
    [searchTerm, sortMode, summary.monthlyById, values.gastos]
  );

  useEffect(() => {
    setUpdatedAtLabel(getPwaUpdatedAtLabel());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const serialized = JSON.stringify(normalizedValues);
    if (lastSavedRef.current === serialized) return;
    lastSavedRef.current = serialized;
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

  const createPdfBlob = async (data: FixedExpenseFormValues) => buildFixedExpensesPdf(normalizeFixedExpensesState(data));

  const addExpense = () => {
    const amount = numberOrUndefined(quickAmount);
    if (!quickConcept.trim()) {
      setStatus("Escribe el concepto del gasto.");
      quickConceptRef.current?.focus();
      return;
    }
    if (typeof amount !== "number" || amount <= 0) {
      setStatus("Escribe un importe mayor que 0.");
      quickAmountRef.current?.focus();
      return;
    }

    expenseArray.append({
      ...createDefaultFixedExpense(),
      concepto: quickConcept.trim(),
      importe: roundMoney(amount),
      frecuencia: quickFrequency
    });

    setQuickConcept("");
    setQuickAmount("");
    setQuickFrequency("Mensual");
    setStatus(`Agregado: ${quickConcept.trim()} (${formatCurrency(roundMoney(amount))})`);
    window.requestAnimationFrame(() => {
      quickConceptRef.current?.focus();
      listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const handleQuickKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addExpense();
    }
  };

  const duplicateExpense = (index: number) => {
    const current = getValues(`gastos.${index}`);
    if (!current) return;
    expenseArray.insert(index + 1, {
      ...current,
      id: nanoid(),
      concepto: current.concepto ? `${current.concepto} (copia)` : ""
    });
    setStatus("Gasto duplicado");
  };

  const deleteExpense = (index: number) => {
    if (window.confirm("Eliminar este gasto fijo?")) {
      expenseArray.remove(index);
      setStatus("Gasto eliminado");
    }
  };

  const moveExpense = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= (values.gastos ?? []).length) return;
    expenseArray.move(index, nextIndex);
  };

  const clearAll = () => {
    if (!window.confirm("Limpiar toda la lista de gastos fijos? Esta accion no se puede deshacer.")) return;
    expenseArray.replace([]);
    reset({
      ...createDefaultFixedExpensesState(),
      nombreDelHogar: values.nombreDelHogar ?? "",
      ingresoMensual: values.ingresoMensual
    });
    setSearchTerm("");
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
      alert("No se pudo generar el PDF. Revisa la consola para mas detalles.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const monthlyIncome = summary.ingresoMensual;
  const balanceLabel =
    typeof monthlyIncome === "number"
      ? summary.estadoBalance === "positivo"
        ? "Positivo"
        : summary.estadoBalance === "cero"
          ? "En cero"
          : "Negativo"
      : "Sin ingreso";

  const updateLabel = updatedAtLabel ? `Actualizada a la ultima version: ${updatedAtLabel}` : "Actualizada a la ultima version";

  return (
    <div className="space-y-5 pb-36">
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-2xl">Gastos fijos</CardTitle>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Una lista rapida, mobile first y facil de leer: escribe arriba, agrega y veras cada gasto como una tarjeta.
                </p>
                <p className="text-xs text-muted-foreground">Los datos se guardan solo en este dispositivo. Ultima accion: {status}</p>
                <p className="text-xs font-medium text-muted-foreground">{updateLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => void repairPwaApp()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar version
                </Button>
                {onBackToQuotes ? (
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={onBackToQuotes}>
                    Volver a cotizaciones
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.8fr_0.8fr_0.9fr_auto]">
            <Field label="Concepto" required>
              <Input
                ref={quickConceptRef}
                value={quickConcept}
                onChange={(event) => setQuickConcept(event.target.value)}
                onKeyDown={handleQuickKeyDown}
                placeholder="Ej. Renta, luz, internet"
                autoComplete="off"
              />
            </Field>
            <Field label="Importe" required>
              <Input
                ref={quickAmountRef}
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
                onKeyDown={handleQuickKeyDown}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </Field>
            <Field label="Frecuencia" required>
              <select
                value={quickFrequency}
                onChange={(event) => setQuickFrequency(event.target.value as FixedExpenseFormValues["gastos"][number]["frecuencia"])}
                className="h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {fixedExpenseFrequencies.map((option) => (
                  <option key={option} value={option}>
                    {fixedExpenseFrequencyLabels[option]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="button" size="lg" className="w-full rounded-2xl" onClick={addExpense}>
                <Plus className="h-4 w-4" />
                Agregar gasto
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr_auto]">
            <Field label="Buscar por nombre o categoria">
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Ej. luz, renta, gasolina" />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => setSortMode((current) => (current === "manual" ? "monthly-desc" : "manual"))}
              >
                <Search className="h-4 w-4" />
                Orden: {sortMode === "manual" ? "manual" : "importe"}
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={clearAll}>
                <RotateCcw className="h-4 w-4" />
                Limpiar lista
              </Button>
            </div>
          </div>

          <details className="rounded-2xl border border-border bg-background/70 px-3 py-2">
            <summary className="cursor-pointer list-none text-sm font-medium">Opciones opcionales</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Ingreso mensual" className="min-w-[220px]">
                <Input {...register("ingresoMensual", { setValueAs: numberOrUndefined })} type="number" min="0" step="0.01" inputMode="decimal" placeholder="Opcional" />
              </Field>
              <Field label="Nombre del hogar o usuario" className="min-w-[240px]">
                <Input {...register("nombreDelHogar")} placeholder="Opcional" />
              </Field>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Lista de gastos</CardTitle>
              <p className="text-sm text-muted-foreground">Cada gasto aparece como tarjeta con su nombre, importe y equivalente mensual.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{summary.count} registros</span>
              <BalanceBadge summary={summary} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length ? (
            rows.map((row, position) => (
              <ExpenseCard
                key={row.expense.id}
                index={row.index}
                expense={row.expense}
                monthlyEquivalent={row.monthlyEquivalent}
                register={register}
                errors={errors}
                onDuplicate={() => duplicateExpense(row.index)}
                onDelete={() => deleteExpense(row.index)}
                onMoveUp={() => moveExpense(row.index, -1)}
                onMoveDown={() => moveExpense(row.index, 1)}
                canMoveUp={position > 0}
                canMoveDown={position < rows.length - 1}
                sortMode={sortMode}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Todavia no tienes gastos. Escribe uno arriba y presiona <span className="font-semibold text-foreground">Agregar gasto</span>.
            </div>
          )}
          <div ref={listEndRef} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Resumen de gastos fijos</CardTitle>
              <p className="text-sm text-muted-foreground">El resumen se calcula en vivo y se guarda solo en este dispositivo.</p>
            </div>
            <BalanceBadge summary={summary} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl border border-primary/20 bg-primary/10 px-4 py-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Total mensual de gastos fijos</p>
            <p className="mt-2 text-3xl font-black text-primary">{formatCurrency(summary.monthlyTotal)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total semanal" value={formatCurrency(summary.weeklyTotal)} />
            <Stat label="Total quincenal" value={formatCurrency(summary.biweeklyTotal)} />
            <Stat label="Total anual" value={formatCurrency(summary.annualTotal)} />
            <Stat label="Promedio por gasto" value={formatCurrency(summary.averagePerExpense)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              label="Gasto mas alto"
              value={summary.highestExpense ? `${summary.highestExpense.concepto} · ${formatCurrency(summary.highestExpense.monthly)}` : "Sin gastos"}
            />
            <Stat label="Ingreso mensual" value={typeof monthlyIncome === "number" ? formatCurrency(monthlyIncome) : "Opcional"} />
            <Stat label="Dinero restante" value={typeof monthlyIncome === "number" ? formatCurrency(summary.dineroRestante ?? 0) : "Sin ingreso"} />
          </div>

          {typeof monthlyIncome === "number" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label="% destinado a gastos" value={`${percentageFormatter.format(summary.porcentajeIngreso ?? 0)}%`} />
              <Stat label="Estado del balance" value={balanceLabel} />
              <Stat label="Nota" value={summary.estadoBalance === "negativo" ? "Revisa tus gastos" : "Balance controlado"} />
            </div>
          ) : null}

          {summary.categoryTotals.length ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Total por categoria</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {summary.categoryTotals.map((item) => (
                  <div key={item.categoria} className="rounded-2xl border border-border bg-card px-4 py-3">
                    <p className="text-sm font-medium">{item.categoria}</p>
                    <p className="mt-1 text-lg font-bold">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Total mensual</p>
            <p className="text-xl font-bold">{formatCurrency(summary.monthlyTotal)}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="rounded-2xl" onClick={() => void repairPwaApp()}>
              <RefreshCw className="h-4 w-4" />
              Actualizar version
            </Button>
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
