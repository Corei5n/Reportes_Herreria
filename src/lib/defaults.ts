import { type QuoteFormValues } from "./quote-types";
import { nanoid } from "./nanoid";
import { generateQuoteFolio } from "./folio";

export function createDefaultQuote(): QuoteFormValues {
  const today = new Date();
  return {
    cliente: "",
    empresa: "",
    telefono: "",
    fecha: today.toISOString().slice(0, 10),
    numeroCotizacion: generateQuoteFolio(today),
    nombreProyecto: "",
    descripcionProyecto: "",
    materiales: [
      {
        id: nanoid(),
        descripcion: "",
        unidad: "pza",
        cantidad: 1,
        precioUnitario: 0
      }
    ],
    manoDeObra: [
      {
        id: nanoid(),
        descripcion: "",
        dias: 1,
        tarifaDia: 0
      }
    ],
    gastosAdicionales: [],
    margenGanancia: 20,
    descuento: 0,
    ivaActivo: false,
    notas: "",
    companiaNombre: "Tu empresa",
    companiaTelefono: "",
    companiaDireccion: "",
    logoDataUrl: ""
  };
}
