import { type QuoteFormValues } from "./quote-types";
import { nanoid } from "./nanoid";

const today = new Date();

export function createDefaultQuote(): QuoteFormValues {
  return {
    cliente: "",
    empresa: "",
    telefono: "",
    fecha: today.toISOString().slice(0, 10),
    numeroCotizacion: `COT-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
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
