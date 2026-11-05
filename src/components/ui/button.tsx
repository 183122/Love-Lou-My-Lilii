import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "brand-gradient text-white shadow-lg shadow-sky-500/25 hover:shadow-violet-500/30 hover:brightness-105",
        secondary:
          "bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800",
        ghost: "text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800",
        danger: "bg-rose-500 text-white shadow-md shadow-rose-500/25 hover:bg-rose-600",
        soft: "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
export { buttonVariants };
