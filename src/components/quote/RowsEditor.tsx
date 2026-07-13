import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/RowActions";
import { type QuoteFormValues } from "@/lib/quote-types";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

type SectionName = "materiales" | "manoDeObra" | "gastosAdicionales";

type Props = {
  section: SectionName;
  title: string;
  subtitle: string;
  register: UseFormRegister<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  fields: Array<{ id: string; key: string }>;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onDuplicate: (index: number) => void;
};

export function RowsEditor({ section, title, subtitle, register, errors, fields, onAdd, onDelete, onDuplicate }: Props) {
  const isMaterial = section === "materiales";
  const isLabor = section === "manoDeObra";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-base font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button type="button" size="lg" className="rounded-2xl" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Agregar fila
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <Card key={field.key} className="animate-fade-in-up border-border/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`grid flex-1 gap-4 ${
                  isMaterial ? "md:grid-cols-4" : isLabor ? "md:grid-cols-3" : "md:grid-cols-2"
                }`}
              >
                {isMaterial ? (
                  <>
                    <Field label="Descripción" error={errors.materiales?.[index]?.descripcion?.message?.toString()} required>
                      <Input {...register(`materiales.${index}.descripcion`)} placeholder="Ej. Acero inoxidable" />
                    </Field>
                    <Field label="Unidad" error={errors.materiales?.[index]?.unidad?.message?.toString()} required>
                      <Input {...register(`materiales.${index}.unidad`)} placeholder="pza, kg, m, etc." />
                    </Field>
                    <Field label="Cantidad" error={errors.materiales?.[index]?.cantidad?.message?.toString()} required>
                      <Input {...register(`materiales.${index}.cantidad`, { valueAsNumber: true })} inputMode="decimal" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Precio unitario" error={errors.materiales?.[index]?.precioUnitario?.message?.toString()} required>
                      <Input {...register(`materiales.${index}.precioUnitario`, { valueAsNumber: true })} inputMode="decimal" type="number" min="0" step="0.01" />
                    </Field>
                  </>
                ) : isLabor ? (
                  <>
                    <Field label="Descripción" error={errors.manoDeObra?.[index]?.descripcion?.message?.toString()} required>
                      <Input {...register(`manoDeObra.${index}.descripcion`)} placeholder="Ej. Soldadura" />
                    </Field>
                    <Field label="Días" error={errors.manoDeObra?.[index]?.dias?.message?.toString()} required>
                      <Input {...register(`manoDeObra.${index}.dias`, { valueAsNumber: true })} inputMode="decimal" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Tarifa por día" error={errors.manoDeObra?.[index]?.tarifaDia?.message?.toString()} required>
                      <Input {...register(`manoDeObra.${index}.tarifaDia`, { valueAsNumber: true })} inputMode="decimal" type="number" min="0" step="0.01" />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Concepto" error={errors.gastosAdicionales?.[index]?.concepto?.message?.toString()} required>
                      <Input {...register(`gastosAdicionales.${index}.concepto`)} placeholder="Ej. Transporte" />
                    </Field>
                    <Field label="Monto" error={errors.gastosAdicionales?.[index]?.monto?.message?.toString()} required>
                      <Input {...register(`gastosAdicionales.${index}.monto`, { valueAsNumber: true })} inputMode="decimal" type="number" min="0" step="0.01" />
                    </Field>
                  </>
                )}
              </div>
              <RowActions onDuplicate={() => onDuplicate(index)} onDelete={() => onDelete(index)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
