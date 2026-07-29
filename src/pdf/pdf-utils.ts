import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export function rgbFromHex(hex: string) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}

export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function drawTextBlock(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color = rgb(0.1, 0.13, 0.2)
) {
  const lines = wrapText(text, Math.max(8, Math.floor(width / (size * 0.55))));
  let currentY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= size + 2;
  }
  return currentY;
}

export function drawTableRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  columns: string[],
  widths: number[],
  x: number,
  y: number,
  height: number,
  fill?: ReturnType<typeof rgb>,
  textColor: ReturnType<typeof rgb> = rgb(0.15, 0.18, 0.24)
) {
  let currentX = x;
  if (fill) {
    page.drawRectangle({ x, y: y - height + 2, width: widths.reduce((a, b) => a + b, 0), height, color: fill });
  }
  columns.forEach((column, index) => {
    page.drawRectangle({ x: currentX, y: y - height + 2, width: widths[index], height, borderColor: rgb(0.86, 0.88, 0.92), borderWidth: 0.8 });
    page.drawText(column, {
      x: currentX + 6,
      y: y - 13,
      size: 8.0,
      font: index === 0 ? bold : font,
      color: textColor,
      maxWidth: Math.max(10, widths[index] - 12),
      lineHeight: 8.8
    });
    currentX += widths[index];
  });
}

async function fileToDataUrl(blob: Blob): Promise<string> {
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

export async function resolveImageDataUrl(source: string): Promise<string> {
  if (source.startsWith("data:")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`No se pudo cargar la imagen: ${source}`);
  return await fileToDataUrl(await response.blob());
}

export async function embedOptionalImage(pdf: PDFDocument, dataUrlOrPath: string) {
  const dataUrl = await resolveImageDataUrl(dataUrlOrPath);
  const base64 = dataUrl.split(",")[1];
  const mime = dataUrl.split(";")[0].split(":")[1];
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (mime === "image/png") return pdf.embedPng(bytes);
  return pdf.embedJpg(bytes);
}
