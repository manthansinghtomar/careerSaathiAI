import React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No data available',
  description = 'There are currently no items to display in this section.',
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center',
        'rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30',
        className
      )}
    >
      <div className="p-3.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 mb-4">
        <Icon className="w-6 h-6" />
      </div>

      <h4 className="text-base font-semibold text-zinc-200">{title}</h4>

      {description && (
        <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
