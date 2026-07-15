import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency, formatDate } from "@/lib/currency";
import { calculateFixedExpenseSummary, resolveExpenseCategory, type FixedExpensesState } from "@/lib/fixed-expenses";
import { drawTableRow, rgbFromHex } from "@/pdf/pdf-utils";

function formatPdfAmount(value: number): string {
  return formatCurrency(value);
}

function formatPdfPercentage(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

export async function buildFixedExpensesPdf(values: FixedExpensesState): Promise<Blob> {
  const summary = calculateFixedExpenseSummary(values);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 36;
  const contentWidth = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let cursorY = pageSize[1] - margin;
  const brand = rgbFromHex("#0f172a");
  const accent = rgbFromHex("#38bdf8");

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < margin + 80) {
      page = pdf.addPage(pageSize);
      cursorY = pageSize[1] - margin;
    }
  };

  const drawHeader = async () => {
    page.drawRectangle({ x: 0, y: pageSize[1] - 84, width: pageSize[0], height: 84, color: brand });
    page.drawCircle({ x: margin + 22, y: pageSize[1] - 46, size: 22, color: accent });
    page.drawText("GASTOS FIJOS", { x: margin + 58, y: pageSize[1] - 44, size: 20, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Resumen mensual local", { x: margin + 58, y: pageSize[1] - 62, size: 9, font: regular, color: rgb(0.86, 0.92, 0.98) });
    page.drawText("Los datos se guardan únicamente en este dispositivo.", {
      x: pageSize[0] - margin - 180,
      y: pageSize[1] - 62,
      size: 8.5,
      font: regular,
      color: rgb(0.86, 0.92, 0.98)
    });
    if (values.nombreDelHogar) {
      page.drawText(values.nombreDelHogar, {
        x: pageSize[0] - margin - 180,
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

  const renderTable = (rows: Array<string[]>, widths: number[], title: string, headers: string[]) => {
    renderSectionTitle(title);
    const headerHeight = 20;
    const rowHeight = 20;
    ensureSpace(headerHeight + rows.length * rowHeight + 20);
    drawTableRow(page, regular, bold, headers, widths, margin, cursorY, headerHeight, rgb(0.95, 0.97, 0.99));
    cursorY -= headerHeight;
    rows.forEach((row, index) => {
      ensureSpace(rowHeight + 4);
      drawTableRow(page, regular, bold, row, widths, margin, cursorY, rowHeight, index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1));
      cursorY -= rowHeight;
    });
    cursorY -= 8;
  };

  await drawHeader();

  page.drawText(`Fecha de generación: ${formatDate(new Date())}`, { x: margin, y: cursorY, size: 10.5, font: regular, color: brand });
  cursorY -= 16;
  page.drawText(`Total mensual de gastos fijos: ${formatPdfAmount(summary.monthlyTotal)}`, {
    x: margin,
    y: cursorY,
    size: 13,
    font: bold,
    color: brand
  });
  cursorY -= 26;

  if (typeof summary.ingresoMensual === "number") {
    page.drawText(`Ingreso mensual: ${formatPdfAmount(summary.ingresoMensual)}`, { x: margin, y: cursorY, size: 10.5, font: regular, color: brand });
    cursorY -= 15;
    page.drawText(`Dinero restante: ${formatPdfAmount(summary.dineroRestante ?? 0)}`, { x: margin, y: cursorY, size: 10.5, font: regular, color: brand });
    cursorY -= 15;
    page.drawText(`Porcentaje destinado a gastos: ${formatPdfPercentage(summary.porcentajeIngreso ?? 0)}%`, {
      x: margin,
      y: cursorY,
      size: 10.5,
      font: regular,
      color: brand
    });
    cursorY -= 18;
  }

  renderSectionTitle("Resumen general");
  const summaryBoxHeight = 122;
  ensureSpace(summaryBoxHeight + 10);
  page.drawRectangle({ x: margin, y: cursorY - summaryBoxHeight, width: contentWidth, height: summaryBoxHeight, color: rgb(0.98, 0.99, 1), borderColor: rgb(0.86, 0.88, 0.92), borderWidth: 1 });
  const summaryLines = [
    ["Número de gastos", String(summary.count)],
    ["Total semanal estimado", formatPdfAmount(summary.weeklyTotal)],
    ["Total quincenal estimado", formatPdfAmount(summary.biweeklyTotal)],
    ["Total mensual", formatPdfAmount(summary.monthlyTotal)],
    ["Total anual", formatPdfAmount(summary.annualTotal)],
    ["Promedio por gasto", formatPdfAmount(summary.averagePerExpense)],
    ["Gasto más alto", summary.highestExpense ? `${summary.highestExpense.concepto} (${formatPdfAmount(summary.highestExpense.monthly)})` : "Sin gastos"]
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

  if (summary.categoryTotals.length) {
    renderTable(
      summary.categoryTotals.map((item) => [item.categoria, formatPdfAmount(item.total)]),
      [340, 145],
      "Totales por categoría",
      ["Categoría", "Total mensual"]
    );
  }

  if (values.gastos.length) {
    renderTable(
      values.gastos.map((item) => [
        item.concepto,
        resolveExpenseCategory(item),
        item.frecuencia,
        formatPdfAmount(Number(item.importe || 0)),
        formatPdfAmount(summary.monthlyById[item.id] ?? 0)
      ]),
      [170, 110, 85, 95, 95],
      "Tabla de gastos",
      ["Concepto", "Categoría", "Frecuencia", "Importe", "Equiv. mensual"]
    );
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
    currentPage.drawText(`Página ${pageNumber} de ${pages.length}`, {
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
