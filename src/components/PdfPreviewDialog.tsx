import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string | null;
};

export function PdfPreviewDialog({ open, onClose, pdfUrl }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center">
      <Card className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Vista previa del PDF</p>
            <p className="text-sm text-muted-foreground">Revisa antes de descargar o compartir.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 bg-muted">
          {pdfUrl ? <iframe title="Vista previa del PDF" src={pdfUrl} className="h-full w-full" /> : null}
        </div>
      </Card>
    </div>
  );
}
