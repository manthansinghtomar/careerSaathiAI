import React from 'react';
import { cn } from '@/lib/utils';

const ICON_VARIANTS = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  primary: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  children,
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-sm',
        'hover:border-zinc-700 transition-all duration-200 flex flex-col justify-between text-left',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              {value}
            </h4>
            {trend && (
              <span
                className={cn(
                  'text-xs font-semibold px-1.5 py-0.5 rounded',
                  trend.isPositive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-rose-400 bg-rose-500/10'
                )}
              >
                {trend.value}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              'p-2.5 rounded-xl border shrink-0',
              ICON_VARIANTS[variant] || ICON_VARIANTS.default
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtitle || children) && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400">
          {subtitle && <p>{subtitle}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
