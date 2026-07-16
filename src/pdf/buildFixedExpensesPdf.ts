import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency, formatDate } from "@/lib/currency";
import { calculateFixedExpenseSummary, normalizeFixedExpensesState, type FixedExpensesState } from "@/lib/fixed-expenses";
import { drawTableRow, rgbFromHex, wrapText } from "@/pdf/pdf-utils";

function formatPdfAmount(value: number): string {
  return formatCurrency(value);
}

function formatPdfPercentage(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function shorten(text: string, maxLength: number): string {
  const value = text.trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export async function buildFixedExpensesPdf(values: FixedExpensesState): Promise<Blob> {
  const normalized = normalizeFixedExpensesState(values);
  const summary = calculateFixedExpenseSummary(normalized);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 36;
  const contentWidth = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let cursorY = pageSize[1] - margin;
  const brand = rgbFromHex("#0f172a");
  const accent = rgbFromHex("#2563eb");

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < margin + 80) {
      page = pdf.addPage(pageSize);
      cursorY = pageSize[1] - margin;
    }
  };

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: pageSize[1] - 84, width: pageSize[0], height: 84, color: brand });
    page.drawCircle({ x: margin + 22, y: pageSize[1] - 46, size: 22, color: accent });
    page.drawText("RESUMEN DE GASTOS FIJOS", {
      x: margin + 58,
      y: pageSize[1] - 44,
      size: 19,
      font: bold,
      color: rgb(1, 1, 1)
    });
    page.drawText("Exportado desde la PWA", {
      x: margin + 58,
      y: pageSize[1] - 62,
      size: 9,
      font: regular,
      color: rgb(0.86, 0.92, 0.98)
    });
    page.drawText("Los datos se guardan unicamente en este dispositivo.", {
      x: pageSize[0] - margin - 190,
      y: pageSize[1] - 62,
      size: 8.5,
      font: regular,
      color: rgb(0.86, 0.92, 0.98)
    });
    if (normalized.nombreDelHogar) {
      page.drawText(normalized.nombreDelHogar, {
        x: pageSize[0] - margin - 190,
        y: pageSize[1] - 44,
        size: 9,
        font: bold,
        color: rgb(0.94, 0.97, 1)
      });
    }
    cursorY = pageSize[1] - 106;
  };

  const renderSectionTitle = (title: string) => {
    ensureSpace(34);
    page.drawText(title, { x: margin, y: cursorY, size: 14, font: bold, color: brand });
    page.drawRectangle({ x: margin, y: cursorY - 5, width: contentWidth, height: 1, color: accent });
    cursorY -= 22;
  };

  const renderPillLine = (label: string, value: string) => {
    ensureSpace(14);
    page.drawText(`${label}: ${value}`, { x: margin, y: cursorY, size: 10.5, font: regular, color: brand });
    cursorY -= 15;
  };

  drawHeader();

  renderPillLine(`Fecha de generacion`, formatDate(new Date()));
  renderPillLine(`Total mensual de gastos fijos`, formatPdfAmount(summary.monthlyTotal));
  if (typeof summary.ingresoMensual === "number") {
    renderPillLine(`Ingreso mensual`, formatPdfAmount(summary.ingresoMensual));
    renderPillLine(`Dinero restante`, formatPdfAmount(summary.dineroRestante ?? 0));
    renderPillLine(`Porcentaje destinado a gastos`, `${formatPdfPercentage(summary.porcentajeIngreso ?? 0)}%`);
  }

  renderSectionTitle("Resumen general");
  const summaryBoxHeight = 128;
  ensureSpace(summaryBoxHeight + 10);
  page.drawRectangle({
    x: margin,
    y: cursorY - summaryBoxHeight,
    width: contentWidth,
    height: summaryBoxHeight,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.86, 0.88, 0.92),
    borderWidth: 1
  });
  const summaryLines = [
    ["Numero de gastos", String(summary.count)],
    ["Total semanal estimado", formatPdfAmount(summary.weeklyTotal)],
    ["Total quincenal estimado", formatPdfAmount(summary.biweeklyTotal)],
    ["Total mensual", formatPdfAmount(summary.monthlyTotal)],
    ["Total anual", formatPdfAmount(summary.annualTotal)],
    ["Promedio por gasto", formatPdfAmount(summary.averagePerExpense)],
    ["Gasto mas alto", summary.highestExpense ? `${summary.highestExpense.concepto} (${formatPdfAmount(summary.highestExpense.monthly)})` : "Sin gastos"]
  ];
  let summaryY = cursorY - 18;
  summaryLines.forEach(([label, value], index) => {
    const isImportant = index === 3;
    page.drawText(label, { x: margin + 12, y: summaryY, size: isImportant ? 10 : 9, font: isImportant ? bold : regular, color: brand });
    page.drawText(value, {
      x: pageSize[0] - margin - 210,
      y: summaryY,
      size: isImportant ? 10 : 9,
      font: isImportant ? bold : regular,
      color: brand
    });
    summaryY -= 15;
  });
  cursorY -= summaryBoxHeight + 18;

  if (normalized.gastos.length) {
    renderSectionTitle("Tabla de gastos");
    const headers = ["Concepto", "Categoria", "Frecuencia", "Importe original", "Equiv. mensual"];
    const widths = [150, 95, 80, 95, 95];
    const headerHeight = 22;

    const rows = normalized.gastos.map((item) => [
      shorten(item.concepto || "Sin concepto", 26),
      shorten(item.categoria === "Otros" ? item.categoriaPersonalizada || "Otros" : item.categoria, 15),
      fixedExpenseSummaryFrequencyLabel(item.frecuencia),
        formatPdfAmount(Number(item.importe || 0)),
        formatPdfAmount(summary.monthlyById[item.id] ?? 0)
      ]);

    drawTableRow(page, regular, bold, headers, widths, margin, cursorY, headerHeight, rgb(0.95, 0.97, 0.99));
    cursorY -= headerHeight;
    rows.forEach((row, index) => {
      const maxLines = Math.max(
        ...row.map((value, columnIndex) => {
          const availableWidth = widths[columnIndex] - 12;
          const approxChars = Math.max(8, Math.floor(availableWidth / 4.6));
          return wrapText(value, approxChars).length;
        })
      );
      const neededHeight = Math.max(22, maxLines * 10 + 8);
      ensureSpace(neededHeight + 4);
      drawTableRow(page, regular, bold, row, widths, margin, cursorY, neededHeight, index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1));
      cursorY -= neededHeight;
    });
    cursorY -= 8;
  }

  if (summary.categoryTotals.length) {
    renderSectionTitle("Totales por categoria");
    const widths = [280, 170];
    const headers = ["Categoria", "Total mensual"];
    drawTableRow(page, regular, bold, headers, widths, margin, cursorY, 22, rgb(0.95, 0.97, 0.99));
    cursorY -= 22;
    summary.categoryTotals.forEach((item, index) => {
      ensureSpace(22);
      drawTableRow(
        page,
        regular,
        bold,
        [shorten(item.categoria, 32), formatPdfAmount(item.total)],
        widths,
        margin,
        cursorY,
        22,
        index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1)
      );
      cursorY -= 22;
    });
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    const pageNumber = index + 1;
    currentPage.drawText(`Generado el ${formatDate(new Date())}`, {
      x: margin,
      y: 20,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.49, 0.56)
    });
    currentPage.drawText(`Pagina ${pageNumber} de ${pages.length}`, {
      x: pageSize[0] - margin - 80,
      y: 20,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.49, 0.56)
    });
  });

  const bytes = await pdf.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}

function fixedExpenseSummaryFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "Semanal":
      return "Semanal";
    case "Quincenal":
      return "Quincenal";
    case "Mensual":
      return "Mensual";
    case "Bimestral":
      return "Bimestral";
    case "Trimestral":
      return "Trimestral";
    case "Semestral":
      return "Semestral";
    case "Anual":
      return "Anual";
    default:
      return "Mensual";
  }
}
