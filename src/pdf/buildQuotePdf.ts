import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate } from "@/lib/currency";
import { calculateTotals } from "@/lib/calc";
import { type QuoteFormValues } from "@/lib/quote-types";
import { drawTableRow, drawTextBlock, embedOptionalImage, rgbFromHex } from "@/pdf/pdf-utils";

export async function buildQuotePdf(values: QuoteFormValues): Promise<Blob> {
  const totals = calculateTotals(values);
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

  const drawHeader = async () => {
    page.drawRectangle({ x: 0, y: pageSize[1] - 84, width: pageSize[0], height: 84, color: brand });
    if (values.logoDataUrl) {
      try {
        const image = await embedOptionalImage(pdf, values.logoDataUrl);
        page.drawImage(image, { x: margin, y: pageSize[1] - 68, width: 44, height: 44 });
      } catch {
        page.drawCircle({ x: margin + 22, y: pageSize[1] - 46, size: 22, color: accent });
      }
    } else {
      page.drawCircle({ x: margin + 22, y: pageSize[1] - 46, size: 22, color: accent });
    }
    page.drawText("COTIZACIÓN", { x: margin + 58, y: pageSize[1] - 44, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText(values.companiaNombre || "Tu empresa", { x: margin + 58, y: pageSize[1] - 62, size: 9, font: regular, color: rgb(0.86, 0.92, 0.98) });
    page.drawText(values.companiaTelefono || "Tel. / WhatsApp", { x: pageSize[0] - margin - 120, y: pageSize[1] - 44, size: 9, font: regular, color: rgb(0.86, 0.92, 0.98) });
    cursorY = pageSize[1] - 106;
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < margin + 80) {
      page = pdf.addPage(pageSize);
      cursorY = pageSize[1] - margin;
      page.drawText(`Cotización ${values.numeroCotizacion}`, { x: margin, y: cursorY - 10, size: 13, font: bold, color: brand });
      cursorY -= 28;
    }
  };

  const renderSectionTitle = (title: string) => {
    ensureSpace(34);
    page.drawText(title, { x: margin, y: cursorY, size: 14, font: bold, color: brand });
    page.drawRectangle({ x: margin, y: cursorY - 5, width: contentWidth, height: 1, color: accent });
    cursorY -= 22;
  };

  await drawHeader();

  page.drawText(`Folio: ${values.numeroCotizacion}`, { x: margin, y: cursorY, size: 11, font: bold, color: brand });
  page.drawText(`Fecha: ${formatDate(values.fecha)}`, { x: pageSize[0] - margin - 160, y: cursorY, size: 11, font: regular, color: brand });
  cursorY -= 28;

  renderSectionTitle("Datos del cliente");
  page.drawText(`Cliente: ${values.cliente}`, { x: margin, y: cursorY, size: 10, font: regular, color: brand });
  cursorY -= 14;
  if (values.empresa) {
    page.drawText(`Empresa: ${values.empresa}`, { x: margin, y: cursorY, size: 10, font: regular, color: brand });
    cursorY -= 14;
  }
  page.drawText(`Teléfono: ${values.telefono}`, { x: margin, y: cursorY, size: 10, font: regular, color: brand });
  cursorY -= 14;
  cursorY -= 6;

  renderSectionTitle("Proyecto");
  cursorY = drawTextBlock(page, regular, values.nombreProyecto, margin, cursorY, contentWidth, 10, brand) - 2;
  cursorY = drawTextBlock(page, regular, values.descripcionProyecto, margin, cursorY, contentWidth, 9, rgb(0.2, 0.24, 0.3)) - 8;

  const renderTable = (
    title: string,
    rows: Array<[string, string, string, string, string]>,
    widths: number[]
  ) => {
    renderSectionTitle(title);
    const headerHeight = 20;
    const rowHeight = 20;
    const columns = ["Descripción", "Unidad", "Cantidad", "Precio", "Subtotal"];
    ensureSpace(headerHeight + rows.length * rowHeight + 20);
    drawTableRow(page, regular, bold, columns, widths, margin, cursorY, headerHeight, rgb(0.95, 0.97, 0.99));
    cursorY -= headerHeight;
    rows.forEach((row, rowIndex) => {
      ensureSpace(rowHeight + 4);
      drawTableRow(page, regular, bold, row, widths, margin, cursorY, rowHeight, rowIndex % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1));
      cursorY -= rowHeight;
    });
    cursorY -= 8;
  };

  renderTable(
    "Materiales",
    values.materiales.map((item) => [
      item.descripcion,
      item.unidad,
      item.cantidad.toFixed(2).replace(/\.00$/, ""),
      item.precioUnitario.toFixed(2),
      (item.cantidad * item.precioUnitario).toFixed(2)
    ]),
    [180, 60, 70, 95, 90]
  );

  renderTable(
    "Mano de obra",
    values.manoDeObra.map((item) => [
      item.descripcion,
      "Día",
      item.dias.toFixed(2).replace(/\.00$/, ""),
      item.tarifaDia.toFixed(2),
      (item.dias * item.tarifaDia).toFixed(2)
    ]),
    [190, 50, 70, 100, 85]
  );

  if (values.gastosAdicionales.length) {
    renderTable(
      "Gastos adicionales",
      values.gastosAdicionales.map((item) => [item.concepto, "-", "-", item.monto.toFixed(2), item.monto.toFixed(2)]),
      [200, 50, 50, 110, 85]
    );
  }

  ensureSpace(130);
  page.drawRectangle({ x: margin, y: cursorY - 112, width: contentWidth, height: 112, color: rgb(0.98, 0.99, 1), borderColor: rgb(0.86, 0.88, 0.92), borderWidth: 1 });
  page.drawText("Resumen", { x: margin + 12, y: cursorY - 18, size: 13, font: bold, color: brand });
  const summaryLines = [
    ["Costo materiales", totals.materiales],
    ["Costo mano de obra", totals.manoDeObra],
    ["Gastos adicionales", totals.gastosAdicionales],
    ["Costo total", totals.costoTotal],
    ["Descuento", totals.descuento],
    ["Margen de ganancia", totals.ganancia],
    ["IVA", totals.iva],
    ["TOTAL FINAL", totals.precioFinal]
  ];
  let summaryY = cursorY - 36;
  summaryLines.forEach(([label, value], index) => {
    const isFinal = index === summaryLines.length - 1;
    page.drawText(String(label), { x: margin + 12, y: summaryY, size: isFinal ? 11 : 9.5, font: isFinal ? bold : regular, color: brand });
    page.drawText(`$${Number(value).toFixed(2)}`, {
      x: pageSize[0] - margin - 100,
      y: summaryY,
      size: isFinal ? 11 : 9.5,
      font: isFinal ? bold : regular,
      color: brand
    });
    summaryY -= 11;
  });
  cursorY -= 128;

  if (values.notas) {
    renderSectionTitle("Notas");
    cursorY = drawTextBlock(page, regular, values.notas, margin, cursorY, contentWidth, 9, rgb(0.22, 0.25, 0.3)) - 6;
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
