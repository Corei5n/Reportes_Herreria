import { formatDate } from "./currency";
import { type QuoteFormValues, type QuoteTotals } from "./quote-types";

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function calculateTotals(values: QuoteFormValues): QuoteTotals {
  const materiales = sum(values.materiales.map((item) => Number(item.cantidad || 0) * Number(item.precioUnitario || 0)));
  const manoDeObra = sum(values.manoDeObra.map((item) => Number(item.dias || 0) * Number(item.tarifaDia || 0)));
  const gastosAdicionales = sum(values.gastosAdicionales.map((item) => Number(item.monto || 0)));
  const costoTotal = materiales + manoDeObra + gastosAdicionales;
  const descuento = Math.min(Math.max(Number(values.descuento || 0), 0), costoTotal);
  const baseConDescuento = Math.max(costoTotal - descuento, 0);
  const ganancia = baseConDescuento * (Math.max(Number(values.margenGanancia || 0), 0) / 100);
  const subtotalAntesIVA = baseConDescuento + ganancia;
  const iva = values.ivaActivo ? subtotalAntesIVA * 0.16 : 0;
  const precioFinal = subtotalAntesIVA + iva;

  return {
    materiales,
    manoDeObra,
    gastosAdicionales,
    costoTotal,
    descuento,
    baseConDescuento,
    ganancia,
    subtotalAntesIVA,
    iva,
    precioFinal
  };
}

export function toPdfDate(value: string): string {
  return formatDate(value);
}
