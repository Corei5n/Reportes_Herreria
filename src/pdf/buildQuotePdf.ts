import { PDFDocument, PDFPage, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { calculateTotals } from "@/lib/calc";
import { COMPANY_PROFILE } from "@/lib/company-profile";
import { formatCurrency, formatDate } from "@/lib/currency";
import { type QuoteFormValues } from "@/lib/quote-types";
import { drawTableRow, drawTextBlock, embedOptionalImage, rgbFromHex, wrapText } from "@/pdf/pdf-utils";

type QuotePdfMode = "workshop" | "client";

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  pageNumber: number;
  cursorY: number;
};

const PAGE_SIZE: [number, number] = [612, 792];
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;
const BRAND = rgbFromHex("#1f2833");
const ACCENT = rgbFromHex("#c65d1d");
const LIGHT = rgb(0.97, 0.98, 1);
const BORDER = rgb(0.86, 0.88, 0.92);
const SUBTLE = rgb(0.45, 0.49, 0.56);

function cleanText(value: string | undefined, fallback = ""): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

function shorten(value: string, maxLength: number): string {
  const clean = value.trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function formatOptionalInteger(value: unknown, fallback: number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}` : `${fallback}`;
}

async function sourceToDataUrl(source: string): Promise<string> {
  if (source.startsWith("data:")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`No se pudo cargar la imagen: ${source}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer la imagen."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

async function loadLogo(pdf: PDFDocument, values: QuoteFormValues): Promise<PDFImage | null> {
  const source = cleanText(values.logoDataUrl, COMPANY_PROFILE.logoUrl);
  try {
    const dataUrl = await sourceToDataUrl(source);
    return await embedOptionalImage(pdf, dataUrl);
  } catch {
    return null;
  }
}

function createContext(pdf: PDFDocument): PdfContext {
  return {
    pdf,
    page: pdf.addPage(PAGE_SIZE),
    pageNumber: 1,
    cursorY: PAGE_SIZE[1] - MARGIN
  };
}

function drawPageFooter(page: PDFPage, regular: Awaited<ReturnType<PDFDocument["embedFont"]>>, pageNumber: number, totalPages: number) {
  page.drawText(`Generado el ${formatDate(new Date())}`, {
    x: MARGIN,
    y: 20,
    size: 8,
    font: regular,
    color: SUBTLE
  });
  page.drawText(`Página ${pageNumber} de ${totalPages}`, {
    x: PAGE_SIZE[0] - MARGIN - 90,
    y: 20,
    size: 8,
    font: regular,
    color: SUBTLE
  });
}

function startNewPage(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  title: string
) {
  ctx.pageNumber += 1;
  ctx.page = ctx.pdf.addPage(PAGE_SIZE);
  ctx.cursorY = PAGE_SIZE[1] - MARGIN;
  ctx.page.drawText(COMPANY_PROFILE.name, { x: MARGIN, y: ctx.cursorY, size: 13, font: bold, color: BRAND });
  ctx.page.drawText(title, { x: PAGE_SIZE[0] - MARGIN - 160, y: ctx.cursorY - 2, size: 9, font: regular, color: SUBTLE, maxWidth: 150 });
  ctx.cursorY -= 24;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY, width: CONTENT_WIDTH, height: 1, color: ACCENT });
  ctx.cursorY -= 10;
}

function ensureSpace(
  ctx: PdfContext,
  needed: number,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  title: string
) {
  if (ctx.cursorY - needed < MARGIN + 64) {
    startNewPage(ctx, regular, bold, title);
  }
}

function drawHeader(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  values: QuoteFormValues,
  mode: QuotePdfMode,
  logoImage: PDFImage | null
) {
  const boxSize = 132;
  const boxX = PAGE_SIZE[0] - MARGIN - boxSize;
  const boxY = PAGE_SIZE[1] - 170;

  ctx.page.drawText(`[ ${COMPANY_PROFILE.name.toUpperCase()} ]`, {
    x: MARGIN,
    y: ctx.cursorY - 10,
    size: 23,
    font: bold,
    color: rgb(0.13, 0.16, 0.2)
  });
  ctx.cursorY -= 32;
  ctx.page.drawText(COMPANY_PROFILE.categoryLine, { x: MARGIN, y: ctx.cursorY, size: 11.5, font: bold, color: ACCENT });
  ctx.cursorY -= 22;
  ctx.page.drawText(`Tel/WhatsApp: ${COMPANY_PROFILE.phone}`, { x: MARGIN, y: ctx.cursorY, size: 10.5, font: regular, color: SUBTLE });
  ctx.cursorY -= 15;
  ctx.page.drawText(`Correo: ${COMPANY_PROFILE.email}`, { x: MARGIN, y: ctx.cursorY, size: 10.5, font: regular, color: SUBTLE });
  ctx.cursorY -= 15;

  const infoWidth = boxX - MARGIN - 14;
  ctx.cursorY = drawTextBlock(
    ctx.page,
    regular,
    `Dirección: ${cleanText(values.companiaDireccion, COMPANY_PROFILE.workshopAddress)}`,
    MARGIN,
    ctx.cursorY,
    infoWidth,
    10.1,
    SUBTLE
  ) + 1;
  ctx.cursorY = drawTextBlock(ctx.page, regular, `Atención: ${COMPANY_PROFILE.owner}`, MARGIN, ctx.cursorY, infoWidth, 10.1, SUBTLE) - 4;

  ctx.page.drawRectangle({ x: boxX, y: boxY, width: boxSize, height: boxSize, color: rgb(0.91, 0.92, 0.95) });
  if (logoImage) {
    const scaled = logoImage.scaleToFit(boxSize - 18, boxSize - 18);
    ctx.page.drawImage(logoImage, {
      x: boxX + (boxSize - scaled.width) / 2,
      y: boxY + (boxSize - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height
    });
  } else {
    ctx.page.drawText("[ LOGO]", { x: boxX + 32, y: boxY + 62, size: 18, font: bold, color: rgb(0.5, 0.55, 0.62) });
    ctx.page.drawText("(coloca aquí tu logotipo)", { x: boxX + 14, y: boxY + 44, size: 10, font: regular, color: rgb(0.5, 0.55, 0.62) });
  }
  ctx.cursorY = boxY - 30;

  const leftWidth = 360;
  const bandY = ctx.cursorY - 64;
  const bandTitle = mode === "client" ? "COTIZACIÓN" : "COTIZACIÓN INTERNA";
  ctx.page.drawRectangle({ x: MARGIN, y: bandY, width: leftWidth, height: 64, color: BRAND });
  ctx.page.drawRectangle({ x: MARGIN + leftWidth, y: bandY, width: CONTENT_WIDTH - leftWidth, height: 64, color: ACCENT });
  ctx.page.drawText(bandTitle, { x: MARGIN + 16, y: bandY + 22, size: 24, font: bold, color: rgb(1, 1, 1) });
  ctx.page.drawText(`N.º: ${values.numeroCotizacion}`, { x: MARGIN + leftWidth + 12, y: bandY + 38, size: 10, font: bold, color: rgb(1, 1, 1) });
  ctx.page.drawText(`Fecha: ${formatDate(values.fecha)}`, { x: MARGIN + leftWidth + 12, y: bandY + 18, size: 10, font: bold, color: rgb(1, 1, 1) });
  ctx.cursorY = bandY - 28;
}

function drawSectionTitle(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  title: string
) {
  ensureSpace(ctx, 28, regular, bold, title);
  ctx.page.drawText(title, { x: MARGIN, y: ctx.cursorY, size: 14, font: bold, color: BRAND });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY - 5, width: CONTENT_WIDTH, height: 1, color: ACCENT });
  ctx.cursorY -= 22;
}

function drawInfoGrid(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  items: Array<{ label: string; value: string }>
) {
  ensureSpace(ctx, 108, regular, bold, "Datos del cliente");
  const boxWidth = CONTENT_WIDTH / 2;
  const rowHeight = 48;
  items.slice(0, 4).forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * boxWidth;
    const y = ctx.cursorY - row * rowHeight;
    ctx.page.drawRectangle({ x, y: y - rowHeight + 2, width: boxWidth, height: rowHeight, color: LIGHT, borderColor: BORDER, borderWidth: 0.8 });
    ctx.page.drawText(item.label.toUpperCase(), { x: x + 10, y: y - 15, size: 8.5, font: bold, color: ACCENT });
    drawTextBlock(ctx.page, regular, item.value || "—", x + 10, y - 30, boxWidth - 20, 10.2, BRAND);
  });
  ctx.cursorY -= 104;
}

function estimateRowHeight(row: string[], widths: number[]) {
  const maxLines = row.reduce((acc, value, index) => {
    const approxChars = Math.max(8, Math.floor((widths[index] - 14) / 4.2));
    return Math.max(acc, wrapText(value, approxChars).length);
  }, 1);
  return Math.max(22, maxLines * 10 + 10);
}

function renderTable(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  sectionTitle: string,
  headers: string[],
  widths: number[],
  rows: string[][]
) {
  drawSectionTitle(ctx, regular, bold, sectionTitle);
  const headerHeight = 20;
  ensureSpace(ctx, headerHeight + 20, regular, bold, sectionTitle);
  drawTableRow(ctx.page, regular, bold, headers, widths, MARGIN, ctx.cursorY, headerHeight, rgb(0.24, 0.28, 0.33), rgb(1, 1, 1));
  ctx.cursorY -= headerHeight;

  rows.forEach((row, index) => {
    const rowHeight = estimateRowHeight(row, widths);
    if (ctx.cursorY - rowHeight < MARGIN + 48) {
      startNewPage(ctx, regular, bold, `Continúa ${sectionTitle}`);
      drawSectionTitle(ctx, regular, bold, sectionTitle);
      drawTableRow(ctx.page, regular, bold, headers, widths, MARGIN, ctx.cursorY, headerHeight, rgb(0.24, 0.28, 0.33), rgb(1, 1, 1));
      ctx.cursorY -= headerHeight;
    }
    drawTableRow(ctx.page, regular, bold, row, widths, MARGIN, ctx.cursorY, rowHeight, index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1));
    ctx.cursorY -= rowHeight;
  });

  ctx.cursorY -= 10;
}

function drawSummaryBlock(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  rows: Array<[string, string]>,
  height: number
) {
  ensureSpace(ctx, height + 10, regular, bold, "Resumen");
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY - height, width: CONTENT_WIDTH, height, color: LIGHT, borderColor: BORDER, borderWidth: 1 });
  let y = ctx.cursorY - 18;
  rows.forEach(([left, right], index) => {
    const important = index === rows.length - 1;
    ctx.page.drawText(left, { x: MARGIN + 12, y, size: important ? 10.5 : 9.5, font: important ? bold : regular, color: BRAND });
    ctx.page.drawText(right, { x: PAGE_SIZE[0] - MARGIN - 148, y, size: important ? 10.5 : 9.5, font: important ? bold : regular, color: BRAND });
    y -= 12;
  });
  ctx.cursorY -= height + 18;
}

function drawClientConditions(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  values: QuoteFormValues
) {
  ctx.pageNumber += 1;
  ctx.page = ctx.pdf.addPage(PAGE_SIZE);
  ctx.cursorY = PAGE_SIZE[1] - MARGIN;

  ctx.page.drawText(COMPANY_PROFILE.name, { x: MARGIN, y: ctx.cursorY, size: 13, font: bold, color: BRAND });
  ctx.page.drawText("Condiciones", { x: PAGE_SIZE[0] - MARGIN - 90, y: ctx.cursorY, size: 9, font: regular, color: SUBTLE, maxWidth: 90 });
  ctx.cursorY -= 26;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY, width: CONTENT_WIDTH, height: 1, color: ACCENT });
  ctx.cursorY -= 22;

  ctx.page.drawText("CONDICIONES", { x: MARGIN, y: ctx.cursorY, size: 14, font: bold, color: BRAND });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY - 5, width: CONTENT_WIDTH, height: 1, color: ACCENT });
  ctx.cursorY -= 38;

  const boxWidth = (CONTENT_WIDTH - 12) / 2;
  const boxHeight = 154;
  const boxY = ctx.cursorY - boxHeight;
  const leftX = MARGIN;
  const rightX = MARGIN + boxWidth + 12;

  const renderConditionBox = (x: number, title: string, lines: string[]) => {
    ctx.page.drawRectangle({ x, y: boxY, width: boxWidth, height: boxHeight, color: LIGHT, borderColor: BORDER, borderWidth: 1 });
    ctx.page.drawText(title, { x: x + 12, y: boxY + boxHeight - 22, size: 11.1, font: bold, color: ACCENT });
    let y = boxY + boxHeight - 42;
    lines.forEach((line) => {
      y = drawTextBlock(ctx.page, regular, line, x + 12, y, boxWidth - 24, 9.6, BRAND) - 7;
    });
  };

  renderConditionBox(leftX, "CONDICIONES DE PAGO", [
    `• Anticipo: ${formatOptionalInteger(values.anticipoPorcentaje, 50)}% para iniciar`,
    "• Saldo: contra entrega",
    "• Forma de pago: efectivo / transferencia"
  ]);

  renderConditionBox(rightX, "ENTREGA Y GARANTÍA", [
    `• Tiempo de entrega: ${formatOptionalInteger(values.tiempoEntregaDias, 7)} días`,
    `• Garantía: ${formatOptionalInteger(values.garantiaDias, 30)} días en soldadura y estructura`,
    `• Vigencia de esta cotización: ${formatOptionalInteger(values.vigenciaDias, 15)} días`
  ]);

  ctx.cursorY = boxY - 28;
}

function drawSignaturePage(
  ctx: PdfContext,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  mode: QuotePdfMode
) {
  ctx.pageNumber += 1;
  ctx.page = ctx.pdf.addPage(PAGE_SIZE);
  ctx.cursorY = PAGE_SIZE[1] - MARGIN;

  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY - 74, width: CONTENT_WIDTH, height: 74, color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 1 });
  ctx.page.drawText(
    mode === "client"
      ? "Nota: cualquier trabajo o cambio adicional se cotiza y se cobra por separado."
      : "Nota: esta versión sirve para revisar costos internos, materiales y mano de obra antes de emitir la cotización final.",
    { x: MARGIN + 12, y: ctx.cursorY - 48, size: 9.5, font: regular, color: BRAND, maxWidth: CONTENT_WIDTH - 24 }
  );

  ctx.cursorY -= 118;
  drawSectionTitle(ctx, regular, bold, "ACEPTACIÓN");
  ctx.page.drawText("Al firmar, el cliente acepta la descripción, el precio y las condiciones de esta cotización.", {
    x: MARGIN,
    y: ctx.cursorY,
    size: 9.5,
    font: regular,
    color: SUBTLE,
    maxWidth: CONTENT_WIDTH
  });
  ctx.cursorY -= 52;
  ctx.page.drawLine({ start: { x: MARGIN + 50, y: ctx.cursorY }, end: { x: MARGIN + 215, y: ctx.cursorY }, thickness: 0.8, color: BORDER });
  ctx.page.drawLine({ start: { x: PAGE_SIZE[0] - MARGIN - 215, y: ctx.cursorY }, end: { x: PAGE_SIZE[0] - MARGIN - 50, y: ctx.cursorY }, thickness: 0.8, color: BORDER });
  ctx.page.drawText("Por la herrería", { x: MARGIN + 86, y: ctx.cursorY - 16, size: 11, font: bold, color: BRAND });
  ctx.page.drawText("Nombre y firma", { x: MARGIN + 86, y: ctx.cursorY - 31, size: 9, font: regular, color: SUBTLE });
  ctx.page.drawText("Acepta el cliente", { x: PAGE_SIZE[0] - MARGIN - 140, y: ctx.cursorY - 16, size: 11, font: bold, color: BRAND });
  ctx.page.drawText("Nombre y firma", { x: PAGE_SIZE[0] - MARGIN - 140, y: ctx.cursorY - 31, size: 9, font: regular, color: SUBTLE });

  ctx.cursorY -= 88;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.cursorY - 28, width: CONTENT_WIDTH, height: 1, color: BORDER });
  ctx.page.drawText(`Gracias por su confianza · ${COMPANY_PROFILE.name}`, {
    x: PAGE_SIZE[0] / 2 - 120,
    y: ctx.cursorY - 50,
    size: 10.5,
    font: regular,
    color: SUBTLE,
    maxWidth: 240
  });
  ctx.page.drawText(COMPANY_PROFILE.owner, {
    x: PAGE_SIZE[0] / 2 - 55,
    y: ctx.cursorY - 64,
    size: 10.5,
    font: bold,
    color: ACCENT,
    maxWidth: 210
  });
}

function buildWorkshopMaterialRows(values: QuoteFormValues) {
  return values.materiales.map((item) => [
    item.cantidad.toFixed(2).replace(/\.00$/, ""),
    shorten(item.descripcion, 44),
    shorten(item.unidad, 14),
    formatCurrency(item.cantidad * item.precioUnitario)
  ]);
}

function buildClientMaterialRows(values: QuoteFormValues) {
  return values.materiales.map((item) => [
    item.cantidad.toFixed(2).replace(/\.00$/, ""),
    item.descripcion,
    item.unidad
  ]);
}

function buildLaborRows(values: QuoteFormValues) {
  return values.manoDeObra.map((item) => [
    item.dias.toFixed(2).replace(/\.00$/, ""),
    shorten(item.descripcion, 44),
    "Día",
    formatCurrency(item.dias * item.tarifaDia)
  ]);
}

function buildExpenseRows(values: QuoteFormValues) {
  return values.gastosAdicionales.map((item) => ["1", shorten(item.concepto, 44), "-", formatCurrency(item.monto)]);
}

async function buildQuotePdfInternal(values: QuoteFormValues, mode: QuotePdfMode): Promise<Blob> {
  const totals = calculateTotals(values);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx = createContext(pdf);
  const logoImage = await loadLogo(pdf, values);

  drawHeader(ctx, regular, bold, values, mode, logoImage);

  drawSectionTitle(ctx, regular, bold, "DATOS DEL CLIENTE");
  drawInfoGrid(ctx, regular, bold, [
    { label: "Cliente", value: cleanText(values.cliente, "[ nombre completo o empresa ]") },
    { label: "Teléfono / Contacto", value: cleanText(values.telefono, "[ teléfono o correo del cliente ]") },
    { label: "Domicilio / Obra", value: cleanText(values.obraDireccion, "[ lugar donde se realiza el trabajo ]") },
    { label: "Atención a", value: COMPANY_PROFILE.owner }
  ]);

  drawSectionTitle(ctx, regular, bold, mode === "client" ? "DETALLE DEL TRABAJO" : "DETALLE INTERNO DEL TALLER");
  const projectDescription = cleanText(
    values.descripcionProyecto,
    mode === "client"
      ? "Describe aquí el alcance del trabajo, materiales, medidas, calibre, acabado y cualquier detalle importante."
      : "Describe aquí el alcance interno del trabajo, materiales, medidas, calibre, acabado y cualquier detalle importante."
  );

  ensureSpace(ctx, 120, regular, bold, "Detalle del trabajo");
  const detailBoxHeight = 96;
  const detailBoxTop = ctx.cursorY;
  ctx.page.drawRectangle({ x: MARGIN, y: detailBoxTop - detailBoxHeight, width: CONTENT_WIDTH, height: detailBoxHeight, color: LIGHT, borderColor: BORDER, borderWidth: 1 });
  ctx.page.drawText("DESCRIPCIÓN DEL TRABAJO", { x: MARGIN + 12, y: detailBoxTop - 18, size: 9, font: bold, color: ACCENT });
  const detailBottomY = drawTextBlock(ctx.page, regular, projectDescription, MARGIN + 12, detailBoxTop - 34, CONTENT_WIDTH - 24, 9.2, BRAND);
  ctx.cursorY = detailBottomY - 20;

  if (mode === "client") {
    renderTable(ctx, regular, bold, "Especificaciones de Materiales", ["CANT.", "RESUMEN DEL MATERIAL", "UNIDAD"], [56, 352, 132], buildClientMaterialRows(values));
  } else {
    renderTable(ctx, regular, bold, "Materiales", ["CANT.", "DESCRIPCIÓN DEL TRABAJO", "UNIDAD", "IMPORTE"], [48, 250, 74, 168], buildWorkshopMaterialRows(values));
    if (values.manoDeObra.length) {
      renderTable(ctx, regular, bold, "Mano de obra", ["CANT.", "DESCRIPCIÓN DEL TRABAJO", "UNIDAD", "IMPORTE"], [48, 250, 74, 168], buildLaborRows(values));
    }
    if (values.gastosAdicionales.length) {
      renderTable(ctx, regular, bold, "Gastos adicionales", ["CANT.", "DESCRIPCIÓN DEL TRABAJO", "UNIDAD", "IMPORTE"], [48, 250, 74, 168], buildExpenseRows(values));
    }
  }

  const summaryRows: Array<[string, string]> =
    mode === "client"
      ? [
          ["Subtotal", formatCurrency(totals.costoTotal)],
          ["IVA (si aplica)", formatCurrency(totals.iva)],
          ["TOTAL", formatCurrency(totals.precioFinal)]
        ]
      : [
          ["Costo materiales", formatCurrency(totals.materiales)],
          ["Costo mano de obra", formatCurrency(totals.manoDeObra)],
          ["Gastos adicionales", formatCurrency(totals.gastosAdicionales)],
          ["Costo total", formatCurrency(totals.costoTotal)],
          ["Descuento", formatCurrency(totals.descuento)],
          ["Margen de ganancia", formatCurrency(totals.ganancia)],
          ["IVA", formatCurrency(totals.iva)],
          ["TOTAL FINAL", formatCurrency(totals.precioFinal)]
        ];

  drawSummaryBlock(ctx, regular, bold, summaryRows, mode === "client" ? 96 : 126);

  if (mode === "client") {
    drawClientConditions(ctx, regular, bold, values);
  } else {
    drawSectionTitle(ctx, regular, bold, "OBSERVACIONES INTERNAS");
    ctx.cursorY = drawTextBlock(
      ctx.page,
      regular,
      cleanText(values.notas, "Usa este espacio para revisar criterios, ajustes de precio, tiempos de compra o control de material."),
      MARGIN,
      ctx.cursorY,
      CONTENT_WIDTH,
      9.5,
      SUBTLE
    ) - 8;
    ctx.page.drawText(`Control interno · ${COMPANY_PROFILE.owner}`, { x: MARGIN, y: ctx.cursorY, size: 10.5, font: bold, color: ACCENT, maxWidth: CONTENT_WIDTH });
    ctx.cursorY -= 20;
  }

  drawSignaturePage(ctx, regular, bold, mode);

  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    drawPageFooter(page, regular, index + 1, pages.length);
  });

  const bytes = await pdf.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}

export async function buildClientQuotePdf(values: QuoteFormValues): Promise<Blob> {
  return await buildQuotePdfInternal(values, "client");
}

export async function buildWorkshopQuotePdf(values: QuoteFormValues): Promise<Blob> {
  return await buildQuotePdfInternal(values, "workshop");
}

export async function buildQuotePdf(values: QuoteFormValues): Promise<Blob> {
  return await buildWorkshopQuotePdf(values);
}
