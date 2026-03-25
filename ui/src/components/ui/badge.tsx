import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 font-label text-[10px] uppercase tracking-[0.22em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/14 text-primary",
        secondary: "border-transparent bg-secondary/90 text-secondary-foreground",
        outline: "border-border/80 text-foreground",
        accent: "border-transparent bg-accent/18 text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
