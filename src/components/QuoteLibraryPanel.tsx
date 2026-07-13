import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { type SavedQuoteRecord } from "@/lib/quote-library";

type Props = {
  quotes: SavedQuoteRecord[];
  activeQuoteId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function QuoteLibraryPanel({ quotes, activeQuoteId, onSelect, onNew, onDuplicate, onDelete }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Cotizaciones guardadas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Reabre, duplica o borra una cotización para seguir con cambios inesperados.
            </p>
          </div>
          <Button type="button" size="lg" className="rounded-2xl" onClick={onNew}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-[420px] overflow-hidden md:max-h-[460px]">
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:max-h-[420px] md:grid-cols-2 md:overflow-y-auto md:pr-1 xl:grid-cols-3">
          {quotes.map((quote) => {
            const active = quote.id === activeQuoteId;
            return (
              <div
                key={quote.id}
                className={cn(
                  "min-w-[240px] flex-1 rounded-3xl border p-4 shadow-sm transition",
                  active ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="truncate">{quote.title}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Folio {quote.values.numeroCotizacion}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {active ? "Activa" : "Guardada"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <p className="truncate font-medium">{quote.values.cliente || "Sin cliente"}</p>
                  <p className="text-muted-foreground">{formatDate(quote.updatedAt)}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant={active ? "secondary" : "outline"} className="rounded-2xl" onClick={() => onSelect(quote.id)}>
                    Abrir
                  </Button>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onDuplicate(quote.id)}>
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>
                  <Button type="button" variant="destructive" className="rounded-2xl" onClick={() => onDelete(quote.id)}>
                    <Trash2 className="h-4 w-4" />
                    Borrar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
