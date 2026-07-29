import { type QuoteFormValues } from "./quote-types";
import { nanoid } from "./nanoid";
import { generateQuoteFolio } from "./folio";
import { COMPANY_PROFILE } from "./company-profile";

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
    ivaActivo: true,
    anticipoPorcentaje: 50,
    tiempoEntregaDias: 7,
    garantiaDias: 30,
    vigenciaDias: 15,
    notas: "",
    companiaNombre: COMPANY_PROFILE.name,
    companiaTelefono: COMPANY_PROFILE.phone,
    companiaDireccion: COMPANY_PROFILE.workshopAddress,
    obraDireccion: "",
    logoDataUrl: ""
  };
}
