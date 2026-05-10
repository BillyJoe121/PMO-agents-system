import { ReactNode } from 'react';
import { cn } from '../../ui/utils';

type PhaseScaffoldProps = {
  children: ReactNode;
  className?: string;
};

type PhaseReportSectionProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  accent?: 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
  className?: string;
};

const accentClasses = {
  blue: 'border-l-[#5454e9] bg-[linear-gradient(90deg,rgba(84,84,233,0.08),rgba(255,255,255,0))]',
  green: 'border-l-[#4cb979] bg-[linear-gradient(90deg,rgba(76,185,121,0.1),rgba(255,255,255,0))]',
  purple: 'border-l-[#865cf0] bg-[linear-gradient(90deg,rgba(134,92,240,0.09),rgba(255,255,255,0))]',
  orange: 'border-l-[#e9683b] bg-[linear-gradient(90deg,rgba(233,104,59,0.09),rgba(255,255,255,0))]',
  yellow: 'border-l-[#b5bd21] bg-[linear-gradient(90deg,rgba(228,235,96,0.18),rgba(255,255,255,0))]',
};

export function PhaseScaffold({ children, className }: PhaseScaffoldProps) {
  return (
    <div className={cn('brand-shell min-h-screen px-4 py-5 sm:px-6 lg:px-8', className)}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
    </div>
  );
}

export function PhaseReportSection({
  title,
  eyebrow,
  description,
  children,
  accent = 'blue',
  className,
}: PhaseReportSectionProps) {
  return (
    <section
      className={cn(
        'brand-report-section overflow-hidden border-l-4 p-0',
        accentClasses[accent],
        className,
      )}
    >
      <div className="border-b border-slate-200/80 bg-white/78 px-5 py-4">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#5454e9]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

