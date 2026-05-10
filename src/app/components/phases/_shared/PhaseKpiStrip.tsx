import { ReactNode } from 'react';
import { cn } from '../../ui/utils';

export type PhaseKpiTone = 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'neutral';

export type PhaseKpiItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: PhaseKpiTone;
};

type PhaseKpiStripProps = {
  items: PhaseKpiItem[];
  className?: string;
};

const toneClasses: Record<PhaseKpiTone, string> = {
  blue: 'border-[#5454e9]/25 bg-[#5454e9]/7 text-[#5454e9]',
  green: 'border-[#4cb979]/30 bg-[#4cb979]/10 text-[#217d4a]',
  purple: 'border-[#865cf0]/25 bg-[#865cf0]/9 text-[#6f3edc]',
  orange: 'border-[#e9683b]/25 bg-[#e9683b]/9 text-[#bd3e18]',
  yellow: 'border-[#d8df4e]/40 bg-[#e4eb60]/18 text-[#747b00]',
  neutral: 'border-slate-200 bg-white text-slate-700',
};

export function PhaseKpiStrip({ items, className }: PhaseKpiStripProps) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={cn(
            'rounded-lg border px-4 py-3 shadow-sm transition-colors',
            toneClasses[item.tone ?? 'neutral'],
          )}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">
            {item.label}
          </p>
          <div className="mt-2 text-2xl font-black leading-none text-slate-950">{item.value}</div>
          {item.detail ? <div className="mt-2 text-xs font-semibold opacity-80">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

