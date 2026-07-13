import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RowActionsProps = {
  onDuplicate: () => void;
  onDelete: () => void;
};

export function RowActions({ onDuplicate, onDelete }: RowActionsProps) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" size="icon" onClick={onDuplicate} aria-label="Duplicar fila">
        <Copy className="h-4 w-4" />
      </Button>
      <Button type="button" variant="destructive" size="icon" onClick={onDelete} aria-label="Eliminar fila">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
