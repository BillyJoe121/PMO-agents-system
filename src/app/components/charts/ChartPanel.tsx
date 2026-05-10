import { ReactNode } from 'react';
import { cn } from '../ui/utils';

type ChartPanelProps = {
  title: string;
  description?: string;
  accent?: 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
  children: ReactNode;
  className?: string;
};

const accentClasses = {
  blue: 'from-[#5454e9]/12',
  green: 'from-[#4cb979]/14',
  purple: 'from-[#865cf0]/12',
  orange: 'from-[#e9683b]/12',
  yellow: 'from-[#e4eb60]/22',
};

export function ChartPanel({
  title,
  description,
  accent = 'blue',
  children,
  className,
}: ChartPanelProps) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
      <div className={cn('border-b border-slate-200 bg-gradient-to-r to-white px-5 py-4', accentClasses[accent])}>
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

