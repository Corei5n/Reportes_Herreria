import * as React from "react";
import { cn } from "@/lib/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground shadow-soft hover:opacity-95",
  secondary: "bg-muted text-foreground hover:bg-muted/80",
  ghost: "bg-transparent hover:bg-muted",
  destructive: "bg-destructive text-white hover:opacity-95",
  outline: "border border-border bg-background hover:bg-muted"
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-11 px-4 py-2",
  sm: "h-9 px-3 rounded-xl",
  lg: "h-12 px-5 text-base rounded-2xl",
  icon: "h-10 w-10"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
