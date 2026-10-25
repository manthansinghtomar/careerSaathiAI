import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon,
    className,
    id,
    type = 'text',
    disabled,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full space-y-1 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            'w-full h-10 rounded-md bg-white border text-sm text-slate-900 placeholder-slate-400',
            'transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-0',
            'disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed',
            Icon ? 'pl-10 pr-3.5' : 'px-3.5',
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500 text-rose-900'
              : 'border-slate-300 focus:border-[#0a66c2] focus:ring-[#0a66c2]',
            className
          )}
          {...props}
        />
      </div>

      {error ? (
        <p id={errorId} className="text-xs text-rose-600 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
