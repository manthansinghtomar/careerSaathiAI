import React from 'react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  primary: 'bg-blue-50 text-[#0a66c2] border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  outline: 'bg-transparent text-slate-600 border-slate-300',
};

const DOT_COLORS = {
  default: 'bg-slate-400',
  primary: 'bg-[#0a66c2]',
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
  outline: 'bg-slate-400',
};

const SIZES = {
  sm: 'text-[11px] px-2 py-0.5 rounded-full gap-1',
  md: 'text-xs px-2.5 py-1 rounded-full gap-1.5',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border whitespace-nowrap select-none',
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            DOT_COLORS[variant] || DOT_COLORS.default
          )}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
