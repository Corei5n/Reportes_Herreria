import { z } from "zod";

export const lineItemSchema = z.object({
  id: z.string(),
  descripcion: z.string().trim().min(1, "Escribe una descripción."),
  unidad: z.string().trim().min(1, "Escribe la unidad."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().min(0, "El precio no puede ser negativo.")
});

export const laborItemSchema = z.object({
  id: z.string(),
  descripcion: z.string().trim().min(1, "Escribe una descripción."),
  dias: z.coerce.number().positive("Los días deben ser mayores a 0."),
  tarifaDia: z.coerce.number().min(0, "La tarifa no puede ser negativa.")
});

export const expenseItemSchema = z.object({
  id: z.string(),
  concepto: z.string().trim().min(1, "Escribe un concepto."),
  monto: z.coerce.number().min(0, "El monto no puede ser negativo.")
});

export const quoteSchema = z.object({
  cliente: z.string().trim().min(1, "Escribe el nombre del cliente."),
  empresa: z.string().trim().optional().or(z.literal("")),
  telefono: z.string().trim().min(1, "Escribe un teléfono."),
  correo: z.string().trim().email("Escribe un correo válido.").optional().or(z.literal("")),
  fecha: z.string().min(1, "Selecciona una fecha."),
  numeroCotizacion: z.string().trim().min(1, "Escribe un número de cotización."),
  nombreProyecto: z.string().trim().min(1, "Escribe el nombre del proyecto."),
  descripcionProyecto: z.string().trim().min(1, "Escribe la descripción del proyecto."),
  materiales: z.array(lineItemSchema).min(1, "Agrega al menos un material."),
  manoDeObra: z.array(laborItemSchema).min(1, "Agrega al menos una partida de mano de obra."),
  gastosAdicionales: z.array(expenseItemSchema),
  margenGanancia: z.coerce.number().min(0, "El margen no puede ser negativo."),
  descuento: z.coerce.number().min(0, "El descuento no puede ser negativo."),
  ivaActivo: z.boolean(),
  notas: z.string().optional().or(z.literal("")),
  companiaNombre: z.string().trim().optional().or(z.literal("")),
  companiaTelefono: z.string().trim().optional().or(z.literal("")),
  companiaDireccion: z.string().trim().optional().or(z.literal("")),
  logoDataUrl: z.string().optional().or(z.literal(""))
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type LaborItem = z.infer<typeof laborItemSchema>;
export type ExpenseItem = z.infer<typeof expenseItemSchema>;
export type QuoteFormValues = z.infer<typeof quoteSchema>;

export type QuoteTotals = {
  materiales: number;
  manoDeObra: number;
  gastosAdicionales: number;
  costoTotal: number;
  descuento: number;
  baseConDescuento: number;
  ganancia: number;
  subtotalAntesIVA: number;
  iva: number;
  precioFinal: number;
};
