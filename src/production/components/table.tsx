// Shared table primitives for Production tables.
// Matches the canonical CRM table look in src/pages/Enquiries.tsx
// (mono uppercase headers, 12.5px body, hairline borders).

import React from 'react';
import { cn } from '../../lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-g200 overflow-x-auto m-0', className)}>
      <table className="w-full border-collapse text-[12.5px]">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-g100">{children}</thead>;
}

export function TH({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      'font-mono text-[8.5px] font-bold tracking-[1.5px] uppercase text-g500',
      'px-[13px] py-[9px] text-left whitespace-nowrap border-b border-g200',
      className
    )}>
      {children}
    </th>
  );
}

export function TR({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors border-b border-g100 last:border-b-0',
        onClick && 'cursor-pointer hover:bg-red-mrt/5',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children, className, title, onClick, colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  colSpan?: number;
}) {
  return (
    <td
      className={cn('px-[13px] py-[10px] align-middle whitespace-nowrap', className)}
      title={title}
      onClick={onClick}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center p-8 text-g400 text-[13px]">
        {text ?? 'No records.'}
      </td>
    </tr>
  );
}

export function PageHeader({
  module, title, accent, subtitle, actions,
}: {
  module: string;
  title: React.ReactNode;
  accent?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="pt-5 px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-red-mrt mb-1">
            {module}
          </div>
          <h1 className="font-serif text-2xl text-blk tracking-tight leading-tight">
            {title}
            {accent && <em className="italic text-red-mrt ml-2">{accent}</em>}
          </h1>
          {subtitle && <p className="text-xs text-g500 mt-1 font-light">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 mt-1 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-g200 flex-wrap mt-0">
      {children}
    </div>
  );
}

export function StatusPill({
  status, tone = 'neutral',
}: {
  status: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  const map: Record<string, string> = {
    neutral: 'bg-g100 text-g600',
    good:    'bg-sW/10 text-sW',
    warn:    'bg-sP/10 text-sP',
    bad:     'bg-red-mrt/10 text-red-mrt',
    info:    'bg-sN/10 text-sN',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[10.5px] font-semibold whitespace-nowrap',
      map[tone]
    )}>
      <span className={cn('w-[5px] h-[5px] rounded-full shrink-0', {
        'bg-g500': tone === 'neutral',
        'bg-sW':   tone === 'good',
        'bg-sP':   tone === 'warn',
        'bg-red-mrt': tone === 'bad',
        'bg-sN':   tone === 'info',
      })} />
      {status}
    </span>
  );
}

export function toneForStage(stage: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  switch (stage) {
    case 'queued':     return 'neutral';
    case 'moulding':   return 'warn';
    case 'finishing':  return 'info';
    case 'inspection': return 'warn';
    case 'pdi':        return 'info';
    case 'dispatch':   return 'good';
    case 'dispatched': return 'good';
    default:           return 'neutral';
  }
}
export function toneForStatus(status: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  switch (status) {
    case 'queued':       return 'neutral';
    case 'setup':        return 'warn';
    case 'running':      return 'good';
    case 'in-progress':  return 'info';
    case 'passed':       return 'good';
    case 'pending':      return 'neutral';
    case 'ncr':          return 'bad';
    case 'awaiting':     return 'neutral';
    case 'in-review':    return 'warn';
    case 'ready':        return 'info';
    case 'dispatched':   return 'good';
    case 'late':         return 'bad';
    default:             return 'neutral';
  }
}
