import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-[#0a66c2] text-white hover:bg-[#004182] focus-visible:ring-blue-600 shadow-sm border border-transparent font-semibold',
  secondary:
    'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 focus-visible:ring-slate-400 font-semibold shadow-xs',
  outline:
    'border border-[#0a66c2] bg-transparent text-[#0a66c2] hover:bg-blue-50 focus-visible:ring-blue-600 font-semibold',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
  danger:
    'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 focus-visible:ring-rose-500 font-semibold',
  success:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 focus-visible:ring-emerald-500 font-semibold',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs rounded-full gap-1.5',
  md: 'h-10 px-5 text-sm rounded-full gap-2',
  lg: 'h-11 px-6 text-base rounded-full gap-2.5',
  icon: 'h-10 w-10 p-0 rounded-full justify-center',
};

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled = false,
  icon: Icon,
  type = 'button',
  ...props
}) {
  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99]',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {children}
        </>
      )}
    </button>
  );
}

export default Button;
