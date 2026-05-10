import React from 'react';
import {
  AlertCircle, AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Gauge,
  Layers3, Lightbulb, Radar as RadarIcon, ShieldAlert, Sparkles, Target,
  TrendingUp, Users
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  EMPTY_VALUE,
  levelTone,
  normalizeList,
  PhaseReportBadgeList,
  PhaseReportKeyValueGrid,
  PhaseReportList,
  PhaseReportMetric,
  PhaseReportMiniList,
  PhaseReportProgressBar,
  PhaseReportSection,
  phaseReportToneStyles,
  type PhaseReportTone,
  valueOrEmpty,
} from '../_shared/PhaseReportVisuals';
import {
  factorMapping,
  getIdoneidadItemCode,
  getIdoneidadItemScore,
  inferIdoneidadDimension,
  normalizeIdoneidadDiagnosisItems,
} from './idoneidadUtils';

interface IdoneidadDiagnosisViewProps {
  diagnosis: any;
  radarData: any[];
  totalRespondentCount: number;
  completedAt?: string;
}

const DIMENSIONS = ['cultura', 'equipo', 'proyecto', 'general'] as const;

function zoneTone(value: unknown): PhaseReportTone {
  const token = String(value ?? '').toLowerCase();
  if (token.includes('predict')) return 'red';
  if (token.includes('transicion') || token.includes('hibr')) return 'amber';
  if (token.includes('agil')) return 'green';
  return levelTone(value);
}

function classificationTone(value: unknown): PhaseReportTone {
  const token = String(value ?? '').toLowerCase();
  if (token.includes('crit')) return 'red';
  if (token.includes('alto') || token.includes('alta')) return 'red';
  if (token.includes('medio') || token.includes('moder')) return 'orange';
  if (token.includes('leve')) return 'green';
  return levelTone(value);
}

function factorName(code: unknown) {
  const key = valueOrEmpty(code).toUpperCase();
  return factorMapping[key] ? `${factorMapping[key].name} (${key})` : valueOrEmpty(code);
}

function textWithFactorNames(value: unknown) {
  return valueOrEmpty(value).replace(/\b[CEP]\d{2}\b/g, (match) => factorName(match));
}

function pct(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(1)) : 0;
}

function CustomRadarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-neutral-200/80 p-3.5 rounded-xl" style={{ boxShadow: '0 4px 24px -6px rgba(0,0,0,0.12)' }}>
      <div className="mb-2.5 pb-2 border-b border-neutral-100">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-0.5">{data.dimension}</p>
        <p className="text-[12px] text-neutral-900 leading-tight" style={{ fontWeight: 700 }}>{data.fullLabel}</p>
      </div>
      {payload.filter((p: any) => p.dataKey === 'Puntaje').map((entry: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-6">
          <span className="text-[12px] flex items-center gap-1.5 text-neutral-600 font-medium">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-[13px] tabular-nums font-bold" style={{ color: entry.color }}>{Number(entry.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreHero({ diagnosis }: { diagnosis: any }) {
  const score = Number((diagnosis?.suitability_score || diagnosis?.puntuacion_idoneidad || 0).toFixed(1));
  const tone = zoneTone(diagnosis?.suitability_level || diagnosis?.nivel_idoneidad);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <section className="rounded-[1.5rem] overflow-hidden border border-[#5454e9]/20 bg-white" style={{ boxShadow: '0 20px 55px -34px rgba(84,84,233,0.5)' }}>
      <div className="bg-[#5454e9] p-6 text-white">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-white/12 border border-white/20 flex items-center justify-center">
                <Gauge size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/70" style={{ fontWeight: 800 }}>Agente 3 - Diagnostico de idoneidad</p>
                <h2 className="text-[22px] tracking-tight" style={{ fontWeight: 850 }}>Idoneidad metodologica consolidada</h2>
              </div>
            </div>
            <p className="text-white/88 text-[14px] leading-relaxed max-w-4xl">{textWithFactorNames(diagnosis.summary)}</p>
          </div>
          <div className="w-24 h-24 rounded-full bg-white/12 border border-white/20 flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-[26px] tabular-nums tracking-tight" style={{ fontWeight: 850 }}>{score}</span>
            <span className="text-[10px] text-white/70">/10</span>
          </div>
        </div>
      </div>
      <div className={`px-6 py-3 ${toneClass.soft} border-t ${toneClass.border} flex flex-wrap items-center gap-2`}>
        <span className={`px-2.5 py-1 rounded-full ${toneClass.bg} text-white text-[10px]`} style={{ fontWeight: 850 }}>
          {valueOrEmpty(diagnosis.suitability_level || diagnosis.nivel_idoneidad)}
        </span>
        <span className="text-neutral-600 text-[12px]">{textWithFactorNames(diagnosis.justificacion_confiabilidad)}</span>
      </div>
    </section>
  );
}

function MetricsStrip({ diagnosis, totalRespondentCount, completedAt }: { diagnosis: any; totalRespondentCount: number; completedAt?: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
      <PhaseReportMetric label="Respondieron" value={totalRespondentCount} tone="blue" icon={<Users size={15} />} />
      <PhaseReportMetric label="Puntaje" value={`${pct(diagnosis.suitability_score || diagnosis.puntuacion_idoneidad)}/10`} tone={zoneTone(diagnosis.suitability_level || diagnosis.nivel_idoneidad)} icon={<Gauge size={15} />} />
      <PhaseReportMetric label="Confiabilidad" value={diagnosis.nivel_confiabilidad} tone={levelTone(diagnosis.nivel_confiabilidad)} icon={<CheckCircle2 size={15} />} />
      <PhaseReportMetric label="Comportamiento" value={diagnosis.indicadores?.general?.comportamiento} tone={levelTone(diagnosis.indicadores?.general?.comportamiento)} icon={<TrendingUp size={15} />} />
      <PhaseReportMetric label="Analisis" value={completedAt ?? 'Reciente'} tone="slate" icon={<ClipboardList size={15} />} />
    </div>
  );
}

function DistributionPanel({ diagnosis }: { diagnosis: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {DIMENSIONS.map((dim) => {
        const dist = diagnosis.distribucion?.[dim];
        const indicator = diagnosis.indicadores?.[dim];
        return (
          <article key={dim} className="rounded-2xl border border-neutral-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-neutral-950 text-[15px] capitalize" style={{ fontWeight: 850 }}>{dim}</p>
                <p className="text-neutral-500 text-[11px] mt-1">Promedio {valueOrEmpty(indicator?.promedio)} - DE {valueOrEmpty(indicator?.desviacion_estandar)}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full ${phaseReportToneStyles[zoneTone(indicator?.zona_predominante)].soft} ${phaseReportToneStyles[zoneTone(indicator?.zona_predominante)].text} text-[10px]`} style={{ fontWeight: 800 }}>
                {valueOrEmpty(indicator?.zona_predominante || indicator?.coherencia_interna)}
              </span>
            </div>
            <div className="space-y-3">
              <PhaseReportProgressBar label="Agil" value={pct(dist?.porcentaje_agil)} max={100} tone="green" />
              <PhaseReportProgressBar label="Transicion" value={pct(dist?.porcentaje_transicion)} max={100} tone="amber" />
              <PhaseReportProgressBar label="Predictivo" value={pct(dist?.porcentaje_predictivo)} max={100} tone="red" />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RadarPanel({ radarData, diagnosis }: { radarData: any[]; diagnosis: any }) {
  if (!radarData.length) return null;
  return (
    <div className="space-y-5">
      <div className="p-5 bg-white rounded-2xl border border-neutral-100 overflow-x-auto print:overflow-visible print:border-none print:shadow-none print:p-0 print:break-inside-avoid">
        <div className="h-[620px] min-w-[720px] w-full print:min-w-0 print:w-full print:h-[620px] mx-auto">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#374151', fontSize: 11, fontWeight: 700 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickCount={6} />
              <Radar name="Zona Predictiva (8-10)" dataKey="PredictiveZone" stroke="#5454e9" strokeWidth={1.5} strokeDasharray="5 3" fill="#5454e9" fillOpacity={0.12} isAnimationActive={false} />
              <Radar name="Zona Híbrida (4-8)" dataKey="HybridZone" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" fill="#f59e0b" fillOpacity={0.18} isAnimationActive={false} />
              <Radar name="Zona Ágil (0-4)" dataKey="AgileZone" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" fill="#10b981" fillOpacity={0.22} isAnimationActive={false} />
              <Radar name="Puntaje Real" dataKey="Puntaje" stroke="#5454e9" strokeWidth={3} fill="#5454e9" fillOpacity={0.18} dot={{ r: 4.5, fill: '#5454e9', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              <Tooltip content={<CustomRadarTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 500 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DimensionIndicatorCards diagnosis={diagnosis} />
    </div>
  );
}

function DimensionIndicatorCards({ diagnosis }: { diagnosis: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {DIMENSIONS.map((dim) => {
        const item = diagnosis.indicadores?.[dim];
        return (
          <article key={dim} className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-neutral-950 text-[14px] capitalize mb-3" style={{ fontWeight: 850 }}>{dim}</p>
            <PhaseReportKeyValueGrid rows={[
              { label: 'Promedio', value: item?.promedio, tone: zoneTone(item?.zona_predominante) },
              { label: 'Desviacion', value: item?.desviacion_estandar, tone: levelTone(item?.desviacion_estandar) },
              { label: 'Item alto', value: item?.item_mas_alto ? factorName(item.item_mas_alto) : item?.item_mas_alto, tone: 'green' },
              { label: 'Item bajo', value: item?.item_mas_bajo ? factorName(item.item_mas_bajo) : item?.item_mas_bajo, tone: 'orange' },
            ]} />
          </article>
        );
      })}
    </div>
  );
}

function RiskCard({ risk, index }: { risk: any; index: number }) {
  const tone = classificationTone(risk.nivel || risk.impacto);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(risk.nombre || risk.riesgo)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 800 }}>{valueOrEmpty(risk.nivel || risk.impacto)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>R-{index + 1}</span>
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{textWithFactorNames(risk.descripcion)}</p>
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <PhaseReportList items={risk.datos_respaldo} tone={tone} mapItem={textWithFactorNames} />
        </div>
      </div>
    </article>
  );
}

function TensionCard({ tension, index }: { tension: any; index: number }) {
  const tone = classificationTone(tension.clasificacion);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(tension.par_dimensiones)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 800 }}>{valueOrEmpty(tension.clasificacion)}</p>
          </div>
          <span className="text-[18px] tabular-nums text-neutral-900" style={{ fontWeight: 850 }}>{valueOrEmpty(tension.diferencia_promedios)}</span>
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{textWithFactorNames(tension.interpretacion)}</p>
      </div>
    </article>
  );
}

function ConflictCard({ conflict, index }: { conflict: any; index: number }) {
  const tone = classificationTone(conflict.diferencia >= 7 ? 'Alto' : 'Medio');
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{factorName(conflict.item)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 800 }}>Diferencia {valueOrEmpty(conflict.diferencia)}</p>
          </div>
          <span className="text-[12px] text-neutral-500 tabular-nums">{valueOrEmpty(conflict.valor_minimo)} - {valueOrEmpty(conflict.valor_maximo)}</span>
        </div>
        <div className="mt-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Cargos involucrados</p>
          <PhaseReportBadgeList items={conflict.cargos_involucrados} tone={tone} />
        </div>
      </div>
    </article>
  );
}

function InconsistencyCard({ inconsistency, index }: { inconsistency: any; index: number }) {
  const tone = classificationTone(inconsistency.clasificacion);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(inconsistency.clasificacion)}</p>
          <PhaseReportBadgeList items={inconsistency.items_involucrados} tone={tone} mapItem={factorName} />
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{textWithFactorNames(inconsistency.descripcion)}</p>
        <p className="mt-2 text-[11px] text-neutral-500 tabular-nums">Valores: {normalizeList(inconsistency.valores).join(' / ')}</p>
      </div>
    </article>
  );
}

function FactorsPanel({ diagnosis }: { diagnosis: any }) {
  const predictive = diagnosis.factores_criticos?.alta_afinidad_predictiva ?? [];
  const agile = diagnosis.factores_criticos?.alta_afinidad_agil ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PhaseReportMiniList title="Alta afinidad predictiva" items={predictive.map((fac: any) => `${factorName(fac.item)} (${valueOrEmpty(fac.promedio)}): ${textWithFactorNames(fac.interpretacion)}`)} tone="red" />
      <PhaseReportMiniList title="Alta afinidad agil" items={agile.map((fac: any) => `${factorName(fac.item)} (${valueOrEmpty(fac.promedio)}): ${textWithFactorNames(fac.interpretacion)}`)} tone="green" />
    </div>
  );
}

function FactorsInterpretation({ diagnosis }: { diagnosis: any }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {['cultura', 'equipo', 'proyecto'].map((dim, index) => {
        const data = diagnosis.interpretacion_por_factores?.[dim] || {};
        const tone = (['blue', 'purple', 'green'] as PhaseReportTone[])[index];
        return (
          <article key={dim} className={`rounded-2xl border ${phaseReportToneStyles[tone].border} bg-white overflow-hidden`}>
            <div className={`h-1 ${phaseReportToneStyles[tone].bar}`} />
            <div className="p-4">
              <p className="text-neutral-950 text-[15px] capitalize mb-3" style={{ fontWeight: 850 }}>{dim}</p>
              <PhaseReportKeyValueGrid rows={Object.entries(data).map(([label, value]) => ({
                label: label.replace(/_/g, ' '),
                value: textWithFactorNames(value),
                tone,
              }))} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ResultsTable({ diagnosis }: { diagnosis: any }) {
  const items = normalizeIdoneidadDiagnosisItems(diagnosis);
  const rows = items.length ? items : [{ item: EMPTY_VALUE, dimension: EMPTY_VALUE, promedio: EMPTY_VALUE, minimo: EMPTY_VALUE, maximo: EMPTY_VALUE, desviacion_estandar: EMPTY_VALUE, zona: EMPTY_VALUE, factor_critico: EMPTY_VALUE }];
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-100 print:overflow-visible print:border-none print:break-inside-avoid">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50">
            {['Item', 'Dimension', 'Promedio', 'Min', 'Max', 'Desv.', 'Zona', 'Critico'].map((h) => (
              <th key={h} className="px-3 py-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50 bg-white">
          {rows.map((item: any, i: number) => {
            const code = getIdoneidadItemCode(item);
            const mappedName = factorMapping[code]?.name;
            const displayCode = mappedName ? `${code} - ${mappedName}` : valueOrEmpty(code);
            const tone = zoneTone(item.zona);
            return (
              <tr key={i} className="hover:bg-neutral-50/60">
                <td className="px-3 py-3 text-[12px] text-neutral-800" style={{ fontWeight: 700 }}>{displayCode}</td>
                <td className="px-3 py-3 text-[12px] text-neutral-600">{valueOrEmpty(item.dimension ?? inferIdoneidadDimension(code))}</td>
                <td className="px-3 py-3 text-[12px] text-neutral-900 tabular-nums" style={{ fontWeight: 800 }}>{valueOrEmpty(getIdoneidadItemScore(item))}</td>
                <td className="px-3 py-3 text-[12px] text-neutral-600 tabular-nums">{valueOrEmpty(item.minimo)}</td>
                <td className="px-3 py-3 text-[12px] text-neutral-600 tabular-nums">{valueOrEmpty(item.maximo)}</td>
                <td className="px-3 py-3 text-[12px] text-neutral-600 tabular-nums">{valueOrEmpty(item.desviacion_estandar)}</td>
                <td className="px-3 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full ${phaseReportToneStyles[tone].soft} ${phaseReportToneStyles[tone].text} text-[10px]`} style={{ fontWeight: 800 }}>{valueOrEmpty(item.zona)}</span></td>
                <td className="px-3 py-3 text-[12px] text-neutral-600">{valueOrEmpty(item.factor_critico)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QualityPanel({ diagnosis }: { diagnosis: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PhaseReportMiniList title="Items faltantes" items={diagnosis.calidad_input?.items_faltantes} tone="slate" mapItem={textWithFactorNames} />
      <PhaseReportMiniList title="Limitaciones por formato" items={diagnosis.calidad_input?.limitaciones_por_formato} tone="amber" mapItem={textWithFactorNames} />
        <PhaseReportMiniList title="Alertas respuesta invalida" items={diagnosis.calidad_input?.alertas_respuesta_invalida} tone="orange" mapItem={textWithFactorNames} />
      <PhaseReportMiniList title="Datos incompletos" items={diagnosis.calidad_input?.encuestados_con_datos_incompletos} tone="red" />
    </div>
  );
}

function Agent4Inputs({ diagnosis }: { diagnosis: any }) {
  const inputs = diagnosis.insumos_para_agente_4;
  return (
    <div className="space-y-5">
      <PhaseReportKeyValueGrid rows={[
        { label: 'Nivel confiabilidad', value: inputs?.nivel_confiabilidad, tone: levelTone(inputs?.nivel_confiabilidad) },
        { label: 'Comportamiento general', value: inputs?.comportamiento_general, tone: levelTone(inputs?.comportamiento_general) },
        { label: 'Zona predominante general', value: inputs?.zona_predominante_general, tone: zoneTone(inputs?.zona_predominante_general) },
      ]} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PhaseReportMiniList title="Indicadores predictivos" items={(inputs?.indicadores_predictivos ?? []).map((x: any) => `${factorName(x.item || x.dimension)} (${valueOrEmpty(x.promedio)}): ${textWithFactorNames(x.interpretacion_del_factor)}`)} tone="red" />
        <PhaseReportMiniList title="Indicadores hibridos" items={(inputs?.indicadores_hibridos ?? []).map((x: any) => `${factorName(x.item_o_dimension)} (${valueOrEmpty(x.promedio)}): ${textWithFactorNames(x.interpretacion_del_factor)}`)} tone="amber" />
        <PhaseReportMiniList title="Indicadores agilidad" items={inputs?.indicadores_agilidad} tone="green" mapItem={textWithFactorNames} />
        <PhaseReportMiniList title="Inconsistencias criticas" items={inputs?.inconsistencias_criticas_resumen} tone="orange" mapItem={textWithFactorNames} />
      </div>
    </div>
  );
}

export default function IdoneidadDiagnosisView({ diagnosis, radarData, totalRespondentCount, completedAt }: IdoneidadDiagnosisViewProps) {
  return (
    <div className="space-y-5">
      <ScoreHero diagnosis={diagnosis} />

      <PhaseReportSection title="Lectura general" eyebrow="Indicadores de idoneidad" icon={<BarChart3 size={18} />} tone="blue">
        <MetricsStrip diagnosis={diagnosis} totalRespondentCount={totalRespondentCount} completedAt={completedAt} />
      </PhaseReportSection>

      <PhaseReportSection title="Observaciones" eyebrow="Lectura ejecutiva" icon={<Sparkles size={18} />} tone="green">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {normalizeList(diagnosis.observations || diagnosis.observaciones).map((obs, i) => (
            <div key={i} className="rounded-2xl border border-[#4cb979]/25 bg-[#4cb979]/10 p-4 flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#4cb979] text-white flex items-center justify-center flex-shrink-0 text-[11px]" style={{ fontWeight: 800 }}>{i + 1}</div>
              <p className="text-neutral-700 text-[13px] leading-relaxed">{textWithFactorNames(obs)}</p>
            </div>
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Distribucion por zona" eyebrow="Agil - transicion - predictivo" icon={<Target size={18} />} tone="red">
        <DistributionPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Radar de idoneidad" eyebrow="Factores evaluados" icon={<RadarIcon size={18} />} tone="purple">
        <RadarPanel radarData={radarData} diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Riesgos metodologicos" eyebrow="Alertas principales" icon={<ShieldAlert size={18} />} tone="orange">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {((diagnosis.riesgos || diagnosis.riesgos_metodologicos)?.length ? (diagnosis.riesgos || diagnosis.riesgos_metodologicos) : [{ nombre: EMPTY_VALUE, nivel: EMPTY_VALUE, descripcion: EMPTY_VALUE, datos_respaldo: [] }]).map((risk: any, i: number) => (
            <RiskCard key={i} risk={risk} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Tensiones" eyebrow="Coherencia entre dimensiones" icon={<Layers3 size={18} />} tone="amber">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(diagnosis.tensiones?.length ? diagnosis.tensiones : [{ par_dimensiones: EMPTY_VALUE, clasificacion: EMPTY_VALUE, interpretacion: EMPTY_VALUE, diferencia_promedios: EMPTY_VALUE }]).map((tension: any, i: number) => (
            <TensionCard key={i} tension={tension} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Alineacion y consenso" eyebrow="Conflictos de percepcion" icon={<Users size={18} />} tone="orange">
        <div className="space-y-4">
          <PhaseReportKeyValueGrid rows={[
            { label: 'Disponible', value: diagnosis.alineacion?.disponible, tone: 'blue' },
            { label: 'Consenso cultura', value: textWithFactorNames(diagnosis.alineacion?.consenso_por_dimension?.cultura), tone: 'purple' },
            { label: 'Consenso equipo', value: textWithFactorNames(diagnosis.alineacion?.consenso_por_dimension?.equipo), tone: 'green' },
            { label: 'Consenso proyecto', value: textWithFactorNames(diagnosis.alineacion?.consenso_por_dimension?.proyecto), tone: 'amber' },
          ]} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(diagnosis.alineacion?.conflictos_percepcion?.length ? diagnosis.alineacion.conflictos_percepcion : [{ item: EMPTY_VALUE, diferencia: EMPTY_VALUE, valor_minimo: EMPTY_VALUE, valor_maximo: EMPTY_VALUE, cargos_involucrados: [] }]).map((conflict: any, i: number) => (
              <ConflictCard key={i} conflict={conflict} index={i} />
            ))}
          </div>
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Inconsistencias internas" eyebrow="Lectura de coherencia" icon={<AlertTriangle size={18} />} tone="red">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.inconsistencias?.length ? diagnosis.inconsistencias : [{ clasificacion: EMPTY_VALUE, descripcion: EMPTY_VALUE, items_involucrados: [], valores: [] }]).map((inconsistency: any, i: number) => (
            <InconsistencyCard key={i} inconsistency={inconsistency} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Factores criticos" eyebrow="Afinidad metodologica" icon={<TrendingUp size={18} />} tone="red">
        <FactorsPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Interpretacion por factores" eyebrow="Cultura - equipo - proyecto" icon={<Lightbulb size={18} />} tone="green">
        <FactorsInterpretation diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Calidad del input" eyebrow="Confiabilidad del dato" icon={<CheckCircle2 size={18} />} tone="slate">
        <QualityPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Resultados por item" eyebrow="Detalle cuantitativo" icon={<ClipboardList size={18} />} tone="blue">
        <ResultsTable diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Cargos representados" eyebrow="Muestra participante" icon={<Users size={18} />} tone="purple">
        <PhaseReportBadgeList items={diagnosis.cargos_representados} tone="purple" />
      </PhaseReportSection>

      <PhaseReportSection title="Insumos para agente 4" eyebrow="Transferencia analitica" icon={<Target size={18} />} tone="green">
        <Agent4Inputs diagnosis={diagnosis} />
      </PhaseReportSection>
    </div>
  );
}
