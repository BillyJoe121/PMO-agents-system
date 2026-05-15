import {
  AlertCircle, AlertTriangle, BarChart3, Briefcase, Calendar, CheckCircle2, Gauge,
  Layers3, Lightbulb, MessageSquare, Quote, Radio, ShieldAlert, Sparkles,
  Target, Users, Wrench
} from 'lucide-react';
import type { EntrevistasDiagnosis } from '../../../hooks/useEntrevistas';
import {
  EMPTY_VALUE,
  levelTone,
  normalizeList,
  PhaseReportBadgeList,
  PhaseReportKeyValueGrid,
  PhaseReportMetric,
  PhaseReportMiniList,
  PhaseReportProgressBar,
  PhaseReportSection,
  phaseReportToneStyles,
  type PhaseReportTone,
  valueOrEmpty,
} from '../_shared/PhaseReportVisuals';

const DIMENSION_LABELS = [
  ['inicio', 'Inicio'],
  ['planeacion', 'Planeacion'],
  ['ejecucion', 'Ejecucion'],
  ['monitoreo_control', 'Monitoreo y control'],
  ['cierre', 'Cierre'],
] as const;

type InterviewDimension = NonNullable<EntrevistasDiagnosis['dimensiones_base']>[string];

function toneByIndex(index: number): PhaseReportTone {
  return (['blue', 'green', 'purple', 'orange', 'amber'] as PhaseReportTone[])[index % 5];
}

function frequencyTone(value: unknown): PhaseReportTone {
  const token = String(value ?? '').toLowerCase();
  if (token.includes('alta')) return 'green';
  if (token.includes('media')) return 'amber';
  if (token.includes('baja')) return 'orange';
  return levelTone(value);
}

function maxMentionCount(diagnosis: EntrevistasDiagnosis) {
  const counts = (diagnosis.recurring_themes ?? []).map((theme) => theme.mentioned_by?.length ?? 0);
  return Math.max(1, ...counts);
}

function InterviewHero({ diagnosis }: { diagnosis: EntrevistasDiagnosis }) {
  return (
    <section className="rounded-[1.5rem] overflow-hidden border border-[#865cf0]/20 bg-white" style={{ boxShadow: '0 20px 55px -34px rgba(134,92,240,0.5)' }}>
      <div className="bg-[#865cf0] p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-white/12 border border-white/20 flex items-center justify-center">
            <MessageSquare size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/70" style={{ fontWeight: 800 }}>Agente 2 - Registro de entrevistas</p>
            <h2 className="text-[22px] tracking-tight" style={{ fontWeight: 850 }}>Diagnostico cualitativo consolidado</h2>
          </div>
        </div>
        <p className="text-white/88 text-[14px] leading-relaxed max-w-4xl">{valueOrEmpty(diagnosis.summary)}</p>
      </div>
    </section>
  );
}

function InterviewMetrics({ diagnosis }: { diagnosis: EntrevistasDiagnosis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <PhaseReportMetric label="Entrevistados" value={diagnosis.numero_entrevistados} tone="blue" icon={<Users size={15} />} />
      <PhaseReportMetric label="Roles" value={diagnosis.roles_identificados?.length ?? 0} tone="green" icon={<Briefcase size={15} />} />
      <PhaseReportMetric label="Temas" value={diagnosis.recurring_themes?.length ?? 0} tone="purple" icon={<Radio size={15} />} />
      <PhaseReportMetric label="Fuente unica" value={diagnosis.advertencia_fuente_unica} tone={diagnosis.advertencia_fuente_unica ? 'orange' : 'green'} icon={<AlertCircle size={15} />} />
    </div>
  );
}

function ContextPanel({ diagnosis }: { diagnosis: EntrevistasDiagnosis }) {
  return (
    <div className="space-y-4">
      <PhaseReportKeyValueGrid rows={[
        { label: 'Organizacion', value: diagnosis.contexto_organizacional?.organizacion, tone: 'slate' },
        { label: 'Sector', value: diagnosis.contexto_organizacional?.sector, tone: 'blue' },
        { label: 'Tamano aproximado', value: diagnosis.contexto_organizacional?.tamanio_aproximado, tone: 'purple' },
        { label: 'Tipo proyecto analizado', value: diagnosis.contexto_organizacional?.tipo_proyecto_analizado, tone: 'amber' },
        { label: 'Cultura visible', value: diagnosis.contexto_organizacional?.cultura_visible, tone: 'green' },
        { label: 'Nivel formalizacion general', value: diagnosis.nivel_formalizacion_general ?? diagnosis.insumos_para_agente_4?.nivel_general_formalizacion, tone: levelTone(diagnosis.nivel_formalizacion_general ?? diagnosis.insumos_para_agente_4?.nivel_general_formalizacion) },
      ]} />
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-3" style={{ fontWeight: 800 }}>Roles identificados</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(diagnosis.roles_identificados ?? []).map((rol, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-white">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                <Briefcase size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 750 }}>{valueOrEmpty(rol.nombre_cargo)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-neutral-500 text-[11px]">{valueOrEmpty(rol.area)}</span>
                  <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                  <span className="text-neutral-500 text-[11px] capitalize">{valueOrEmpty(rol.nivel_jerarquico)}</span>
                </div>
                <p className="text-neutral-600 text-[12px] leading-relaxed mt-1.5 line-clamp-2">{valueOrEmpty(rol.participacion_en_proyectos)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ item, index }: { item: unknown; index: number }) {
  const tone = toneByIndex(index);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} p-4 flex gap-3`}>
      <div className={`w-7 h-7 rounded-full ${toneClass.bg} text-white flex items-center justify-center flex-shrink-0 text-[11px]`} style={{ fontWeight: 800 }}>{index + 1}</div>
      <p className="text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(item)}</p>
    </article>
  );
}

function ThemeCard({ theme, max }: { theme: NonNullable<EntrevistasDiagnosis['recurring_themes']>[number]; max: number }) {
  const tone = frequencyTone(theme.frequency);
  const toneClass = phaseReportToneStyles[tone];
  const mentionCount = theme.mentioned_by?.length ?? 0;
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(theme.theme)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>Frecuencia {valueOrEmpty(theme.frequency)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
            {mentionCount} voces
          </span>
        </div>
        <PhaseReportProgressBar label="Menciones por entrevistados" value={mentionCount} max={max} tone={tone} />
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Mencionado por</p>
          <PhaseReportBadgeList items={theme.mentioned_by} tone={tone} />
        </div>
      </div>
    </article>
  );
}

function PatternCard({ pattern, index }: { pattern: NonNullable<EntrevistasDiagnosis['patrones_organizacionales']>[number]; index: number }) {
  const tone = toneByIndex(index + 2);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 800 }}>{valueOrEmpty(pattern.nombre)}</p>
        <p className="mt-2 text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(pattern.descripcion)}</p>
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Dimensiones observadas</p>
          <PhaseReportBadgeList items={pattern.dimensiones_donde_se_observa} tone={tone} />
        </div>
      </div>
    </article>
  );
}

function InterviewDimensionCard({ label, dim, index }: { label: string; dim?: InterviewDimension; index: number }) {
  const tone = toneByIndex(index);
  const toneClass = phaseReportToneStyles[tone];
  const confidenceTone = levelTone((dim as any)?.confianza);
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{label}</p>
            <p className={`text-[11px] ${toneClass.text} mt-1`} style={{ fontWeight: 750 }}>{valueOrEmpty((dim as any)?.nivel_formalidad)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${phaseReportToneStyles[confidenceTone].soft} ${phaseReportToneStyles[confidenceTone].text} text-[10px]`} style={{ fontWeight: 800 }}>
            Confianza {valueOrEmpty((dim as any)?.confianza)}
          </span>
        </div>
        <PhaseReportKeyValueGrid compact rows={[
          { label: 'Tipo gestion', value: (dim as any)?.tipo_gestion, tone: levelTone((dim as any)?.tipo_gestion) },
          { label: 'Recurrencia', value: (dim as any)?.recurrencia, tone: levelTone((dim as any)?.recurrencia) },
          { label: 'Formalidad', value: (dim as any)?.nivel_formalidad, tone: levelTone((dim as any)?.nivel_formalidad) },
          { label: 'Confianza', value: (dim as any)?.confianza, tone: confidenceTone },
        ]} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
          <PhaseReportMiniList title="Practicas reales" items={(dim as any)?.practicas_reales} tone={tone} />
          <PhaseReportMiniList title="Evidencias" items={(dim as any)?.evidencias} tone={tone} />
          <PhaseReportMiniList title="Herramientas" items={(dim as any)?.herramientas} tone={tone} />
        </div>
      </div>
    </article>
  );
}

function VoiceCard({ voice }: { voice: NonNullable<EntrevistasDiagnosis['critical_voices']>[number] }) {
  const tone = levelTone(voice.relevance);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-2xl ${toneClass.soft} ${toneClass.icon} border ${toneClass.border} flex items-center justify-center flex-shrink-0`}>
            <Quote size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(voice.interviewee_name)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 800 }}>
              {valueOrEmpty(voice.interview_id)} - Relevancia {valueOrEmpty(voice.relevance)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(voice.key_insight)}</p>
      </div>
    </article>
  );
}

function TensionCard({ tension, index }: { tension: NonNullable<EntrevistasDiagnosis['tensiones']>[number]; index: number }) {
  const tone = levelTone(tension.intensidad);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(tension.tipo)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>Intensidad {valueOrEmpty(tension.intensidad)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
            Tension {index + 1}
          </span>
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(tension.descripcion)}</p>
        <div className={`mt-3 rounded-2xl border ${toneClass.border} ${toneClass.soft} p-3`}>
          <p className={`text-[10px] uppercase tracking-[0.12em] ${toneClass.text} mb-1.5`} style={{ fontWeight: 850 }}>Evidencia</p>
          <p className="text-neutral-700 text-[12px] leading-relaxed">{valueOrEmpty(tension.evidencia)}</p>
        </div>
        <div className="mt-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Roles involucrados</p>
          <PhaseReportBadgeList items={tension.roles_involucrados} tone={tone} />
        </div>
      </div>
    </article>
  );
}

function GapCard({ gap, index }: { gap: NonNullable<EntrevistasDiagnosis['brechas']>[number]; index: number }) {
  const tone: PhaseReportTone = index % 2 === 0 ? 'orange' : 'red';
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(gap.descripcion)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>{valueOrEmpty(gap.dimension_o_fase)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
            BD-{String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(gap.evidencia_o_ausencia)}</p>
        <div className={`mt-3 rounded-2xl border ${toneClass.border} ${toneClass.soft} p-3`}>
          <p className={`text-[10px] uppercase tracking-[0.12em] ${toneClass.text} mb-1.5`} style={{ fontWeight: 850 }}>Impacto potencial</p>
          <p className="text-neutral-700 text-[12px] leading-relaxed">{valueOrEmpty(gap.impacto_potencial)}</p>
        </div>
      </div>
    </article>
  );
}

function HerramientaCard({ herramienta, index }: { herramienta: NonNullable<EntrevistasDiagnosis['herramientas_identificadas']>[number]; index: number }) {
  const tone: PhaseReportTone = herramienta.es_repositorio_digital ? 'green' : 'blue';
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden flex flex-col`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(herramienta.nombre)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>Tipo: {valueOrEmpty(herramienta.tipo).replace(/_/g, ' ')}</p>
          </div>
          {herramienta.es_repositorio_digital && (
            <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
              Repositorio
            </span>
          )}
        </div>
        <p className="text-neutral-700 text-[13px] leading-relaxed mb-4">{valueOrEmpty(herramienta.uso_identificado)}</p>
        
        <div className="mt-auto space-y-3">
          <div className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} p-3`}>
            <p className={`text-[10px] uppercase tracking-[0.12em] ${toneClass.text} mb-2`} style={{ fontWeight: 850 }}>Fases donde se usa</p>
            <PhaseReportBadgeList items={herramienta.fases_donde_se_usa} tone={tone} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Mencionado por</p>
            <PhaseReportBadgeList items={herramienta.mencionado_por} tone="slate" />
          </div>
        </div>
      </div>
    </article>
  );
}

function ReunionCard({ reunion, index }: { reunion: NonNullable<EntrevistasDiagnosis['reuniones_existentes']>[number]; index: number }) {
  const toneTone = levelTone(reunion.nivel_formalidad);
  const toneClass = phaseReportToneStyles[toneTone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden flex flex-col`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(reunion.nombre)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>Frecuencia: {valueOrEmpty(reunion.frecuencia)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
            {valueOrEmpty(reunion.nivel_formalidad)}
          </span>
        </div>
        <p className="text-neutral-700 text-[13px] leading-relaxed mb-4">{valueOrEmpty(reunion.proposito)}</p>
        
        <div className="mt-auto space-y-3">
          <div className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} p-3`}>
            <p className={`text-[10px] uppercase tracking-[0.12em] ${toneClass.text} mb-2`} style={{ fontWeight: 850 }}>Participantes</p>
            <PhaseReportBadgeList items={reunion.participantes} tone={toneTone} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Mencionada por</p>
            <PhaseReportBadgeList items={reunion.mencionado_por} tone="slate" />
          </div>
        </div>
      </div>
    </article>
  );
}

function QualityInputPanel({ diagnosis }: { diagnosis: EntrevistasDiagnosis }) {
  return (
    <div className="space-y-4">
      <PhaseReportKeyValueGrid rows={[
        { label: 'Sesgo por rol', value: diagnosis.calidad_input?.sesgo_por_rol, tone: levelTone(diagnosis.calidad_input?.sesgo_por_rol) },
      ]} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PhaseReportMiniList title="Vacios tematicos" items={diagnosis.calidad_input?.vacios_tematicos} tone="orange" />
        <PhaseReportMiniList title="Ambiguedades" items={diagnosis.calidad_input?.ambiguedades} tone="amber" />
        <PhaseReportMiniList title="Superficialidad" items={diagnosis.calidad_input?.superficialidad} tone="purple" />
      </div>
    </div>
  );
}

function Recommendations({ items }: { items?: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {normalizeList(items).map((rec, i) => (
        <div key={i} className="rounded-2xl border border-[#4cb979]/25 bg-[#4cb979]/10 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-2xl bg-[#4cb979] text-white flex items-center justify-center flex-shrink-0">
            <Lightbulb size={15} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#22794b] mb-1" style={{ fontWeight: 800 }}>Recomendacion {i + 1}</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed">{rec}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Agent4Inputs({ diagnosis }: { diagnosis: EntrevistasDiagnosis }) {
  const inputs = diagnosis.insumos_para_agente_4;
  return (
    <div className="space-y-5">
      <PhaseReportKeyValueGrid rows={[
        { label: 'Nivel general formalizacion', value: diagnosis.nivel_formalizacion_general ?? inputs?.nivel_general_formalizacion, tone: levelTone(diagnosis.nivel_formalizacion_general ?? inputs?.nivel_general_formalizacion) },
        { label: 'Listo para integracion', value: diagnosis.listo_para_integracion, tone: diagnosis.listo_para_integracion ? 'green' : 'orange' },
        { label: 'Tiene preproyecto', value: inputs?.tiene_preproyecto, tone: inputs?.tiene_preproyecto ? 'green' : 'orange' },
        { label: 'Tiene postcierre', value: inputs?.tiene_postcierre, tone: inputs?.tiene_postcierre ? 'green' : 'orange' },
      ]} />
      <PhaseReportKeyValueGrid rows={[
        { label: 'Justificacion preproyecto', value: inputs?.justificacion_preproyecto, tone: levelTone(inputs?.justificacion_preproyecto) },
        { label: 'Justificacion postcierre', value: inputs?.justificacion_postcierre, tone: levelTone(inputs?.justificacion_postcierre) },
      ]} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PhaseReportMiniList title="Patrones clave resumen" items={inputs?.patrones_clave_resumen} tone="blue" />
        <PhaseReportMiniList title="Brechas criticas resumen" items={inputs?.brechas_criticas_resumen} tone="orange" />
        <PhaseReportMiniList title="Indicadores predictivos" items={inputs?.indicadores_predictivos} tone="purple" />
        <PhaseReportMiniList title="Indicadores agilidad" items={inputs?.indicadores_agilidad} tone="green" />
        <PhaseReportMiniList title="Indicadores hibridos" items={inputs?.indicadores_hibridos} tone="amber" />
      </div>
    </div>
  );
}

export default function EntrevistasDiagnosisView({ diagnosis }: { diagnosis: EntrevistasDiagnosis }) {
  const maxThemes = maxMentionCount(diagnosis);

  return (
    <div className="space-y-5">
      <InterviewHero diagnosis={diagnosis} />

      <PhaseReportSection title="Lectura general" eyebrow="Indicadores cualitativos" icon={<BarChart3 size={18} />} tone="purple">
        <InterviewMetrics diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Contexto organizacional" eyebrow="Marco de interpretacion" icon={<Target size={18} />} tone="blue">
        <ContextPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Hallazgos clave" eyebrow="Lectura ejecutiva" icon={<Sparkles size={18} />} tone="green">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {normalizeList(diagnosis.key_findings).map((finding, i) => <InsightCard key={i} item={finding} index={i} />)}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Temas recurrentes" eyebrow="Frecuencia y voces" icon={<Radio size={18} />} tone="amber">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(diagnosis.recurring_themes?.length ? diagnosis.recurring_themes : [{ theme: EMPTY_VALUE, frequency: EMPTY_VALUE, mentioned_by: [] }]).map((theme, i) => (
            <ThemeCard key={i} theme={theme} max={maxThemes} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Dimensiones base" eyebrow="Practicas reales por fase" icon={<Layers3 size={18} />} tone="blue">
        <div className="grid grid-cols-1 gap-3">
          {DIMENSION_LABELS.map(([key, label], i) => (
            <InterviewDimensionCard key={key} label={label} dim={diagnosis.dimensiones_base?.[key]} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Voces criticas" eyebrow="Insights de entrevistados" icon={<Quote size={18} />} tone="green">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(diagnosis.critical_voices?.length ? diagnosis.critical_voices : [{ interview_id: EMPTY_VALUE, interviewee_name: EMPTY_VALUE, relevance: EMPTY_VALUE, key_insight: EMPTY_VALUE }]).map((voice, i) => (
            <VoiceCard key={i} voice={voice} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Patrones organizacionales" eyebrow="Conductas observadas" icon={<Gauge size={18} />} tone="purple">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.patrones_organizacionales?.length ? diagnosis.patrones_organizacionales : [{ nombre: EMPTY_VALUE, descripcion: EMPTY_VALUE, dimensiones_donde_se_observa: [] }]).map((pattern, i) => (
            <PatternCard key={i} pattern={pattern} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Tensiones" eyebrow="Fricciones del sistema" icon={<ShieldAlert size={18} />} tone="orange">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.tensiones?.length ? diagnosis.tensiones : [{ tipo: EMPTY_VALUE, descripcion: EMPTY_VALUE, evidencia: EMPTY_VALUE, intensidad: EMPTY_VALUE, roles_involucrados: [] }]).map((tension, i) => (
            <TensionCard key={i} tension={tension} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Brechas" eyebrow="Riesgos operativos" icon={<AlertTriangle size={18} />} tone="red">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.brechas?.length ? diagnosis.brechas : [{ dimension_o_fase: EMPTY_VALUE, descripcion: EMPTY_VALUE, evidencia_o_ausencia: EMPTY_VALUE, impacto_potencial: EMPTY_VALUE }]).map((gap, i) => (
            <GapCard key={i} gap={gap} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Herramientas identificadas" eyebrow="Ecosistema tecnologico" icon={<Wrench size={18} />} tone="blue">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.herramientas_identificadas?.length ? diagnosis.herramientas_identificadas : [{ nombre: EMPTY_VALUE, tipo: EMPTY_VALUE, uso_identificado: EMPTY_VALUE, fases_donde_se_usa: [], es_repositorio_digital: false, mencionado_por: [] }]).map((herramienta, i) => (
            <HerramientaCard key={i} herramienta={herramienta} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Reuniones existentes" eyebrow="Rutinas y ceremonias" icon={<Calendar size={18} />} tone="purple">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.reuniones_existentes?.length ? diagnosis.reuniones_existentes : [{ nombre: EMPTY_VALUE, frecuencia: EMPTY_VALUE, participantes: [], proposito: EMPTY_VALUE, nivel_formalidad: EMPTY_VALUE, mencionado_por: [] }]).map((reunion, i) => (
            <ReunionCard key={i} reunion={reunion} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Calidad del input" eyebrow="Confiabilidad de entrevistas" icon={<CheckCircle2 size={18} />} tone="slate">
        <QualityInputPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Limitaciones" eyebrow="Alcance de lectura" icon={<AlertCircle size={18} />} tone="orange">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(diagnosis.limitaciones?.length ? diagnosis.limitaciones : [{ tipo: EMPTY_VALUE, descripcion: EMPTY_VALUE, dimensiones_afectadas: [] }]).map((limitacion, i) => (
            <div key={i} className="rounded-2xl border border-[#e9683b]/25 bg-[#e9683b]/10 p-4">
              <p className="text-neutral-950 text-[15px] mb-2" style={{ fontWeight: 800 }}>{valueOrEmpty(limitacion.tipo)}</p>
              <p className="text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(limitacion.descripcion)}</p>
              <div className="mt-3"><PhaseReportBadgeList items={limitacion.dimensiones_afectadas} tone="orange" /></div>
            </div>
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Recomendaciones" eyebrow="Acciones sugeridas" icon={<Lightbulb size={18} />} tone="green">
        <Recommendations items={diagnosis.recommendations} />
      </PhaseReportSection>

      <PhaseReportSection title="Insumos para agente 4" eyebrow="Transferencia analitica" icon={<MessageSquare size={18} />} tone="purple">
        <Agent4Inputs diagnosis={diagnosis} />
      </PhaseReportSection>
    </div>
  );
}
