import * as React from "react";
import { cn } from "@/lib/cn";

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-7 w-12 items-center rounded-full border border-border transition",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "ml-1 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-slate-100",
          checked && "translate-x-5"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";
