import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFieldArray, useForm, type FieldErrors, type Path, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, CopyPlus, Download, FileDown, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { buildFixedExpensesPdf } from "@/pdf/buildFixedExpensesPdf";
import {
  calculateFixedExpenseSummary,
  createDefaultFixedExpense,
  createDefaultFixedExpensesState,
  fixedExpenseFrequencies,
  fixedExpenseFrequencyLabels,
  fixedExpensesSchema,
  getExpenseMonthlyEquivalent,
  normalizeExpenseForForm,
  normalizeFixedExpensesState,
  roundMoney,
  resolveExpenseCategory,
  type FixedExpenseFormValues,
  type FixedExpenseItem,
  type FixedExpenseSummary
} from "@/lib/fixed-expenses";
import { loadFixedExpensesState, persistFixedExpensesState } from "@/lib/fixed-expenses-storage";
import { formatCurrency } from "@/lib/currency";
import { nanoid } from "@/lib/nanoid";
import { findFirstErrorPath } from "@/lib/form-errors";
import { repairPwaApp } from "@/lib/pwa-update";
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

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", emphasis ? "border-primary/20 bg-primary/10" : "border-border bg-card")}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold", emphasis && "text-primary")}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-3 py-2", emphasis ? "border-primary/20 bg-primary/10" : "border-border bg-card")}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold sm:text-base", emphasis && "text-primary")}>{value}</p>
    </div>
  );
}

type FixedExpensesPanelProps = {
  onBackToQuotes?: () => void;
};

function ExpenseRow({
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
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Gasto</p>
            <p className="truncate text-base font-semibold sm:text-lg">{expense.concepto || "Gasto sin nombre"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Mensual</p>
            <p className="text-base font-bold text-primary sm:text-lg">{formatCurrency(getExpenseMonthlyEquivalent(expense))}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">{fixedExpenseFrequencyLabels[expense.frecuencia]}</span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">{resolveExpenseCategory(expense)}</span>
          {expense.fechaPago ? <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">Pago: {expense.fechaPago}</span> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-[1.7fr_0.75fr_0.8fr_auto] md:items-end">
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
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button type="button" variant="outline" size="icon" onClick={onMoveUp} disabled={!manualOrder || !canMoveUp} aria-label="Mover arriba">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onMoveDown} disabled={!manualOrder || !canMoveDown} aria-label="Mover abajo">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onDuplicate} aria-label="Duplicar">
              <CopyPlus className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onDelete} aria-label="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Mensual estimado: <span className="font-semibold text-foreground">{formatCurrency(getExpenseMonthlyEquivalent(expense))}</span>
          </span>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-background">
              Notas
            </summary>
            <div className="mt-3 min-w-[220px]">
              <Field label="Notas" error={errors.gastos?.[index]?.notas?.message?.toString()}>
                <Input {...register(`gastos.${index}.notas`)} placeholder="Opcional" />
              </Field>
            </div>
          </details>
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [quickConcept, setQuickConcept] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickFrequency, setQuickFrequency] = useState<FixedExpenseFormValues["gastos"][number]["frecuencia"]>("Mensual");
  const [manualOrder, setManualOrder] = useState(true);
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
      sortExpenses(
        (values.gastos ?? []).map((expense, index) => ({
          expense: normalizeExpenseForForm(expense),
          index,
          monthlyEquivalent: summary.monthlyById[expense.id] ?? 0
        })),
        manualOrder ? "manual" : "importe-desc"
      ),
    [manualOrder, summary.monthlyById, values.gastos]
  );

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
    if (window.confirm("¿Eliminar este gasto fijo?")) {
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
  const balanceLabel =
    typeof monthlyIncome === "number"
      ? summary.estadoBalance === "positivo"
        ? "Positivo"
        : summary.estadoBalance === "cero"
          ? "En cero"
          : "Negativo"
      : "Sin ingreso";

  return (
    <div className="space-y-6 pb-28">
      <Card className="sticky top-16 z-30 overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl sm:text-2xl">Gastos fijos</CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Una lista rápida para capturar gastos como si fuera una compra: escribe, agrega y sigue bajando.
              </p>
              <p className="text-xs text-muted-foreground">Los datos se guardan solo en este dispositivo. Última acción: {status}</p>
            </div>
            {onBackToQuotes ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => void repairPwaApp()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar versión
                </Button>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={onBackToQuotes}>
                  Volver a cotizaciones
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-[1.8fr_0.7fr_0.8fr_auto]">
            <Field label="Concepto" required>
              <Input
                ref={quickConceptRef}
                value={quickConcept}
                onChange={(event) => setQuickConcept(event.target.value)}
                onKeyDown={handleQuickKeyDown}
                placeholder="Ej. Renta, luz, gasolina"
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
                Agregar
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Total mensual" value={formatCurrency(summary.monthlyTotal)} emphasis />
            <MiniStat label="Gastos" value={String(summary.count)} />
            <MiniStat label={typeof monthlyIncome === "number" ? "Dinero restante" : "Balance"} value={typeof monthlyIncome === "number" ? formatCurrency(summary.dineroRestante ?? 0) : balanceLabel} />
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
              <p className="text-sm text-muted-foreground">Cada gasto queda visible aquí con su nombre, importe y frecuencia.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setManualOrder((current) => !current)}>
                Orden {manualOrder ? "manual" : "por importe"}
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={clearAll}>
                <RotateCcw className="h-4 w-4" />
                Limpiar lista
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length ? (
            rows.map((row) => (
              <ExpenseRow
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
                canMoveDown={row.index < rows.length - 1}
                manualOrder={manualOrder}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Todavía no tienes gastos. Escribe uno arriba y presiona <span className="font-semibold text-foreground">Agregar</span>.
            </div>
          )}
          <div ref={listEndRef} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total semanal" value={formatCurrency(summary.weeklyTotal)} />
          <Stat label="Total quincenal" value={formatCurrency(summary.biweeklyTotal)} />
          <Stat label="Total anual" value={formatCurrency(summary.annualTotal)} />
          <Stat label="Promedio por gasto" value={formatCurrency(summary.averagePerExpense)} />
          <Stat label="Gasto más alto" value={summary.highestExpense ? formatCurrency(summary.highestExpense.monthly) : formatCurrency(0)} />
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Estado del balance</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <BalanceBadge summary={summary} />
              <span className="text-sm font-semibold">{balanceLabel}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {typeof monthlyIncome === "number" ? (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Ingreso mensual" value={formatCurrency(monthlyIncome)} />
            <Stat label="Dinero restante" value={formatCurrency(summary.dineroRestante ?? 0)} emphasis={typeof summary.dineroRestante === "number" && summary.dineroRestante >= 0} />
            <Stat label="% destinado a gastos" value={`${percentageFormatter.format(summary.porcentajeIngreso ?? 0)}%`} />
            <Stat label="Balance" value={balanceLabel} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Lista de gastos</CardTitle>
              <p className="text-sm text-muted-foreground">Edita cada fila en línea. Arriba tienes el total siempre visible.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setManualOrder((current) => !current)}>
                Orden {manualOrder ? "manual" : "por importe"}
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={clearAll}>
                <RotateCcw className="h-4 w-4" />
                Limpiar lista
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length ? (
            rows.map((row) => (
              <ExpenseRow
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
                canMoveDown={row.index < rows.length - 1}
                manualOrder={manualOrder}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Todavía no tienes gastos. Escribe uno arriba y presiona <span className="font-semibold text-foreground">Agregar</span>.
            </div>
          )}
          <div ref={listEndRef} />
        </CardContent>
      </Card>

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
