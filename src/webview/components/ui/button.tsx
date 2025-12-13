import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Shepherd: Buttons - Primary (filled), Secondary (neutral border), Ghost (transparent), Destructive (red)
// Sizes: small, medium only
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: filled with primary color
        default: 'bg-primary text-neutral-0 hover:bg-primary-hover',
        // Secondary: neutral border
        secondary: 'border border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300',
        // Ghost: transparent, hover bg
        ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800',
        // Destructive: red
        destructive: 'bg-danger text-neutral-0 hover:bg-red-700',
        // Link style
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Shepherd: small and medium only
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
