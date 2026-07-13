import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type SectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Section({ title, description, defaultOpen = true, actions, children, className }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label={open ? "Ocultar sección" : "Mostrar sección"}>
              <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      {open ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
