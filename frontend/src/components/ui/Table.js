import React from 'react';
import { cn } from '@/lib/utils';

export function Table({ children, className, ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
      <table
        className={cn('w-full text-left text-sm text-zinc-300', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className, ...props }) {
  return (
    <thead
      className={cn(
        'bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800',
        className
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }) {
  return (
    <tbody className={cn('divide-y divide-zinc-800/60', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className, hover = true, ...props }) {
  return (
    <tr
      className={cn(
        'transition-colors',
        hover && 'hover:bg-zinc-800/40',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className, ...props }) {
  return (
    <th
      scope="col"
      className={cn('px-4 py-3.5 font-medium whitespace-nowrap', className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className, ...props }) {
  return (
    <td
      className={cn('px-4 py-3.5 align-middle text-sm text-zinc-300', className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan = 5, message = 'No records found' }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-8 text-center text-sm text-zinc-500 italic"
      >
        {message}
      </td>
    </tr>
  );
}

export default Table;
