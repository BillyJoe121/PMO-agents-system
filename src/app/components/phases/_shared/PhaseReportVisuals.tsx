import type { ReactNode } from 'react';

export type PhaseReportTone = 'blue' | 'green' | 'amber' | 'orange' | 'purple' | 'red' | 'slate';

export const phaseReportToneStyles: Record<PhaseReportTone, { bg: string; text: string; border: string; soft: string; bar: string; icon: string }> = {
  blue: { bg: 'bg-[#5454e9]', text: 'text-[#3838b8]', border: 'border-[#5454e9]/20', soft: 'bg-[#5454e9]/[0.08]', bar: 'bg-[#5454e9]', icon: 'text-[#5454e9]' },
  green: { bg: 'bg-[#4cb979]', text: 'text-[#22794b]', border: 'border-[#4cb979]/25', soft: 'bg-[#4cb979]/10', bar: 'bg-[#4cb979]', icon: 'text-[#4cb979]' },
  amber: { bg: 'bg-[#e4eb60]', text: 'text-[#7a7f1e]', border: 'border-[#d7de43]/40', soft: 'bg-[#e4eb60]/25', bar: 'bg-[#d7de43]', icon: 'text-[#9aa11f]' },
  orange: { bg: 'bg-[#e9683b]', text: 'text-[#b74120]', border: 'border-[#e9683b]/25', soft: 'bg-[#e9683b]/10', bar: 'bg-[#e9683b]', icon: 'text-[#e9683b]' },
  purple: { bg: 'bg-[#865cf0]', text: 'text-[#5d3bbd]', border: 'border-[#865cf0]/25', soft: 'bg-[#865cf0]/10', bar: 'bg-[#865cf0]', icon: 'text-[#865cf0]' },
  red: { bg: 'bg-[#ef4444]', text: 'text-[#b91c1c]', border: 'border-[#ef4444]/25', soft: 'bg-[#ef4444]/10', bar: 'bg-[#ef4444]', icon: 'text-[#ef4444]' },
  slate: { bg: 'bg-neutral-900', text: 'text-neutral-800', border: 'border-neutral-200', soft: 'bg-neutral-50', bar: 'bg-neutral-900', icon: 'text-neutral-700' },
};

export const EMPTY_VALUE = 'N/A';

export function valueOrEmpty(value: unknown) {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return String(value);
}

export function normalizeList(items?: unknown[]) {
  return Array.isArray(items) && items.length > 0 ? items.map(valueOrEmpty) : [EMPTY_VALUE];
}

function normalizeToken(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function levelTone(value: unknown): PhaseReportTone {
  const token = normalizeToken(value);
  if (token.includes('alto') || token.includes('alta') || token.includes('critico')) return 'green';
  if (token.includes('medio') || token.includes('media') || token.includes('parcial') || token.includes('semi')) return 'amber';
  if (token.includes('bajo') || token.includes('baja') || token.includes('informal')) return 'orange';
  if (token.includes('ausencia') || token.includes('faltante') || token.includes('no ')) return 'red';
  return 'blue';
}

export function PhaseReportSection({ title, eyebrow, icon, tone = 'blue', children }: { title: string; eyebrow?: string; icon: ReactNode; tone?: PhaseReportTone; children: ReactNode }) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <section className={`rounded-[1.35rem] border ${toneClass.border} bg-white overflow-hidden`} style={{ boxShadow: '0 18px 44px -30px rgba(31,41,55,0.35)' }}>
      <div className={`h-1.5 ${toneClass.bar}`} />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${toneClass.soft} ${toneClass.icon} border ${toneClass.border} flex items-center justify-center`}>
              {icon}
            </div>
            <div>
              {eyebrow && <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1" style={{ fontWeight: 700 }}>{eyebrow}</p>}
              <h2 className="text-neutral-950 text-[18px] tracking-tight" style={{ fontWeight: 750 }}>{title}</h2>
            </div>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export function PhaseReportList({ items, tone = 'blue', mapItem }: { items?: unknown[]; tone?: PhaseReportTone; mapItem?: (value: unknown) => string }) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <ul className="space-y-2.5">
      {normalizeList(items).map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-neutral-700 text-[13px] leading-relaxed">
          <span className={`w-1.5 h-1.5 rounded-full mt-2 ${toneClass.bar} flex-shrink-0`} />
          <span>{mapItem ? mapItem(item) : item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PhaseReportBadgeList({ items, tone = 'blue', mapItem }: { items?: unknown[]; tone?: PhaseReportTone; mapItem?: (value: unknown) => string }) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <div className="flex flex-wrap gap-2">
      {normalizeList(items).map((item, i) => (
        <span key={i} className={`max-w-full px-2.5 py-1 rounded-full ${toneClass.soft} border ${toneClass.border} ${toneClass.text} text-[11px] truncate`} style={{ fontWeight: 650 }}>
          {mapItem ? mapItem(item) : valueOrEmpty(item)}
        </span>
      ))}
    </div>
  );
}

export function PhaseReportMetric({ label, value, tone = 'blue', icon }: { label: string; value: unknown; tone?: PhaseReportTone; icon?: ReactNode }) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <div className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} px-4 py-3 min-w-0`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 leading-tight break-words min-w-0" style={{ fontWeight: 700 }}>{label}</p>
        {icon && <span className={`${toneClass.icon} flex-shrink-0`}>{icon}</span>}
      </div>
      <p className={`mt-1 text-[24px] tabular-nums tracking-tight ${toneClass.text}`} style={{ fontWeight: 800 }}>{valueOrEmpty(value)}</p>
    </div>
  );
}

export function PhaseReportKeyValueGrid({ rows, compact = false }: { rows: { label: string; value: unknown; tone?: PhaseReportTone }[]; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2'} gap-2.5`}>
      {rows.map((row) => {
        const toneClass = phaseReportToneStyles[row.tone ?? levelTone(row.value)];
        return (
          <div key={row.label} className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} px-3.5 py-3 min-w-0 overflow-hidden`}>
            <p className="text-[9px] uppercase tracking-[0.12em] text-neutral-500 mb-1 truncate" style={{ fontWeight: 700 }}>{row.label}</p>
            <p className={`text-[13px] leading-snug break-words ${toneClass.text}`} style={{ fontWeight: 700 }}>{valueOrEmpty(row.value)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function PhaseReportProgressBar({ label, value, max, tone = 'blue' }: { label: string; value: number; max: number; tone?: PhaseReportTone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-neutral-500" style={{ fontWeight: 650 }}>{label}</span>
        <span className="text-[11px] tabular-nums text-neutral-500">{valueOrEmpty(value)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full ${phaseReportToneStyles[tone].bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PhaseReportEvidenceCard({ title, subtitle, description, references, badge, tone, mapText, mapReference }: {
  title: unknown;
  subtitle?: unknown;
  description: unknown;
  references?: unknown[];
  badge?: unknown;
  tone: PhaseReportTone;
  mapText?: (value: unknown) => string;
  mapReference?: (value: unknown) => string;
}) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(title)}</p>
            {subtitle && <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>{valueOrEmpty(subtitle).replace(/_/g, ' ')}</p>}
          </div>
          {badge && (
            <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
              {valueOrEmpty(badge).replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="mt-3 text-neutral-600 text-[13px] leading-relaxed">{mapText ? mapText(description) : valueOrEmpty(description)}</p>
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Fuentes documentales</p>
          <PhaseReportBadgeList items={references} mapItem={mapReference} tone={tone} />
        </div>
      </div>
    </article>
  );
}

export function PhaseReportMiniList({ title, items, tone, mapItem }: { title: string; items?: unknown[]; tone: PhaseReportTone; mapItem?: (value: unknown) => string }) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <p className={`text-[10px] uppercase tracking-[0.12em] ${toneClass.text}`} style={{ fontWeight: 850 }}>{title}</p>
          <span className={`w-2 h-2 rounded-full ${toneClass.bar} flex-shrink-0`} />
        </div>
        <PhaseReportList items={items} tone={tone} mapItem={mapItem} />
      </div>
    </article>
  );
}
