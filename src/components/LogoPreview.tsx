import { Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type LogoPreviewProps = {
  logoDataUrl?: string;
  onChange: (value: string) => void;
};

export function LogoPreview({ logoDataUrl, onChange }: LogoPreviewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="Logo de la empresa" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">Logo</span>
          )}
        </div>
        <div>
          <p className="font-semibold">Logo de la empresa</p>
          <p className="text-sm text-muted-foreground">Se guarda localmente en este dispositivo.</p>
        </div>
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") onChange(reader.result);
            };
            reader.readAsDataURL(file);
          }}
        />
        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => inputRef.current?.click()}>
          <span className="inline-flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Subir logo
          </span>
        </Button>
      </div>
    </Card>
  );
}
