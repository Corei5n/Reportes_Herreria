import { Coins, FileDown, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { type QuoteTotals } from "@/lib/quote-types";
import { cn } from "@/lib/cn";

type Props = {
  totals: QuoteTotals;
  onGeneratePdf: () => void;
  className?: string;
};

const rows = [
  { label: "Costo materiales", key: "materiales" as const },
  { label: "Mano de obra", key: "manoDeObra" as const },
  { label: "Gastos", key: "gastosAdicionales" as const },
  { label: "Costo total", key: "costoTotal" as const },
  { label: "Descuento", key: "descuento" as const },
  { label: "Ganancia", key: "ganancia" as const },
  { label: "IVA", key: "iva" as const }
] as const;

export function SummaryCard({ totals, onGeneratePdf, className }: Props) {
  return (
    <Card className={cn("glass sticky top-4 z-20 overflow-hidden border-border/70", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Resumen en vivo</CardTitle>
            <p className="text-sm text-muted-foreground">Todo se calcula localmente.</p>
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <ReceiptText className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-2">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-semibold">{formatCurrency(totals[row.key])}</span>
            </div>
          ))}
        </div>
        <div className="rounded-3xl bg-primary px-4 py-4 text-primary-foreground shadow-glow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-primary-foreground/70">Total final</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.precioFinal)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <Coins className="h-6 w-6" />
            </div>
          </div>
        </div>
        <Button type="button" size="lg" className="w-full rounded-2xl" onClick={onGeneratePdf}>
          <FileDown className="h-4 w-4" />
          Generar PDF
        </Button>
      </CardContent>
    </Card>
  );
}
