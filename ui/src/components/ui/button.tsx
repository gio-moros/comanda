import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-label text-[11px] uppercase tracking-[0.22em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(18,91,101,0.18)] hover:-translate-y-0.5 hover:bg-primary/95",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-[0_10px_24px_rgba(66,50,27,0.08)] hover:-translate-y-0.5 hover:bg-secondary/92",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-secondary/70",
        outline:
          "border-border/80 bg-[rgba(255,251,243,0.82)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] hover:-translate-y-0.5 hover:bg-[rgba(255,248,236,0.96)]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-8 px-3.5 text-[10px]",
        lg: "h-12 px-8 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
