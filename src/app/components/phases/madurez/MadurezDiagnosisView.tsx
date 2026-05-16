import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PhaseReportKeyValueGrid,
  PhaseReportList,
  PhaseReportMetric,
  PhaseReportSection,
  PhaseReportTone,
  phaseReportToneStyles,
  valueOrEmpty,
} from '../_shared/PhaseReportVisuals';
import { ModernTooltip, chartColors, chartFont, phaseChartPalette } from '../../charts';
import ModernMaturityBIDashboard from './MaturityBIDashboard';

type MadurezDiagnosisViewProps = {
  results: any;
  pmoType: string;
  pmoColor: string;
  approved?: boolean;
  completedAt?: string;
  comment?: string;
  savedComment?: string;
  isSavingComment?: boolean;
  isReprocessing?: boolean;
  onCommentChange?: (value: string) => void;
  onSaveComment?: () => void;
  onReprocess?: () => void;
  onApprove?: () => void;
};

const maturityLevelNames = ['Informal', 'Basico', 'Estandar', 'Avanzado', 'Excelencia'];
const severityTone: Record<string, PhaseReportTone> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'blue',
};

function wrapLabel(value: unknown, maxChars = 12) {
  const words = valueOrEmpty(value).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function WrappedAxisTick({ x, y, payload }: any) {
  const lines = wrapLabel(payload?.value, 13);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={chartColors.axis} fontFamily={chartFont.fontFamily} fontSize={11} fontWeight={700}>
        {lines.map((line, index) => (
          <tspan key={line} x={0} dy={index === 0 ? 12 : 13}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

function MaturityChartPanel({ title, description, children, noPadding }: { title: string; description: string; children: ReactNode; noPadding?: boolean }) {
  return (
    <section className="rounded-[1.35rem] border border-[#5454e9]/15 bg-white overflow-hidden" style={{ boxShadow: '0 18px 44px -32px rgba(84,84,233,0.42)' }}>
      <div className="h-1.5 bg-[#5454e9]" />
      <div className="px-5 py-4 border-b border-neutral-100 bg-white">
        <h3 className="text-[16px] tracking-tight text-neutral-950" style={{ fontWeight: 850 }}>{title}</h3>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{description}</p>}
      </div>
      <div className={noPadding ? 'p-0' : 'p-4 md:p-5'}>{children}</div>
    </section>
  );
}

function toFivePointScale(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 5 ? numeric / 20 : numeric;
  return Math.max(0, Math.min(5, Number(scaled.toFixed(1))));
}

function formatOneDecimal(value: unknown) {
  return toFivePointScale(value).toFixed(1);
}

function formatTimestamp(value: string) {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return valueOrEmpty(value);
  return ts.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPrimaryMaturity(results: any) {
  return results?.predictiva ?? results?.agil ?? {};
}

function scoreEntries(map?: Record<string, any>) {
  if (!map) return [];
  return Object.entries(map).map(([key, data]) => ({
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    score: toFivePointScale(data?.score ?? data),
    nivel: data?.nivel ?? '',
  }));
}

function getSummaryText(results: any) {
  return results?.summary?.trim()
    || results?.recommendations?.slice(0, 2).join(' ')
    || results?.analisis_cualitativo?.temas_recurrentes?.[0]?.sintesis
    || 'Diagnostico generado por el Agente 5 con los insumos disponibles.';
}

function toneForScore(score: number): PhaseReportTone {
  if (score >= 4) return 'green';
  if (score >= 3) return 'blue';
  if (score >= 2) return 'amber';
  return 'orange';
}

function VersionBadge({ results, approved }: { results: any; approved?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] border whitespace-nowrap ${results.version === 'reprocesado' ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-[#5454e9]/20 text-neutral-700'}`} style={{ fontWeight: 750 }}>
      {results.version === 'reprocesado' ? <RefreshCw size={12} /> : <Sparkles size={12} className="text-[#5454e9]" />}
      <span>Diagnostico {results.version === 'reprocesado' ? 'reprocesado' : 'original'}</span>
      <span className="opacity-50">·</span>
      <span>{approved ? 'Aprobado' : formatTimestamp(results.timestamp)}</span>
    </div>
  );
}

function MaturityHero({ results, pmoType, pmoColor, approved, completedAt }: {
  results: any;
  pmoType: string;
  pmoColor: string;
  approved?: boolean;
  completedAt?: string;
}) {
  const score = toFivePointScale(results.overallScore);
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const tone = toneForScore(score);
  const toneClass = phaseReportToneStyles[tone];
  const radialData = [{ name: 'Madurez', value: pct, fill: pmoColor }];

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[#5454e9]/20 bg-white" style={{ boxShadow: '0 24px 60px -38px rgba(84,84,233,0.45)' }}>
      <div className="h-2 bg-[#5454e9]" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px]">
        <div className="p-7 bg-white">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-7">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-2" style={{ fontWeight: 800 }}>Fase 5 · PMO {pmoType}</p>
              <h1 className="text-neutral-950 tracking-tight" style={{ fontWeight: 850, fontSize: '2.35rem', lineHeight: 1.02 }}>
                {approved ? 'Diagnostico de madurez aprobado' : 'Diagnostico de madurez'}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
                Nivel consolidado del Agente 5 para orientar la guia metodologica y las prioridades de mejora.
              </p>
            </div>
            <div className="xl:pt-1 self-start">
              <VersionBadge results={results} approved={approved} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PhaseReportMetric label="Nivel global" value={results.overallLabel || maturityLevelNames[(results.overallLevel || 1) - 1]} tone={tone} icon={<Target size={15} />} />
            <PhaseReportMetric label="Score" value={`${formatOneDecimal(results.overallScore)} / 5`} tone={tone} icon={<Gauge size={15} />} />
            <PhaseReportMetric label="Tipo aprobado" value={pmoType} tone="blue" icon={<Layers size={15} />} />
          </div>

          {completedAt && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/80 border border-white px-3 py-1.5 text-[12px] text-neutral-700" style={{ fontWeight: 700 }}>
              <CheckCircle2 size={13} className="text-[#4cb979]" />
              Aprobado el {completedAt}
            </div>
          )}
        </div>

        <div className="p-6 border-t lg:border-l lg:border-t-0 border-[#5454e9]/10 flex flex-col justify-center bg-[#5454e9]/[0.035]">
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="72%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={18} background={{ fill: '#eef0f7' }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-36 mb-20 pointer-events-none">
            <p className={`text-[42px] tabular-nums ${toneClass.text}`} style={{ fontWeight: 900, lineHeight: 1 }}>{formatOneDecimal(results.overallScore)}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400" style={{ fontWeight: 800 }}>de 5.0</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExecutiveCharts({ results }: { results: any }) {
  const phaseRows = scoreEntries(results.predictiva?.por_fase).map((row) => ({ ...row, label: `${row.label} Pred.` }));
  const domainRows = [
    ...scoreEntries(results.predictiva?.por_dominio).map((row) => ({ ...row, label: `${row.label} Pred.` })),
    ...scoreEntries(results.agil?.por_factor).map((row) => ({ ...row, label: `${row.label} Agil` })),
  ];
  const topRows = [...phaseRows, ...domainRows]
    .filter((row) => row.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);
  const compositionRows = [
    results.predictiva ? { name: 'Predictiva', value: toFivePointScale(results.predictiva.score), level: results.predictiva.level, color: chartColors.blue } : null,
    results.agil ? { name: 'Agil', value: toFivePointScale(results.agil.score), level: results.agil.level, color: chartColors.green } : null,
  ].filter(Boolean) as { name: string; value: number; level?: number; color: string }[];
  const qualitativeRows = (results.analisis_cualitativo?.temas_recurrentes ?? []).map((item: any, index: number) => ({
    name: item.tema,
    value: Number(item.frecuencia) || 0,
    fill: phaseChartPalette[index % phaseChartPalette.length],
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-5">
      <MaturityChartPanel title="Prioridades de cierre de brechas" description="Menores puntajes ordenados para lectura ejecutiva." noPadding>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topRows} margin={{ top: 60, right: 60, left: 30, bottom: 30 }} barCategoryGap={8}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" interval={0} height={58} tick={<WrappedAxisTick />} />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ ...chartFont, fill: chartColors.axis, fontSize: 11 }} />
              <Tooltip content={<ModernTooltip valueFormatter={(value) => formatOneDecimal(value)} />} />
              <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]} maxBarSize={82} isAnimationActive={false}>
                {topRows.map((row, index) => (
                  <Cell key={row.key} fill={phaseChartPalette[index % phaseChartPalette.length]} />
                ))}
                <LabelList dataKey="score" position="top" formatter={(value: unknown) => formatOneDecimal(value)} style={{ fill: chartColors.label, fontSize: 13, fontWeight: 900, fontFamily: chartFont.fontFamily }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </MaturityChartPanel>

      <div className="grid grid-cols-1 gap-5">
        <MaturityChartPanel title="Madurez por enfoque" description="Comparacion del enfoque aplicable.">
          <div className="space-y-5 py-1">
            {compositionRows.length > 0 ? (
              compositionRows.map((row) => {
                const pct = Math.max(0, Math.min(100, (row.value / 5) * 100));
                return (
                  <div key={row.name} className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[13px] text-neutral-950" style={{ fontWeight: 850 }}>{row.name}</p>
                        <p className="text-[11px] text-neutral-500">Nivel {valueOrEmpty(row.level)}</p>
                      </div>
                      <span className="text-[20px] tabular-nums" style={{ color: row.color, fontWeight: 900 }}>{formatOneDecimal(row.value)}</span>
                    </div>
                    <div className="h-5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.color }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-neutral-400 tabular-nums">
                      <span>0</span>
                      <span>2.5</span>
                      <span>5.0</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-[160px] flex items-center justify-center text-[13px] text-neutral-400">Sin datos de enfoque</div>
            )}
          </div>
        </MaturityChartPanel>

        {qualitativeRows.length > 0 && (
          <MaturityChartPanel title="Temas recurrentes" description="Frecuencia en respuestas abiertas.">
            <div className="space-y-4">
              {qualitativeRows.map((row) => (
                <div key={row.name}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-neutral-800" style={{ fontWeight: 800 }}>{row.name}</span>
                    <span className="tabular-nums text-neutral-500" style={{ fontWeight: 800 }}>{row.value}</span>
                  </div>
                  <div className="h-4 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.value * 25)}%`, background: row.fill }} />
                  </div>
                </div>
              ))}
            </div>
          </MaturityChartPanel>
        )}
      </div>
    </div>
  );
}

function GapsAndStrengths({ results }: { results: any }) {
  const gaps = [
    ...(results.predictiva?.gaps ?? []).map((item: any) => ({ ...item, enfoque: 'Predictivo' })),
    ...(results.agil?.gaps ?? []).map((item: any) => ({ ...item, enfoque: 'Agil' })),
  ];
  const strengths = [
    ...(results.predictiva?.fortalezas ?? []).map((item: any) => ({ ...item, enfoque: 'Predictivo' })),
    ...(results.agil?.fortalezas ?? []).map((item: any) => ({ ...item, enfoque: 'Agil' })),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <PhaseReportSection title="Brechas principales" eyebrow="Prioridad" icon={<ShieldAlert size={18} />} tone="orange">
        <div className="space-y-3">
          {gaps.length > 0 ? gaps.map((gap: any, index: number) => (
            <article key={`${gap.nombre}-${index}`} className="rounded-2xl border border-[#e9683b]/20 bg-[#e9683b]/[0.05] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(gap.nombre)}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[#b74120]" style={{ fontWeight: 800 }}>{valueOrEmpty(gap.tipo)} · {valueOrEmpty(gap.nivel)}</p>
                </div>
                <span className="rounded-full bg-white border border-[#e9683b]/20 px-2.5 py-1 text-[11px] text-[#b74120]" style={{ fontWeight: 850 }}>{formatOneDecimal(gap.score)}</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">{valueOrEmpty(gap.impacto_potencial)}</p>
            </article>
          )) : <PhaseReportList items={['No se reportaron brechas especificas para el enfoque principal.']} tone="orange" />}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Fortalezas" eyebrow="Capacidades" icon={<TrendingUp size={18} />} tone="green">
        <div className="space-y-3">
          {strengths.length > 0 ? strengths.map((item: any, index: number) => (
            <article key={`${item.nombre}-${index}`} className="rounded-2xl border border-[#4cb979]/20 bg-[#4cb979]/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(item.nombre)}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[#22794b]" style={{ fontWeight: 800 }}>{valueOrEmpty(item.tipo)} · {valueOrEmpty(item.nivel)}</p>
                </div>
                <span className="rounded-full bg-white border border-[#4cb979]/20 px-2.5 py-1 text-[11px] text-[#22794b]" style={{ fontWeight: 850 }}>{formatOneDecimal(item.score)}</span>
              </div>
            </article>
          )) : <PhaseReportList items={['No se reportaron fortalezas especificas para el enfoque principal.']} tone="green" />}
        </div>
      </PhaseReportSection>
    </div>
  );
}

function AnalysisDetails({ results }: { results: any }) {
  const topGaps = results.top_gaps ?? [];
  const qualitative = results.analisis_cualitativo;
  const cross = results.analisis_cruzado;

  if (!topGaps.length && !qualitative?.temas_recurrentes?.length && !cross?.aplica) return null;

  return (
    <PhaseReportSection title="Lecturas complementarias" eyebrow="Analisis" icon={<BarChart3 size={18} />} tone="purple">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topGaps.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-3" style={{ fontWeight: 800 }}>Top brechas criticas</p>
            <div className="space-y-2.5">
              {topGaps.map((gap: any, index: number) => {
                const tone = severityTone[gap.severity] ?? 'amber';
                const toneClass = phaseReportToneStyles[tone];
                return (
                  <div key={`${gap.area}-${index}`} className={`flex items-center justify-between gap-3 rounded-xl border ${toneClass.border} ${toneClass.soft} px-3 py-2`}>
                    <span className="text-[13px] text-neutral-800" style={{ fontWeight: 700 }}>{valueOrEmpty(gap.area)}</span>
                    <span className={`text-[10px] uppercase ${toneClass.text}`} style={{ fontWeight: 850 }}>{valueOrEmpty(gap.severity)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {qualitative?.temas_recurrentes?.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-1" style={{ fontWeight: 800 }}>Analisis cualitativo</p>
            <p className="text-[11px] text-neutral-500 mb-3">{valueOrEmpty(qualitative.total_respuestas_abiertas)} respuestas abiertas procesadas</p>
            <div className="space-y-3">
              {qualitative.temas_recurrentes.map((theme: any, index: number) => (
                <article key={`${theme.tema}-${index}`} className="border-l-4 border-[#4cb979] pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] text-neutral-900" style={{ fontWeight: 800 }}>{valueOrEmpty(theme.tema)}</p>
                    <span className="rounded-full bg-[#4cb979]/10 px-2 py-0.5 text-[10px] text-[#22794b]" style={{ fontWeight: 800 }}>{valueOrEmpty(theme.frecuencia)} menciones</span>
                  </div>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">{valueOrEmpty(theme.sintesis)}</p>
                  {theme.relacion_con_brechas && <p className="mt-1 text-[11px] text-neutral-400 italic">Relacion: {theme.relacion_con_brechas}</p>}
                </article>
              ))}
            </div>
          </div>
        )}

        {cross?.aplica && (
          <div className="lg:col-span-2 rounded-2xl border border-[#865cf0]/20 bg-[#865cf0]/[0.06] p-4">
            <PhaseReportKeyValueGrid compact rows={[
              { label: 'Perfil', value: cross.perfil, tone: 'purple' },
              { label: 'Coherencia', value: cross.coherencia, tone: 'blue' },
            ]} />
            {cross.tensiones?.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {cross.tensiones.map((item: any, index: number) => (
                  <article key={`${item.tipo}-${index}`} className="rounded-xl border border-white/70 bg-white p-3.5">
                    <p className="text-[13px] text-neutral-900" style={{ fontWeight: 800 }}>{valueOrEmpty(item.tipo)}</p>
                    <p className="mt-1 text-[12px] text-neutral-600 leading-relaxed">{valueOrEmpty(item.descripcion)}</p>
                    {item.impacto && <p className="mt-2 text-[11px] text-neutral-400">Impacto: {item.impacto}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PhaseReportSection>
  );
}

function ConsultantComments({
  comment,
  savedComment,
  isSavingComment,
  isReprocessing,
  onCommentChange,
  onSaveComment,
  onReprocess,
  onApprove,
}: MadurezDiagnosisViewProps) {
  return (
    <section className="rounded-[1.35rem] border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={15} className="text-neutral-500" />
        <h3 className="text-neutral-900 text-sm" style={{ fontWeight: 750 }}>Comentarios del consultor</h3>
      </div>
      <p className="text-neutral-500 text-xs mb-3">
        Agregue observaciones o contexto adicional. Puede guardar el comentario o reprocesar el diagnostico incorporandolo.
      </p>
      {savedComment && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#5454e9]/[0.06] border border-[#5454e9]/15 text-[13px] text-neutral-700">
          <p className="text-[#3838b8] text-xs mb-1" style={{ fontWeight: 800 }}>Ultimo comentario guardado</p>
          <p className="leading-relaxed">{savedComment}</p>
        </div>
      )}
      <textarea
        value={comment}
        onChange={(event) => onCommentChange?.(event.target.value)}
        placeholder="Ej: El area de manufactura tiene un nivel de madurez distinto al resto de la organizacion..."
        rows={4}
        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm outline-none focus:border-[#5454e9]/60 focus:ring-2 focus:ring-[#5454e9]/10 transition-all resize-y leading-relaxed bg-white mb-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onSaveComment} disabled={isSavingComment || !comment?.trim()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-sm hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all" style={{ fontWeight: 650 }}>
          {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar comentario
        </button>
        <button onClick={onReprocess} disabled={isReprocessing || !comment?.trim()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#5454e9]/25 text-[#3838b8] bg-[#5454e9]/[0.06] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-[#5454e9]/10" style={{ fontWeight: 650 }}>
          {isReprocessing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reprocesar con comentario
        </button>
        <div className="flex-1" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onApprove} className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm transition-all" style={{ background: '#5454e9', fontWeight: 750, boxShadow: '0 10px 28px -16px rgba(84,84,233,0.7)' }}>
          <ThumbsUp size={14} /> Aprobar diagnostico de madurez
        </motion.button>
      </div>
    </section>
  );
}

export default function MadurezDiagnosisView(props: MadurezDiagnosisViewProps) {
  const { results, pmoType, pmoColor, approved, completedAt } = props;
  const structuralPatterns = [
    results.predictiva?.patrones_estructurales ? `Predictivo: ${results.predictiva.patrones_estructurales}` : '',
    results.agil?.patrones_estructurales ? `Agil: ${results.agil.patrones_estructurales}` : '',
  ].filter(Boolean);

  return (
    <motion.div key={approved ? 'approved' : 'results'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      <MaturityHero results={results} pmoType={pmoType} pmoColor={pmoColor} approved={approved} completedAt={completedAt} />

      <ExecutiveCharts results={results} />

      <div className="rounded-[1.35rem] border border-[#5454e9]/15 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={17} className="text-[#5454e9]" />
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#3838b8]" style={{ fontWeight: 850 }}>Sintesis del diagnostico</p>
        </div>
        <p className="text-neutral-700 text-[14px] leading-relaxed">{getSummaryText(results)}</p>
        {structuralPatterns.map((pattern) => (
          <p key={pattern.slice(0, 80)} className="mt-3 rounded-2xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-[13px] leading-relaxed text-neutral-600">
            {pattern}
          </p>
        ))}
      </div>

      <ModernMaturityBIDashboard results={results} />

      <GapsAndStrengths results={results} />

      <AnalysisDetails results={results} />

      {results.advertencias_de_entrada?.length > 0 && (
        <PhaseReportSection title="Advertencias de entrada" eyebrow="Calidad de datos" icon={<AlertTriangle size={18} />} tone="amber">
          <PhaseReportList items={results.advertencias_de_entrada} tone="amber" />
        </PhaseReportSection>
      )}

      {results.recommendations?.length > 0 && (
        <PhaseReportSection title="Recomendaciones globales" eyebrow="Acciones sugeridas" icon={<Target size={18} />} tone="green">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.recommendations.map((item: string, index: number) => (
              <article key={`${item}-${index}`} className="rounded-2xl border border-[#4cb979]/20 bg-[#4cb979]/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#4cb979] text-white flex items-center justify-center text-[12px] flex-shrink-0" style={{ fontWeight: 900 }}>{index + 1}</span>
                  <p className="text-[13px] text-neutral-700 leading-relaxed">{item}</p>
                </div>
              </article>
            ))}
          </div>
        </PhaseReportSection>
      )}

      {!approved && <ConsultantComments {...props} />}
    </motion.div>
  );
}
