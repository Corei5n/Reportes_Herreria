import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  installed: boolean;
  ios: boolean;
  canPromptInstall: boolean;
  onInstall: () => Promise<boolean>;
};

export function InstallPrompt({ installed, ios, canPromptInstall, onInstall }: Props) {
  if (installed) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Instala la app en tu iPhone o teléfono</p>
          <p className="text-sm text-muted-foreground">
            {ios
              ? "En Safari: toca Compartir y luego 'Añadir a pantalla de inicio'."
              : "Guárdala como app para usarla sin conexión y con acceso rápido."}
          </p>
        </div>
        {canPromptInstall ? (
          <Button type="button" variant="outline" onClick={() => void onInstall()} className="rounded-2xl">
            Instalar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
