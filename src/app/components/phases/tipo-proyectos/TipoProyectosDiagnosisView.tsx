import type { ReactNode } from 'react';
import { Calendar, CheckCircle2, GitMerge, Info, Lightbulb, MessageSquare, RefreshCw, Save, ShieldAlert, Sparkles, Target, ThumbsUp, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import {
  levelTone,
  normalizeList,
  PhaseReportBadgeList,
  PhaseReportKeyValueGrid,
  PhaseReportList,
  PhaseReportMetric,
  PhaseReportProgressBar,
  PhaseReportSection,
  phaseReportToneStyles,
  type PhaseReportTone,
  valueOrEmpty,
} from '../_shared/PhaseReportVisuals';

interface TipoProyectosDiagnosisViewProps {
  diagnosis: any;
  approved?: boolean;
  completedAt?: string | null;
  savedComment?: string;
  comment?: string;
  isSavingComment?: boolean;
  isReprocessing?: boolean;
  onCommentChange?: (value: string) => void;
  onSaveComment?: () => void;
  onReprocess?: () => void;
  onApprove?: () => void;
  annex?: ReactNode;
}

function typeTone(type: unknown): PhaseReportTone {
  const token = String(type ?? '').toLowerCase();
  if (token.includes('predict')) return 'blue';
  if (token.includes('hibr') || token.includes('hybr')) return 'amber';
  if (token.includes('agil') || token.includes('ágil')) return 'green';
  return 'purple';
}

function intensityTone(value: unknown): PhaseReportTone {
  const token = String(value ?? '').toLowerCase();
  if (token.includes('alta') || token.includes('alto')) return 'red';
  if (token.includes('moder')) return 'orange';
  if (token.includes('media') || token.includes('medio')) return 'amber';
  return levelTone(value);
}

function typeIcon(type: unknown) {
  const token = String(type ?? '').toLowerCase();
  if (token.includes('agil') || token.includes('ágil')) return <Zap size={19} />;
  if (token.includes('hibr') || token.includes('hybr')) return <GitMerge size={19} />;
  return <Target size={19} />;
}

function typeTagline(type: unknown) {
  const token = String(type ?? '').toLowerCase();
  if (token.includes('agil') || token.includes('ágil')) return 'Estructura flexible orientada a ciclos iterativos y entrega continua de valor.';
  if (token.includes('hibr') || token.includes('hybr')) return 'Combina practicas agiles y predictivas segun el contexto de cada proyecto.';
  return 'Gestion secuencial con planificacion detallada y control formal de cambios.';
}

function VersionBadge({ diagnosis, approved }: { diagnosis: any; approved?: boolean }) {
  const timestamp = diagnosis.timestamp ? new Date(diagnosis.timestamp) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${approved ? 'bg-[#4cb979]/10 text-[#22794b] border-[#4cb979]/25' : 'bg-[#865cf0]/10 text-[#5d3bbd] border-[#865cf0]/25'}`} style={{ fontWeight: 750 }}>
        {approved ? <CheckCircle2 size={12} /> : <Sparkles size={12} />}
        {approved ? 'Diagnostico aprobado' : diagnosis.version === 'reprocesado' ? 'Diagnostico reprocesado' : 'Diagnostico original'}
      </span>
      {timestamp && (
        <span className="text-[11px] text-neutral-400">
          {timestamp.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      )}
    </div>
  );
}

function PmoHero({ diagnosis, approved }: { diagnosis: any; approved?: boolean }) {
  const tone = typeTone(diagnosis.pmoType);
  const toneClass = phaseReportToneStyles[tone];
  const confidence = Number(diagnosis.confidence ?? 0);
  return (
    <section className={`rounded-[1.5rem] overflow-hidden border ${toneClass.border} bg-white`} style={{ boxShadow: '0 20px 55px -34px rgba(84,84,233,0.5)' }}>
      <div className={`${toneClass.bg} p-6 text-white`}>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-white/14 border border-white/20 flex items-center justify-center">
                {typeIcon(diagnosis.pmoType)}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/70" style={{ fontWeight: 800 }}>Agente 4 - Clasificacion de proyectos</p>
                <h2 className="text-[22px] tracking-tight" style={{ fontWeight: 850 }}>PMO {valueOrEmpty(diagnosis.pmoType)}</h2>
              </div>
            </div>
            <p className="text-white/88 text-[14px] leading-relaxed max-w-4xl">{typeTagline(diagnosis.pmoType)}</p>
          </div>
          <div className="w-24 h-24 rounded-full bg-white/14 border border-white/20 flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-[26px] tabular-nums tracking-tight" style={{ fontWeight: 850 }}>{confidence}</span>
            <span className="text-[10px] text-white/70">% confianza</span>
          </div>
        </div>
      </div>
      <div className={`px-6 py-3 ${toneClass.soft} border-t ${toneClass.border} flex flex-wrap items-center justify-between gap-3`}>
        <VersionBadge diagnosis={diagnosis} approved={approved} />
        <span className={`px-2.5 py-1 rounded-full ${toneClass.bg} text-white text-[10px]`} style={{ fontWeight: 850 }}>
          {valueOrEmpty(diagnosis.confidence_label)}
        </span>
      </div>
    </section>
  );
}

function BreakdownPanel({ diagnosis }: { diagnosis: any }) {
  const breakdown = diagnosis.type_breakdown;
  if (!breakdown) return null;
  const agile = Number(breakdown.agile_weight ?? 0);
  const predictive = Number(breakdown.predictive_weight ?? 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PhaseReportMetric label="Peso agil" value={`${agile}%`} tone="green" icon={<Zap size={15} />} />
        <PhaseReportMetric label="Peso predictivo" value={`${predictive}%`} tone="blue" icon={<Target size={15} />} />
      </div>
      <div className="rounded-2xl border border-neutral-100 bg-white p-4">
        <PhaseReportProgressBar label="Agil" value={agile} max={100} tone="green" />
        <div className="mt-3">
          <PhaseReportProgressBar label="Predictivo" value={predictive} max={100} tone="blue" />
        </div>
      </div>
      {String(breakdown.hybrid_rationale ?? '').trim() && (
        <div className="rounded-2xl border border-[#e4eb60]/50 bg-[#e4eb60]/25 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#7a7f1e] mb-2" style={{ fontWeight: 850 }}>Racional hibrido</p>
          <p className="text-neutral-700 text-[13px] leading-relaxed">{breakdown.hybrid_rationale}</p>
        </div>
      )}
    </div>
  );
}

function SourceOrientations({ diagnosis }: { diagnosis: any }) {
  const orientations = diagnosis.orientaciones_por_fuente;
  if (!orientations) return null;
  const labels: Record<string, string> = {
    cuantitativo: 'Encuesta cuantitativa',
    cualitativo: 'Entrevistas cualitativas',
    documental: 'Analisis documental',
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {['cuantitativo', 'cualitativo', 'documental'].map((source) => {
        const data = orientations[source];
        if (!data) return null;
        const tone = typeTone(data.orientacion);
        const toneClass = phaseReportToneStyles[tone];
        return (
          <article key={source} className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
            <div className={`h-1 ${toneClass.bar}`} />
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>{labels[source]}</p>
              <span className={`inline-flex px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] mb-3`} style={{ fontWeight: 850 }}>
                {valueOrEmpty(data.orientacion)}
              </span>
              <p className="text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(data.evidencia_principal)}</p>
              {Number(data.promedio_general) > 0 && (
                <p className="text-neutral-500 text-[11px] mt-3">Promedio: <span className="tabular-nums" style={{ fontWeight: 800 }}>{data.promedio_general}</span></p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TensionCard({ tension, index }: { tension: any; index: number }) {
  const tone = intensityTone(tension.intensidad);
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 850 }}>{valueOrEmpty(tension.tipo)}</p>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 850 }}>
            {valueOrEmpty(tension.intensidad)}
          </span>
        </div>
        <p className="mt-3 text-neutral-700 text-[13px] leading-relaxed">{valueOrEmpty(tension.descripcion)}</p>
      </div>
    </article>
  );
}

function IntegrationPanel({ diagnosis }: { diagnosis: any }) {
  return (
    <PhaseReportKeyValueGrid rows={[
      { label: 'Coherencia entre fuentes', value: diagnosis.coherencia, tone: levelTone(diagnosis.coherencia) },
      { label: 'Estado de integracion', value: diagnosis.estado_integracion, tone: levelTone(diagnosis.estado_integracion) },
      { label: 'Confianza', value: `${valueOrEmpty(diagnosis.confidence ?? diagnosis.confidence_level)}%`, tone: levelTone(diagnosis.confidence_label) },
      { label: 'Tipo PMO', value: diagnosis.pmoType, tone: typeTone(diagnosis.pmoType) },
    ]} />
  );
}

function FasesOpcionalesPanel({ diagnosis }: { diagnosis: any }) {
  const fases = diagnosis.fases_opcionales;
  if (!fases) return null;
  const preProyecto = fases.pre_proyecto;
  const postCierre = fases.post_cierre;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <article className={`rounded-2xl border overflow-hidden ${
        preProyecto?.aplica ? 'border-green-200 bg-white' : 'border-neutral-100 bg-neutral-50'
      }`}>
        <div className={`h-1 ${preProyecto?.aplica ? 'bg-green-500' : 'bg-neutral-200'}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={15} className={preProyecto?.aplica ? 'text-green-600' : 'text-neutral-400'} />
              <p className="text-neutral-950 text-[14px]" style={{ fontWeight: 800 }}>Pre-proyecto</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] border ${
              preProyecto?.aplica
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-neutral-100 text-neutral-500 border-neutral-200'
            }`} style={{ fontWeight: 800 }}>
              {preProyecto?.aplica ? 'Aplica' : 'No aplica'}
            </span>
          </div>
          {preProyecto?.justificacion ? (
            <p className="text-neutral-700 text-[13px] leading-relaxed">{preProyecto.justificacion}</p>
          ) : (
            <p className="text-neutral-400 text-[12px] italic">Sin evidencia identificada.</p>
          )}
        </div>
      </article>

      <article className={`rounded-2xl border overflow-hidden ${
        postCierre?.aplica ? 'border-blue-200 bg-white' : 'border-neutral-100 bg-neutral-50'
      }`}>
        <div className={`h-1 ${postCierre?.aplica ? 'bg-blue-500' : 'bg-neutral-200'}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={15} className={postCierre?.aplica ? 'text-blue-600' : 'text-neutral-400'} />
              <p className="text-neutral-950 text-[14px]" style={{ fontWeight: 800 }}>Post-cierre</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] border ${
              postCierre?.aplica
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-neutral-100 text-neutral-500 border-neutral-200'
            }`} style={{ fontWeight: 800 }}>
              {postCierre?.aplica ? 'Aplica' : 'No aplica'}
            </span>
          </div>
          {postCierre?.justificacion ? (
            <p className="text-neutral-700 text-[13px] leading-relaxed">{postCierre.justificacion}</p>
          ) : (
            <p className="text-neutral-400 text-[12px] italic">Sin evidencia identificada.</p>
          )}
        </div>
      </article>
    </div>
  );
}

function ConsultantComments({
  savedComment,
  comment,
  isSavingComment,
  isReprocessing,
  onCommentChange,
  onSaveComment,
  onReprocess,
  onApprove,
}: Pick<TipoProyectosDiagnosisViewProps, 'savedComment' | 'comment' | 'isSavingComment' | 'isReprocessing' | 'onCommentChange' | 'onSaveComment' | 'onReprocess' | 'onApprove'>) {
  return (
    <section className="rounded-[1.35rem] border border-neutral-200 bg-white overflow-hidden" style={{ boxShadow: '0 18px 44px -30px rgba(31,41,55,0.35)' }}>
      <div className="h-1.5 bg-neutral-900" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-neutral-50 text-neutral-700 border border-neutral-200 flex items-center justify-center">
            <MessageSquare size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1" style={{ fontWeight: 700 }}>Revision consultor</p>
            <h2 className="text-neutral-950 text-[18px] tracking-tight" style={{ fontWeight: 750 }}>Comentarios y aprobacion</h2>
          </div>
        </div>
        {savedComment && (
          <div className="mb-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 text-[13px] text-neutral-600">
            <p className="text-neutral-400 text-xs mb-1" style={{ fontWeight: 700 }}>Ultimo comentario guardado</p>
            <p className="leading-relaxed">{savedComment}</p>
          </div>
        )}
        <textarea
          value={comment ?? ''}
          onChange={(event) => onCommentChange?.(event.target.value)}
          placeholder="Agregue observaciones, contexto o ajustes al diagnostico..."
          rows={4}
          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 transition-all resize-y leading-relaxed bg-white mb-3"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onSaveComment}
            disabled={isSavingComment || !comment?.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-sm hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ fontWeight: 500 }}
          >
            <Save size={13} />
            Guardar comentario
          </button>
          <button
            onClick={onReprocess}
            disabled={isReprocessing || !comment?.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#5454e9]/25 bg-[#5454e9]/[0.08] text-[#3838b8] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ fontWeight: 600 }}
          >
            <RefreshCw size={13} />
            Re-procesar con comentario
          </button>
          <div className="flex-1" />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onApprove}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
            style={{ background: '#5454e9', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
          >
            <ThumbsUp size={14} />
            Aprobar diagnostico
          </motion.button>
        </div>
      </div>
    </section>
  );
}

export default function TipoProyectosDiagnosisView(props: TipoProyectosDiagnosisViewProps) {
  const { diagnosis, approved, completedAt, annex } = props;
  return (
    <motion.div key={approved ? 'approved' : 'diagnosis'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      <PmoHero diagnosis={diagnosis} approved={approved} />

      {approved && (
        <div className="rounded-2xl border border-[#4cb979]/25 bg-[#4cb979]/10 p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-[#22794b]" />
          <p className="text-[#22794b] text-[13px]" style={{ fontWeight: 750 }}>
            Fase completada y aprobada{completedAt ? ` el ${completedAt}` : ''}.
          </p>
        </div>
      )}

      <PhaseReportSection title="Justificacion del agente" eyebrow="Lectura consolidada" icon={<Lightbulb size={18} />} tone={typeTone(diagnosis.pmoType)}>
        <p className="text-neutral-700 text-[14px] leading-relaxed">{valueOrEmpty(diagnosis.justification)}</p>
      </PhaseReportSection>

      <PhaseReportSection title="Integracion de fuentes" eyebrow="Coherencia y confianza" icon={<ShieldAlert size={18} />} tone="blue">
        <IntegrationPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Composicion del enfoque" eyebrow="Agil vs predictivo" icon={<GitMerge size={18} />} tone="amber">
        <BreakdownPanel diagnosis={diagnosis} />
      </PhaseReportSection>

      {diagnosis.fases_opcionales && (
        <PhaseReportSection title="Fases opcionales" eyebrow="Pre-proyecto y post-cierre" icon={<Calendar size={18} />} tone="green">
          <FasesOpcionalesPanel diagnosis={diagnosis} />
        </PhaseReportSection>
      )}

      <PhaseReportSection title="Evidencia de soporte" eyebrow="Maximo 8 items referenciados" icon={<Info size={18} />} tone="green">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {normalizeList(diagnosis.keyFactors).map((factor, i) => (
            <div key={i} className="rounded-2xl border border-[#4cb979]/25 bg-[#4cb979]/10 p-4 flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#4cb979] text-white flex items-center justify-center flex-shrink-0 text-[11px]" style={{ fontWeight: 800 }}>{i + 1}</div>
              <p className="text-neutral-700 text-[13px] leading-relaxed">{typeof factor === 'string' ? factor : JSON.stringify(factor)}</p>
            </div>
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Orientaciones por fuente" eyebrow="Cuantitativo - cualitativo - documental" icon={<Target size={18} />} tone="purple">
        <SourceOrientations diagnosis={diagnosis} />
      </PhaseReportSection>

      <PhaseReportSection title="Tensiones detectadas" eyebrow="Fricciones estructurales" icon={<ShieldAlert size={18} />} tone="orange">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(diagnosis.tensiones?.length ? diagnosis.tensiones : [{ tipo: 'N/A', intensidad: 'N/A', descripcion: 'N/A' }]).map((tension: any, i: number) => (
            <TensionCard key={i} tension={tension} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      {diagnosis.advertencias_de_entrada?.length > 0 && (
        <PhaseReportSection title="Advertencias de entrada" eyebrow="Limitaciones de integracion" icon={<Info size={18} />} tone="red">
          <PhaseReportList items={diagnosis.advertencias_de_entrada} tone="red" />
        </PhaseReportSection>
      )}

      {annex}

      {!approved && (
        <ConsultantComments
          savedComment={props.savedComment}
          comment={props.comment}
          isSavingComment={props.isSavingComment}
          isReprocessing={props.isReprocessing}
          onCommentChange={props.onCommentChange}
          onSaveComment={props.onSaveComment}
          onReprocess={props.onReprocess}
          onApprove={props.onApprove}
        />
      )}
    </motion.div>
  );
}
