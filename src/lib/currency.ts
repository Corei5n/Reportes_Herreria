export const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string | Date): string {
  const date =
    typeof value === "string"
      ? value.includes("T")
        ? new Date(value)
        : new Date(`${value}T12:00:00`)
      : value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}
