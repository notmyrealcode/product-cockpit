import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Shepherd: Tags/Pills - rounded-full, px-2 py-[2px] text-[11px] font-medium
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium transition-fast',
  {
    variants: {
      variant: {
        // Shepherd: Status badges - color-coded (neutral, primary, green, red)
        default: 'bg-neutral-100 text-neutral-600',
        primary: 'bg-primary/10 text-primary',
        secondary: 'bg-neutral-100 text-neutral-500',
        outline: 'border border-neutral-200 text-neutral-600 bg-transparent',
        // Task status variants with colored dot style
        todo: 'bg-neutral-100 text-neutral-600',
        'in-progress': 'bg-primary/10 text-primary',
        'ready-for-signoff': 'bg-purple-100 text-purple-700',
        done: 'bg-success/10 text-success',
        rework: 'bg-danger/10 text-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            variant === 'todo' && 'bg-neutral-400',
            variant === 'in-progress' && 'bg-primary',
            variant === 'ready-for-signoff' && 'bg-purple-500',
            variant === 'done' && 'bg-success',
            variant === 'rework' && 'bg-danger',
            !variant && 'bg-neutral-400'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
