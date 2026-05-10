import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Code2,
  Gauge,
  GitMerge,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  ThumbsUp,
} from 'lucide-react';
import {
  PhaseReportBadgeList,
  PhaseReportKeyValueGrid,
  PhaseReportList,
  PhaseReportMetric,
  PhaseReportSection,
  phaseReportToneStyles,
  type PhaseReportTone,
  valueOrEmpty,
} from '../_shared/PhaseReportVisuals';

type EnfoqueDiagnosisViewProps = {
  result: any;
  pmoType: string;
  pmoColor: string;
  maturityLevel: number;
  approved?: boolean;
  completedAt?: string;
  comment?: string;
  savedComment?: string;
  isSavingComment?: boolean;
  onCommentChange?: (value: string) => void;
  onSaveComment?: () => void;
  onReprocess?: () => void;
  onApprove?: () => void;
};

function severityTone(value: unknown): PhaseReportTone {
  const token = String(value ?? '').toLowerCase();
  if (token.includes('alta') || token.includes('critical') || token.includes('alto')) return 'red';
  if (token.includes('media') || token.includes('medium')) return 'orange';
  if (token.includes('baja') || token.includes('low')) return 'blue';
  return 'amber';
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

function directrizCount(result: any) {
  return (result?.instrucciones ?? []).reduce((sum: number, item: any) => sum + (item.directrices?.length ?? 0), 0);
}

function VersionBadge({ result, approved }: { result: any; approved?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] border whitespace-nowrap ${result.version === 'reprocesado' ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-[#5454e9]/20 text-neutral-700'}`} style={{ fontWeight: 750 }}>
      {result.version === 'reprocesado' ? <RefreshCw size={12} /> : <Sparkles size={12} className="text-[#5454e9]" />}
      <span>Enfoque {result.version === 'reprocesado' ? 'reprocesado' : 'original'}</span>
      <span className="opacity-50">·</span>
      <span>{approved ? 'Aprobado' : formatTimestamp(result.timestamp)}</span>
    </div>
  );
}

function EnfoqueHero({ result, pmoType, pmoColor, maturityLevel, approved, completedAt }: EnfoqueDiagnosisViewProps) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[#5454e9]/20 bg-white" style={{ boxShadow: '0 24px 60px -38px rgba(84,84,233,0.45)' }}>
      <div className="h-2 bg-[#5454e9]" />
      <div className="p-7">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-7">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-2" style={{ fontWeight: 800 }}>Fase 6 · PMO {pmoType} · Nivel {maturityLevel}</p>
            <h1 className="text-neutral-950 tracking-tight" style={{ fontWeight: 850, fontSize: '2.35rem', lineHeight: 1.02 }}>
              {approved ? 'Enfoque metodologico aprobado' : 'Enfoque metodologico'}
            </h1>
            <p className="mt-3 max-w-4xl text-[14px] leading-relaxed text-neutral-600">
              El Agente 6 consolido tipo de PMO y madurez para definir el enfoque, priorizar debilidades y preparar las instrucciones que recibira el Agente 7.
            </p>
          </div>
          <div className="self-start">
            <VersionBadge result={result} approved={approved} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
          <div className="rounded-[1.25rem] border border-[#5454e9]/15 bg-[#5454e9]/[0.045] p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: pmoColor || '#5454e9' }}>
                <GitMerge size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#3535a8] mb-1" style={{ fontWeight: 850 }}>Tipo de guia recomendado</p>
                <h2 className="text-neutral-950 text-[20px] leading-tight" style={{ fontWeight: 850 }}>{valueOrEmpty(result.enfoque?.tipo)}</h2>
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">{valueOrEmpty(result.enfoque?.orientacion)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <PhaseReportMetric label="Principios" value={result.enfoque?.principios?.length ?? 0} tone="blue" icon={<Lightbulb size={15} />} />
            <PhaseReportMetric label="Debilidades" value={result.puntosDebiles?.length ?? 0} tone="orange" icon={<ShieldAlert size={15} />} />
            <PhaseReportMetric label="Directrices" value={directrizCount(result)} tone="green" icon={<BookOpen size={15} />} />
            <PhaseReportMetric label="Madurez" value={`${maturityLevel}/5`} tone="purple" icon={<Gauge size={15} />} />
          </div>
        </div>

        {approved && completedAt && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4cb979]/10 border border-[#4cb979]/20 px-3 py-1.5 text-[12px] text-[#22794b]" style={{ fontWeight: 750 }}>
            <CheckCircle2 size={13} />
            Aprobado el {completedAt}
          </div>
        )}
      </div>
    </section>
  );
}

function PrincipiosSection({ result }: { result: any }) {
  const tones: PhaseReportTone[] = ['blue', 'green', 'purple', 'orange', 'amber'];
  return (
    <PhaseReportSection title="Principios rectores" eyebrow="Definicion de enfoque" icon={<Lightbulb size={18} />} tone="blue">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(result.enfoque?.principios ?? []).map((principio: any, index: number) => {
          const tone = tones[index % tones.length];
          const toneClass = phaseReportToneStyles[tone];
          return (
            <article key={`${principio.titulo}-${index}`} className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
              <div className={`h-1 ${toneClass.bar}`} />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span className={`w-7 h-7 rounded-full ${toneClass.bg} text-white flex items-center justify-center flex-shrink-0 text-[12px]`} style={{ fontWeight: 900 }}>{index + 1}</span>
                  <div>
                    <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(principio.titulo)}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{valueOrEmpty(principio.descripcion)}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </PhaseReportSection>
  );
}

function DebilidadesSection({ result }: { result: any }) {
  const high = (result.puntosDebiles ?? []).filter((item: any) => item.criticidad === 'Alta').length;
  return (
    <PhaseReportSection title="Puntos debiles priorizados" eyebrow={`${high} criticos`} icon={<ShieldAlert size={18} />} tone="orange">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(result.puntosDebiles ?? []).map((punto: any, index: number) => {
          const tone = severityTone(punto.criticidad);
          const toneClass = phaseReportToneStyles[tone];
          return (
            <article key={`${punto.area}-${index}`} className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
              <div className={`h-1 ${toneClass.bar}`} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{valueOrEmpty(punto.area)}</p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.1em] ${toneClass.text}`} style={{ fontWeight: 850 }}>{valueOrEmpty(punto.criticidad)}</p>
                  </div>
                  <AlertTriangle size={17} className={toneClass.icon} />
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">{valueOrEmpty(punto.descripcion)}</p>
                {punto.impacto && (
                  <p className={`mt-3 rounded-xl ${toneClass.soft} border ${toneClass.border} px-3 py-2 text-[12px] leading-relaxed ${toneClass.text}`} style={{ fontWeight: 700 }}>
                    Impacto: {punto.impacto}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </PhaseReportSection>
  );
}

function InstruccionesSection({ result }: { result: any }) {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <PhaseReportSection title="Brief tecnico para Agente 7" eyebrow={`${directrizCount(result)} directrices`} icon={<Brain size={18} />} tone="purple">
      <div className="rounded-2xl border border-[#5454e9]/20 bg-white overflow-hidden">
        <div className="bg-[#5454e9] px-5 py-3 flex flex-wrap items-center gap-2 text-white">
          <Code2 size={15} />
          <span className="text-[11px] uppercase tracking-[0.14em]" style={{ fontWeight: 850 }}>Instrucciones de construccion de guia</span>
          <span className="ml-auto text-[11px] text-white/70">Generado por Agente 6</span>
        </div>

        <div className="divide-y divide-neutral-100">
          {(result.instrucciones ?? []).map((instr: any, index: number) => {
            const Icon = instr.icon ?? BookOpen;
            const isOpen = expanded === index;
            return (
              <div key={`${instr.categoria}-${index}`}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : index)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#5454e9]/[0.035] transition-colors">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-[#5454e9] text-white' : 'bg-[#5454e9]/[0.08] text-[#5454e9]'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-950 text-[14px]" style={{ fontWeight: 850 }}>{valueOrEmpty(instr.categoria)}</p>
                    <p className="text-neutral-500 text-[11px]">{instr.directrices?.length ?? 0} directrices</p>
                  </div>
                  <ChevronRight size={16} className="text-neutral-400 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                </button>

                <motion.div initial={false} animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }} transition={{ duration: 0.22 }} className="overflow-hidden print:!h-auto print:!opacity-100">
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                      {(instr.directrices ?? []).map((item: string, itemIndex: number) => (
                        <div key={`${item}-${itemIndex}`} className="flex items-start gap-3 rounded-xl bg-white border border-neutral-100 p-3">
                          <span className="w-6 h-6 rounded-full bg-[#5454e9] text-white flex items-center justify-center flex-shrink-0 text-[11px]" style={{ fontWeight: 900 }}>{itemIndex + 1}</span>
                          <p className="text-[13px] leading-relaxed text-neutral-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </PhaseReportSection>
  );
}

function DiagnosticSummarySection({ result }: { result: any }) {
  if (!result.rawData) return null;
  const raw = result.rawData;
  const summary = raw?.diagnosis?.summary || raw?.summary || '';
  const ga = raw?.diagnosis?.guide_approach ?? raw?.guide_approach ?? {};
  const experto = raw?.diagnosis?.diagnostico_experto ?? raw?.diagnostico_experto ?? {};
  const roles = raw?.diagnosis?.roles_identificados ?? raw?.roles_identificados ?? experto?.roles_identificados ?? [];
  const descripcion = raw?.diagnosis?.descripcion_general ?? raw?.descripcion_general ?? experto?.descripcion_general ?? '';
  const resumen = raw?.diagnosis?.resumen_diagnostico ?? raw?.resumen_diagnostico ?? experto?.resumen_diagnostico ?? '';
  const hasContent = summary || descripcion || resumen || ga?.type || ga?.justification || roles?.length;
  if (!hasContent) return null;

  return (
    <PhaseReportSection title="Resumen diagnostico" eyebrow="Contexto del agente" icon={<BarChart3 size={18} />} tone="slate">
      <div className="space-y-4">
        <PhaseReportKeyValueGrid rows={[
          { label: 'Tipo de enfoque', value: ga?.type ?? result.enfoque?.tipo, tone: 'blue' },
          { label: 'Marco primario', value: ga?.primary_framework, tone: 'green' },
          { label: 'Marco secundario', value: ga?.secondary_framework, tone: 'purple' },
          { label: 'Balance', value: ga?.framework_balance, tone: 'amber' },
        ]} />
        {descripcion && <PhaseReportList items={[descripcion]} tone="blue" />}
        {summary && <PhaseReportList items={[summary]} tone="green" />}
        {resumen && <PhaseReportList items={[resumen]} tone="purple" />}
        {ga?.justification && <PhaseReportList items={[ga.justification]} tone="orange" />}
        {roles?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Roles identificados</p>
            <PhaseReportBadgeList items={roles.map((role: any, index: number) => role.nombre_cargo || role.cargo || role.nombre || `Rol ${index + 1}`)} tone="blue" />
          </div>
        )}
      </div>
    </PhaseReportSection>
  );
}

function CommentsSection({
  comment,
  savedComment,
  isSavingComment,
  onCommentChange,
  onSaveComment,
  onReprocess,
  onApprove,
}: EnfoqueDiagnosisViewProps) {
  return (
    <section className="rounded-[1.35rem] border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={15} className="text-neutral-500" />
        <h3 className="text-neutral-900 text-sm" style={{ fontWeight: 750 }}>Ajustes a las instrucciones</h3>
      </div>
      <p className="text-neutral-500 text-xs mb-3">
        Indique cambios, matices o contexto adicional para el brief que recibira el Agente 7.
      </p>
      {savedComment && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#5454e9]/[0.06] border border-[#5454e9]/15 text-[13px] text-neutral-700">
          <p className="text-[#3535a8] text-xs mb-1" style={{ fontWeight: 800 }}>Ultimo ajuste guardado</p>
          <p className="leading-relaxed">{savedComment}</p>
        </div>
      )}
      <textarea
        value={comment}
        onChange={(event) => onCommentChange?.(event.target.value)}
        placeholder="Ej: Las instrucciones deben incluir una seccion especifica de gobernanza para proyectos regulados..."
        rows={4}
        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm outline-none focus:border-[#5454e9]/60 focus:ring-2 focus:ring-[#5454e9]/10 transition-all resize-y leading-relaxed bg-white mb-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onSaveComment} disabled={isSavingComment || !comment?.trim()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-sm hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all" style={{ fontWeight: 650 }}>
          {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar ajuste
        </button>
        <button onClick={onReprocess} disabled={!comment?.trim()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#5454e9]/25 text-[#3535a8] bg-[#5454e9]/[0.06] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-[#5454e9]/10" style={{ fontWeight: 650 }}>
          <RefreshCw size={13} /> Reprocesar instrucciones
        </button>
        <div className="flex-1" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onApprove} className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm transition-all" style={{ background: '#5454e9', fontWeight: 750, boxShadow: '0 10px 28px -16px rgba(84,84,233,0.7)' }}>
          <ThumbsUp size={14} /> Aprobar instrucciones
        </motion.button>
      </div>
    </section>
  );
}

export default function EnfoqueDiagnosisView(props: EnfoqueDiagnosisViewProps) {
  const { result, approved } = props;
  return (
    <motion.div key={approved ? 'approved' : 'results'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      <EnfoqueHero {...props} />
      <PrincipiosSection result={result} />
      <DebilidadesSection result={result} />
      <InstruccionesSection result={result} />
      <DiagnosticSummarySection result={result} />
      {!approved && <CommentsSection {...props} />}
    </motion.div>
  );
}
