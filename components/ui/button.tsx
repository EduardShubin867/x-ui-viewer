import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-45", {
  variants: {
    variant: {
      default: "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
      secondary: "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
      ghost: "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
      danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25",
    },
    size: { default: "h-9 px-4", sm: "h-8 px-3 text-xs", icon: "size-8" },
  }, defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }
export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(variants({ variant, size }), className)} {...props} />;
}
