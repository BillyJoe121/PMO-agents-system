import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type ModernTooltipProps = TooltipProps<ValueType, NameType> & {
  valueFormatter?: (value: ValueType) => string;
};

export function ModernTooltip({ active, payload, label, valueFormatter }: ModernTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
      {label ? <p className="mb-1 font-bold text-slate-950">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? '#5454e9' }}
              />
              {entry.name}
            </span>
            <span className="font-black text-slate-950">
              {valueFormatter ? valueFormatter(entry.value) : String(entry.value ?? '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

