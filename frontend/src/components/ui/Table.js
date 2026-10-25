import React from 'react';
import { cn } from '@/lib/utils';

export function Table({ children, className, ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table
        className={cn('w-full text-left text-sm text-slate-700', className)}
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
        'bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200',
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
    <tbody className={cn('divide-y divide-slate-100', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className, hover = true, ...props }) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100',
        hover && 'hover:bg-slate-50/70',
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
      className={cn('px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap', className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className, ...props }) {
  return (
    <td
      className={cn('px-4 py-3.5 align-middle text-sm text-slate-700', className)}
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
        className="px-4 py-8 text-center text-sm text-slate-400 italic"
      >
        {message}
      </td>
    </tr>
  );
}

export default Table;
