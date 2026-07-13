import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calculator,
  CopyPlus,
  Download,
  FileDown,
  MoonStar,
  RotateCcw,
  Save,
  SunMedium,
  FileJson,
  ChevronDown,
  ClipboardPaste
} from "lucide-react";
import { Section } from "@/components/Section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/Field";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { createDefaultQuote } from "@/lib/defaults";
import { calculateTotals } from "@/lib/calc";
import { formatCurrency } from "@/lib/currency";
import { quoteSchema, type QuoteFormValues } from "@/lib/quote-types";
import { useTheme } from "@/hooks/useTheme";
import { useQuoteLibrary } from "@/hooks/useQuoteLibrary";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { buildQuotePdf } from "@/pdf/buildQuotePdf";
import { LogoPreview } from "@/components/LogoPreview";
import { RowsEditor } from "@/components/quote/RowsEditor";
import { SummaryCard } from "@/components/SummaryCard";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { QuoteLibraryPanel } from "@/components/QuoteLibraryPanel";
import { nanoid } from "@/lib/nanoid";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { normalizeQuoteValues } from "@/lib/quote-library";

function findFirstErrorPath(value: unknown, prefix = ""): string | null {
  if (!value || typeof value !== "object") return null;

  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && "message" in child) {
      return path;
    }
    const nested = findFirstErrorPath(child, path);
    if (nested) return nested;
  }

  return null;
}

export default function App() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { installed, ios, canPromptInstall, promptInstall } = useInstallPrompt();
  const {
    quotes,
    activeQuote,
    setActiveQuoteId,
    saveActiveQuote,
    createQuote,
    duplicateQuote,
    deleteQuote
  } = useQuoteLibrary();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState<string>("Listo");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema) as Resolver<QuoteFormValues>,
    defaultValues: normalizeQuoteValues(activeQuote?.values ?? createDefaultQuote()),
    mode: "onChange"
  });

  const { register, control, watch, reset, setValue, formState, trigger, getValues, setFocus } = form;
  const { errors, isDirty, isValid } = formState;

  const materialesArray = useFieldArray({ control, name: "materiales", keyName: "key" });
  const manoDeObraArray = useFieldArray({ control, name: "manoDeObra", keyName: "key" });
  const gastosArray = useFieldArray({ control, name: "gastosAdicionales", keyName: "key" });

  const values = watch();
  const totals = useMemo(() => calculateTotals(values), [values]);

  const syncCurrentQuote = () => {
    saveActiveQuote(values);
  };

  useDebouncedEffect(
    () => {
      if (isDirty) {
        saveActiveQuote(values);
        setStatus("Cotización guardada");
      }
    },
    [values, isDirty, saveActiveQuote],
    450
  );

  useEffect(() => {
    if (activeQuote) {
      reset(normalizeQuoteValues(activeQuote.values));
    }
  }, [activeQuote, reset]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const createPdfBlob = async (data: QuoteFormValues) => buildQuotePdf(data);

  const addMaterial = () =>
    materialesArray.append({
      id: nanoid(),
      descripcion: "",
      unidad: "pza",
      cantidad: 1,
      precioUnitario: 0
    });

  const addLabor = () =>
    manoDeObraArray.append({
      id: nanoid(),
      descripcion: "",
      dias: 1,
      tarifaDia: 0
    });

  const addExpense = () =>
    gastosArray.append({
      id: nanoid(),
      concepto: "",
      monto: 0
    });

  const duplicateMaterial = (index: number) => {
    const item = values.materiales[index];
    materialesArray.insert(index + 1, { ...item, id: nanoid(), descripcion: `${item.descripcion} (copia)` });
  };

  const duplicateLabor = (index: number) => {
    const item = values.manoDeObra[index];
    manoDeObraArray.insert(index + 1, { ...item, id: nanoid(), descripcion: `${item.descripcion} (copia)` });
  };

  const duplicateExpense = (index: number) => {
    const item = values.gastosAdicionales[index];
    gastosArray.insert(index + 1, { ...item, id: nanoid(), concepto: `${item.concepto} (copia)` });
  };

  const deleteMaterial = (index: number) => {
    if (window.confirm("¿Eliminar esta fila de material?")) materialesArray.remove(index);
  };

  const deleteLabor = (index: number) => {
    if (window.confirm("¿Eliminar esta fila de mano de obra?")) manoDeObraArray.remove(index);
  };

  const deleteExpense = (index: number) => {
    if (window.confirm("¿Eliminar este gasto adicional?")) gastosArray.remove(index);
  };

  const openQuote = (id: string) => {
    syncCurrentQuote();
    setActiveQuoteId(id);
    setStatus("Cotización abierta");
  };

  const duplicateCurrentQuote = () => {
    syncCurrentQuote();
    const duplicatedId = duplicateQuote(values);
    setActiveQuoteId(duplicatedId);
    setStatus("Versión duplicada y abierta");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(values, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cotizacion-${values.numeroCotizacion}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = quoteSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      alert("El archivo JSON no es compatible con esta cotización.");
      return;
    }
    syncCurrentQuote();
    const importedId = createQuote(parsed.data);
    setActiveQuoteId(importedId);
    setStatus("Cotización importada");
  };

  const generatePdf = async (download = true, preview = true) => {
    const isFormValid = await trigger();
    if (!isFormValid) {
      const firstErrorPath = findFirstErrorPath(formState.errors);
      if (firstErrorPath) {
        setFocus(firstErrorPath as Path<QuoteFormValues>);
        window.requestAnimationFrame(() => {
          const element = document.querySelector<HTMLElement>(`[name="${firstErrorPath}"]`);
          element?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      setStatus("Faltan datos obligatorios. Te llevé al campo pendiente.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const data = getValues();
      syncCurrentQuote();
      setStatus("Generando PDF...");
      const blob = await createPdfBlob(data);

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPreviewOpen(preview);

      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `cotizacion-${data.numeroCotizacion}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setStatus("PDF generado");
    } catch (error) {
      console.error("Error al generar PDF:", error);
      setStatus("No se pudo generar el PDF.");
      alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const createNewQuote = () => {
    syncCurrentQuote();
    const newQuoteId = createQuote(createDefaultQuote());
    setActiveQuoteId(newQuoteId);
    setStatus("Nueva cotización lista");
  };

  const newQuotation = () => {
    if (window.confirm("¿Crear una nueva cotización? Se guardará la actual y abrirás una nueva.")) {
      createNewQuote();
    }
  };

  const deleteQuoteById = (id: string) => {
    if (window.confirm("¿Eliminar esta cotización guardada?")) {
      if (activeQuote?.id === id) {
        syncCurrentQuote();
      }
      deleteQuote(id);
      setStatus("Cotización eliminada");
    }
  };

  const openPreview = async () => {
    await generatePdf(false, true);
  };

  return (
    <div className="min-h-full">
      <header className="safe-top border-b border-border/60 bg-background/80 backdrop-blur-xl lg:sticky lg:top-0 lg:z-30">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
                <Calculator className="h-3.5 w-3.5 text-primary" />
                PWA local para cotizaciones y costos
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cotizador MX</h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Diseñado para iPhone, Android y escritorio. Tus datos se guardan localmente y el PDF se genera en tu dispositivo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={toggleTheme} className="rounded-2xl">
                {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                {isDark ? "Tema claro" : "Tema oscuro"}
              </Button>
              <Button variant="outline" onClick={duplicateCurrentQuote} className="rounded-2xl">
                <CopyPlus className="h-4 w-4" />
                Duplicar
              </Button>
              <Button variant="outline" onClick={exportJson} className="rounded-2xl">
                <FileJson className="h-4 w-4" />
                Exportar JSON
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importJson(file);
                }}
              />
              <Button variant="outline" className="rounded-2xl" onClick={() => importInputRef.current?.click()}>
                <span className="inline-flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4" />
                  Importar JSON
                </span>
              </Button>
              <Button variant="outline" onClick={newQuotation} className="rounded-2xl">
                <RotateCcw className="h-4 w-4" />
                Nueva Cotización
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{status}</span>
            <span>•</span>
            <span>{quotes.length} cotizaciones guardadas</span>
            <span>•</span>
            <span>Activa: {activeQuote?.title ?? "Sin título"}</span>
            <span>•</span>
            <span>{isValid ? "Formulario listo" : "Revisa los campos requeridos"}</span>
          </div>
          <InstallPrompt installed={installed} ios={ios} canPromptInstall={canPromptInstall} onInstall={promptInstall} />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          <QuoteLibraryPanel
            quotes={quotes}
            activeQuoteId={activeQuote?.id ?? ""}
            onSelect={openQuote}
            onNew={createNewQuote}
            onDuplicate={(id) => {
              const selectedQuote = quotes.find((quote) => quote.id === id);
              if (!selectedQuote) return;
              syncCurrentQuote();
              const duplicatedId = duplicateQuote(selectedQuote.values);
              setActiveQuoteId(duplicatedId);
              setStatus("Versión duplicada y abierta");
            }}
            onDelete={deleteQuoteById}
          />

          <Section title="Información del cliente" description="Datos de contacto y referencia de la cotización." defaultOpen>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cliente" error={errors.cliente?.message?.toString()} required>
                <Input {...register("cliente")} placeholder="Nombre del cliente" />
              </Field>
              <Field label="Empresa" error={errors.empresa?.message?.toString()}>
                <Input {...register("empresa")} placeholder="Nombre de la empresa" />
              </Field>
              <Field label="Teléfono" error={errors.telefono?.message?.toString()} required>
                <Input {...register("telefono")} inputMode="tel" placeholder="55 1234 5678" />
              </Field>
              <Field label="Fecha" error={errors.fecha?.message?.toString()} required>
                <Input {...register("fecha")} type="date" />
              </Field>
              <Field label="Número de cotización" error={errors.numeroCotizacion?.message?.toString()} required>
                <Input {...register("numeroCotizacion")} placeholder="COT-2026-07-12" />
              </Field>
            </div>
          </Section>

          <Section title="Información del proyecto" description="Describe el trabajo a realizar." defaultOpen>
            <div className="grid gap-4">
              <Field label="Nombre del proyecto" error={errors.nombreProyecto?.message?.toString()} required>
                <Input {...register("nombreProyecto")} placeholder="Ej. Fabricación de gabinete metálico" />
              </Field>
              <Field label="Descripción" error={errors.descripcionProyecto?.message?.toString()} required>
                <Textarea {...register("descripcionProyecto")} placeholder="Describe alcance, materiales o consideraciones especiales." />
              </Field>
            </div>
          </Section>

          <Section title="Materiales" description="La sección más importante. Agrega todas las partidas necesarias." defaultOpen>
            <RowsEditor
              title="Materiales"
              subtitle="Cada fila calcula cantidad por precio unitario."
              section="materiales"
              register={register}
              errors={errors}
              fields={materialesArray.fields}
              onAdd={addMaterial}
              onDelete={deleteMaterial}
              onDuplicate={duplicateMaterial}
            />
          </Section>

          <Section title="Mano de obra" description="Días trabajados y tarifa por día." defaultOpen>
            <RowsEditor
              title="Mano de obra"
              subtitle="Captura los días trabajados y la tarifa diaria."
              section="manoDeObra"
              register={register}
              errors={errors}
              fields={manoDeObraArray.fields}
              onAdd={addLabor}
              onDelete={deleteLabor}
              onDuplicate={duplicateLabor}
            />
          </Section>

          <Section title="Gastos adicionales" description="Transportes, envío, instalación, pintura o cualquier otro costo." defaultOpen>
            <RowsEditor
              title="Gastos adicionales"
              subtitle="Agrega conceptos con monto fijo."
              section="gastosAdicionales"
              register={register}
              errors={errors}
              fields={gastosArray.fields}
              onAdd={addExpense}
              onDelete={deleteExpense}
              onDuplicate={duplicateExpense}
            />
          </Section>

          <Section title="Configuración comercial" description="Margen, descuento e IVA. Todo se calcula en vivo." defaultOpen>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Margen de ganancia %" error={errors.margenGanancia?.message?.toString()} required>
                <Input {...register("margenGanancia", { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
              </Field>
              <Field label="Descuento" error={errors.descuento?.message?.toString()}>
                <Input {...register("descuento", { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
              </Field>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 md:col-span-2">
                <div>
                  <p className="font-medium">Aplicar IVA</p>
                  <p className="text-sm text-muted-foreground">Se agrega 16% sobre el subtotal final.</p>
                </div>
                <Controller
                  control={control}
                  name="ivaActivo"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                />
              </div>
            </div>
          </Section>

          <Section title="Marca y notas" description="Opcional. Se incluirá en el PDF." defaultOpen={false}>
            <div className="space-y-4">
              <LogoPreview logoDataUrl={values.logoDataUrl} onChange={(value) => setValue("logoDataUrl", value, { shouldDirty: true })} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre de la empresa" error={errors.companiaNombre?.message?.toString()}>
                  <Input {...register("companiaNombre")} placeholder="Nombre comercial" />
                </Field>
                <Field label="Teléfono / WhatsApp" error={errors.companiaTelefono?.message?.toString()}>
                  <Input {...register("companiaTelefono")} placeholder="55 0000 0000" />
                </Field>
                <Field label="Dirección" error={errors.companiaDireccion?.message?.toString()}>
                  <Input {...register("companiaDireccion")} placeholder="Dirección fiscal o comercial" />
                </Field>
              </div>
              <Field label="Notas" error={errors.notas?.message?.toString()} hint="Aclaraciones, tiempos de entrega, vigencia o términos especiales.">
                <Textarea {...register("notas")} placeholder="Ej. Vigencia de la cotización: 15 días." />
              </Field>
            </div>
          </Section>

          <Section title="Generar PDF" description="Descarga y vista previa del documento profesional." defaultOpen>
            <div className="flex flex-wrap gap-3">
              <Button type="button" size="lg" onClick={() => void generatePdf(true)} className="rounded-2xl" disabled={isGeneratingPdf}>
                <FileDown className="h-4 w-4" />
                {isGeneratingPdf ? "Generando..." : "Generar PDF"}
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => void openPreview()} className="rounded-2xl" disabled={isGeneratingPdf}>
                <Download className="h-4 w-4" />
                Vista previa
              </Button>
              <Button type="button" size="lg" variant="secondary" onClick={() => window.print()} className="rounded-2xl">
                <Save className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <SummaryCard totals={totals} onGeneratePdf={() => void generatePdf(true)} className="lg:sticky lg:top-28" />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vista rápida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Materiales</span>
                <span className="font-semibold">{formatCurrency(totals.materiales)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mano de obra</span>
                <span className="font-semibold">{formatCurrency(totals.manoDeObra)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gastos</span>
                <span className="font-semibold">{formatCurrency(totals.gastosAdicionales)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Precio final</span>
                <span className="text-lg font-bold">{formatCurrency(totals.precioFinal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Total final</p>
            <p className="text-xl font-bold">{formatCurrency(totals.precioFinal)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => void openPreview()} disabled={isGeneratingPdf}>
              <ChevronDown className="h-4 w-4 rotate-180" />
              Vista previa
            </Button>
            <Button className="rounded-2xl px-6" onClick={() => void generatePdf(true)} disabled={isGeneratingPdf}>
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
