import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
  hint?: string;
  required?: boolean;
};

export function Field({ label, error, children, className, hint, required }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="flex items-center gap-1 text-sm text-foreground">
        <span>{label}</span>
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
