import { ReactNode } from 'react';
import { cn } from '../../ui/utils';

export type KeyValueItem = {
  label: string;
  value: ReactNode;
};

type KeyValueGridProps = {
  items: KeyValueItem[];
  columns?: 1 | 2 | 3;
  className?: string;
};

type InsightListProps = {
  items: ReactNode[];
  emptyText?: string;
  tone?: 'blue' | 'green' | 'purple' | 'orange';
  className?: string;
};

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
};

const toneClasses = {
  blue: 'border-l-[#5454e9] bg-[#5454e9]/6',
  green: 'border-l-[#4cb979] bg-[#4cb979]/8',
  purple: 'border-l-[#865cf0] bg-[#865cf0]/7',
  orange: 'border-l-[#e9683b] bg-[#e9683b]/7',
};

export function KeyValueGrid({ items, columns = 2, className }: KeyValueGridProps) {
  return (
    <dl className={cn('grid gap-3', columnClasses[columns], className)}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-semibold leading-6 text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InsightList({
  items,
  emptyText = 'Sin hallazgos registrados.',
  tone = 'blue',
  className,
}: InsightListProps) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn('rounded-lg border border-slate-200 border-l-4 px-4 py-3 text-sm text-slate-700', toneClasses[tone])}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

