/**
 * MadurezModule — Fase 5: Madurez de la PMO
 *
 * RF-F5-01  Se adapta dinámicamente según el tipo de PMO aprobado en Fase 4.
 * RF-F5-02  Dos métodos de entrada por encuesta: en línea paso a paso o carga de datos.
 * RF-F5-03  Híbrida: ambas encuestas deben completarse antes de enviar al Agente 5.
 * RF-F5-04  "Marcar como completa" envía datos al Agente 5 (mismo patrón de procesamiento).
 * RF-F5-05  Vista de resultados: nivel de madurez, descripción, brechas, recomendaciones.
 * RF-F5-06  Comentarios y reprocesamiento idéntico a RF-F4-05/06.
 * RF-F5-07  "Aprobar diagnóstico de madurez" → Fase 5 completada, Fase 6 desbloqueada.
 *
 * TODO: Leer tipo PMO desde Supabase (tabla 'fases_resultado', fase_num: 4)
 * TODO: RF-F5-04 → axios.post(N8N_WEBHOOK_AGENTE_5, { tipo_pmo, respuestas_agil, respuestas_predictiva })
 * TODO: RF-F5-06 → persist comentario en 'consultor_comentarios'
 */

import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, CheckCircle2, Brain, ChevronLeft, ChevronRight,
  Zap, BarChart2, GitMerge, FileUp, Paperclip, ClipboardEdit, Globe,
  MessageSquare, Save, RefreshCw, ThumbsUp, Send, AlertTriangle,
  Clock, Sparkles, Info, Target, TrendingUp, AlertCircle, X, Layers, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { useSoundManager } from '../../hooks/useSoundManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type SurveyKey = 'agil' | 'predictiva';
type EntryMethod = 'online' | 'manual';
type ModuleView = 'overview' | 'online-survey' | 'manual-entry' | 'processing' | 'results' | 'approved';
type DiagnosisVersion = 'original' | 'reprocesado';

interface SurveyState {
  completed: boolean;
  method: EntryMethod | null;
  answers: Record<string, number>;
  manualText: string;
  attachedFile: { name: string; size: number } | null;
}

interface MaturityResult {
  level: number;
  score: number;
  gaps: string[];
  recommendations: string[];
}

interface FullResults {
  agil?: MaturityResult;
  predictiva?: MaturityResult;
  overallLevel: number;
  overallScore: number;
  summary: string;
  timestamp: string;
  version: DiagnosisVersion;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MATURITY_LEVELS = [
  { level: 1, name: 'Inicial',        color: '#737373', bg: '#f5f5f5', desc: 'Procesos ad-hoc y reactivos. Sin estandarización formal ni visibilidad.' },
  { level: 2, name: 'En Desarrollo',  color: '#525252', bg: '#f5f5f5', desc: 'Algunos procesos definidos, pero aplicación inconsistente entre equipos.' },
  { level: 3, name: 'Definido',       color: '#404040', bg: '#f5f5f5', desc: 'Procesos documentados y seguidos de manera consistente en la organización.' },
  { level: 4, name: 'Gestionado',     color: '#262626', bg: '#f5f5f5', desc: 'Procesos medidos y controlados mediante métricas y tableros de indicadores.' },
  { level: 5, name: 'Optimizado',     color: '#0a0a0a', bg: '#f5f5f5', desc: 'Mejora continua e innovación sistemática integradas a la cultura organizacional.' },
];

const QUESTIONS_PREDICTIVA = [
  { id: 'p1', text: '¿Existe un proceso formal de inicio de proyectos con acta de constitución documentada?', dimension: 'Inicio' },
  { id: 'p2', text: '¿Se elaboran planes detallados de alcance, tiempo y costo antes de ejecutar cada proyecto?', dimension: 'Planificación' },
  { id: 'p3', text: '¿Hay un sistema de control de cambios implementado y seguido consistentemente por los equipos?', dimension: 'Control' },
  { id: 'p4', text: '¿Se realiza gestión formal de riesgos con registro de riesgos y planes de respuesta definidos?', dimension: 'Riesgos' },
  { id: 'p5', text: '¿Se mide el desempeño del proyecto con indicadores formales como EVM, CPI o SPI?', dimension: 'Métricas' },
  { id: 'p6', text: '¿Existe gobernanza formal con comités de seguimiento, aprobación y escalamiento de decisiones?', dimension: 'Gobernanza' },
  { id: 'p7', text: '¿Se documentan y aprovechan las lecciones aprendidas al cerrar formalmente cada proyecto?', dimension: 'Cierre' },
];

const QUESTIONS_AGIL = [
  { id: 'a1', text: '¿Los equipos trabajan en ciclos iterativos (sprints o iteraciones) con entregables definidos?', dimension: 'Iteraciones' },
  { id: 'a2', text: '¿Se realizan retrospectivas periódicas y sus acciones de mejora se implementan efectivamente?', dimension: 'Mejora' },
  { id: 'a3', text: '¿El product backlog está priorizado, refinado y actualizado de forma continua?', dimension: 'Backlog' },
  { id: 'a4', text: '¿Los equipos tienen autonomía real para decidir cómo ejecutar y organizar su trabajo?', dimension: 'Autonomía' },
  { id: 'a5', text: '¿Se mide la velocidad del equipo (velocity) y se utiliza como insumo para la planificación futura?', dimension: 'Métricas' },
  { id: 'a6', text: '¿Existe un Product Owner o rol equivalente con poder de decisión sobre el alcance del backlog?', dimension: 'Roles' },
  { id: 'a7', text: '¿Las entregas de valor llegan al usuario final de forma frecuente, continua y validada?', dimension: 'Entrega' },
];

const LIKERT = [
  { value: 1, label: 'Nunca',          desc: 'No existe ninguna práctica al respecto' },
  { value: 2, label: 'Raramente',      desc: 'Ocurre de forma esporádica y no sistemática' },
  { value: 3, label: 'A veces',        desc: 'Se aplica en algunos proyectos o áreas' },
  { value: 4, label: 'Frecuentemente', desc: 'Es una práctica habitual en la mayoría de casos' },
  { value: 5, label: 'Siempre',        desc: 'Está institucionalizado y se aplica consistentemente' },
];

const MOCK_RESULTS_PREDICTIVA: MaturityResult = {
  level: 3, score: 67,
  gaps: [
    'El control de cambios no está implementado de forma uniforme en todas las unidades.',
    'La gestión de riesgos se realiza de manera informal y sin registros actualizados.',
    'Las métricas de desempeño (EVM/CPI) son conocidas pero no aplicadas sistemáticamente.',
    'Las lecciones aprendidas se documentan ocasionalmente y no se reutilizan.',
  ],
  recommendations: [
    'Estandarizar la plantilla de acta de constitución y hacerla obligatoria para todos los proyectos.',
    'Implementar un registro centralizado de riesgos con revisión quincenal.',
    'Capacitar a los gerentes de proyecto en métricas de valor ganado (EVM).',
  ],
};

const MOCK_RESULTS_AGIL: MaturityResult = {
  level: 2, score: 44,
  gaps: [
    'Las retrospectivas son esporádicas y sus compromisos de mejora no tienen seguimiento.',
    'El backlog carece de priorización formal; los ítems no tienen criterios de aceptación.',
    'Los equipos dependen de la aprobación gerencial para decisiones operativas simples.',
    'No se mide la velocidad del equipo ni se usa para estimar futuros sprints.',
  ],
  recommendations: [
    'Institucionalizar retrospectivas al cierre de cada sprint con tablero de compromisos.',
    'Designar un Product Owner con dedicación real y capacitar en refinamiento de backlog.',
    'Definir un sistema de métricas ágiles: velocity, burn-down y lead time.',
  ],
};

function buildMockResults(pmoType: PmoType, comment?: string): FullResults {
  const hasAgil = pmoType === 'Ágil' || pmoType === 'Híbrida';
  const hasPredictiva = pmoType === 'Predictiva' || pmoType === 'Híbrida';
  const agil = hasAgil ? { ...MOCK_RESULTS_AGIL, score: comment ? 51 : 44 } : undefined;
  const predictiva = hasPredictiva ? { ...MOCK_RESULTS_PREDICTIVA, score: comment ? 72 : 67 } : undefined;
  const scores = [agil?.score, predictiva?.score].filter(Boolean) as number[];
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallLevel = overallScore >= 80 ? 4 : overallScore >= 60 ? 3 : overallScore >= 40 ? 2 : 1;

  return {
    agil, predictiva, overallLevel, overallScore,
    summary: comment
      ? `[Diagnóstico reprocesado] Tras incorporar el comentario del consultor ("${comment.slice(0, 60)}..."), el Agente 5 recalibró los pesos de las dimensiones evaluadas, reflejando un incremento marginal en las puntuaciones.`
      : `El diagnóstico de madurez revela que la organización se encuentra en una etapa ${pmoType === 'Híbrida' ? 'de transición entre los niveles 2 y 3' : `Nivel ${overallLevel}`}. Se identificaron brechas críticas en la sistematización de procesos y en la medición del desempeño. Se recomienda un plan de mejora focalizado en las dimensiones con mayor brecha antes de avanzar al siguiente nivel de madurez.`,
    timestamp: new Date().toISOString(),
    version: comment ? 'reprocesado' : 'original',
  };
}

// ---------------------------------------------------------------------------
// PMO type config
// ---------------------------------------------------------------------------
const PMO_CONFIG = {
  Ágil:       { color: '#0a0a0a', Icon: Layers,       label: 'Ágil' },
  Híbrida:    { color: '#0a0a0a', Icon: Layers,  label: 'Híbrida' },
  Predictiva: { color: '#0a0a0a', Icon: Layers, label: 'Predictiva' },
};

// ---------------------------------------------------------------------------
// Helper: parse PMO type from Phase 4 agentDiagnosis string
// ---------------------------------------------------------------------------
function parsePmoType(agentData?: any): PmoType {
  if (!agentData) return 'Híbrida';
  
  const diag = agentData.diagnosis || agentData;
  const rawType = String(diag.pmo_type || diag.pmoType || diag.summary || 'Híbrido').toLowerCase();
  
  if (rawType.includes('agil') || rawType.includes('ágil')) return 'Ágil';
  if (rawType.includes('predictiv')) return 'Predictiva';
  
  return 'Híbrida';
}

// ---------------------------------------------------------------------------
// Maturity level bar
// ---------------------------------------------------------------------------
function MaturityLevelBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {MATURITY_LEVELS.map(ml => (
        <div key={ml.level} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: ml.level * 0.08, duration: 0.3 }}
            className="w-full rounded-md"
            style={{
              height: ml.level === level ? 28 : 16,
              background: ml.level <= level ? ml.color : '#e5e7eb',
              opacity: ml.level === level ? 1 : ml.level < level ? 0.5 : 0.25,
              transformOrigin: 'bottom',
            }}
          />
          <span className="text-xs" style={{
            fontWeight: ml.level === level ? 700 : 400,
            color: ml.level === level ? ml.color : '#9ca3af',
          }}>
            {ml.level}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline step-by-step survey
// ---------------------------------------------------------------------------
function InlineSurvey({
  surveyKey,
  onComplete,
  onBack,
  initialAnswers,
}: {
  surveyKey: SurveyKey;
  onComplete: (answers: Record<string, number>) => void;
  onBack: () => void;
  initialAnswers: Record<string, number>;
}) {
  const questions = surveyKey === 'agil' ? QUESTIONS_AGIL : QUESTIONS_PREDICTIVA;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const q = questions[step];
  const selected = answers[q.id];
  const isLast = step === questions.length - 1;
  const pct = ((step + 1) / questions.length) * 100;

  return (
    <motion.div key="inline-survey" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* Survey header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors">
          <ChevronLeft size={15} /> Volver al resumen
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400" style={{ fontWeight: 500 }}>
            Pregunta {step + 1} de {questions.length}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-600" style={{ fontWeight: 600 }}>
            Encuesta {surveyKey === 'agil' ? 'Ágil' : 'Predictiva'}
          </span>
        </div>
      </div>

      <div className="h-1.5 bg-neutral-200 rounded-full mb-8 overflow-hidden">
        <motion.div className="h-full rounded-full bg-neutral-900"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.35 }} />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-wide mb-4 bg-neutral-100 text-neutral-600" style={{ fontWeight: 600 }}>
            {q.dimension}
          </span>
          <h2 className="text-neutral-900 mb-7 leading-snug" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{q.text}</h2>

          <div className="space-y-2.5">
            {LIKERT.map(opt => {
              const isSel = selected === opt.value;
              const accent = '#0a0a0a';
              return (
                <motion.button key={opt.value} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.value }))}
                  className="w-full text-left px-5 py-3.5 rounded-2xl border transition-all flex items-center gap-4"
                  style={{ borderColor: isSel ? accent : '#e5e7eb', background: isSel ? '#fafaf9' : '#fff' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                    style={{ background: isSel ? accent : '#f3f4f6', color: isSel ? '#fff' : '#6b7280', fontWeight: 700 }}>
                    {opt.value}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-800 text-sm" style={{ fontWeight: isSel ? 600 : 500 }}>{opt.label}</p>
                    <p className="text-neutral-400 text-xs mt-0.5">{opt.desc}</p>
                  </div>
                  {isSel && <CheckCircle2 size={16} style={{ color: accent }} className="flex-shrink-0" />}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-7 pt-6 border-t border-gray-100">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[13px] hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ fontWeight: 500 }}>
          <ChevronLeft size={15} /> Anterior
        </button>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className="rounded-full transition-all"
              style={{ width: i === step ? 18 : 7, height: 7, background: i <= step ? '#0a0a0a' : '#e5e7eb', opacity: i === step ? 1 : 0.5 }} />
          ))}
        </div>
        <motion.button
          whileHover={selected ? { scale: 1.02 } : {}} whileTap={selected ? { scale: 0.98 } : {}}
          onClick={() => isLast ? onComplete(answers) : setStep(s => s + 1)}
          disabled={!selected}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ background: '#0a0a0a', fontWeight: 600 }}>
          {isLast ? <><CheckCircle2 size={14} /> Completar</> : <>Siguiente <ChevronRight size={15} /></>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Manual entry panel
// ---------------------------------------------------------------------------
function ManualEntryPanel({
  surveyKey,
  initialText,
  onComplete,
  onBack,
}: {
  surveyKey: SurveyKey;
  initialText: string;
  onComplete: (text: string) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [attached, setAttached] = useState<{ name: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  const processFile = (file: File) => {
    const readable = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md');
    setAttached({ name: file.name, size: file.size });
    if (readable) {
      setIsReading(true);
      const r = new FileReader();
      r.onload = e => { setText(e.target?.result as string || ''); setIsReading(false); };
      r.readAsText(file, 'UTF-8');
    }
  };

  const accent = '#0a0a0a';
  const accentBg = '#f5f5f5';

  return (
    <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors">
          <ChevronLeft size={15} /> Volver al resumen
        </button>
        <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: accentBg, color: accent, fontWeight: 600 }}>
          Encuesta {surveyKey === 'agil' ? 'Ágil' : 'Predictiva'} · Carga manual
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-gray-800 mb-1" style={{ fontWeight: 600 }}>Carga de datos de encuesta</h3>
        <p className="text-gray-400 text-sm mb-5">
          Pegue los resultados recolectados o cargue un archivo (.txt, .md, .pdf, .docx). El Agente 5 procesará el texto para extraer puntuaciones y observaciones.
        </p>

        {/* File upload button */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-gray-600 text-sm" style={{ fontWeight: 500 }}>Datos / Transcripción de respuestas</label>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-all text-xs"
            style={{ fontWeight: 500 }}>
            <FileUp size={11} /> Cargar archivo
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
        </div>

        {/* Attached badge */}
        <AnimatePresence>
          {attached && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
                <Paperclip size={10} />
                <span className="flex-1 truncate" style={{ fontWeight: 500 }}>{attached.name}</span>
                <span className="opacity-60">{fmt(attached.size)}</span>
                <button onClick={() => { setAttached(null); setText(''); }}><X size={10} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dropzone textarea */}
        <div
          className={`relative rounded-xl border-2 transition-all mb-2 ${isDragging ? 'border-neutral-400 bg-neutral-50' : 'border-neutral-200/80'}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
        >
          {isReading && (
            <div className="absolute inset-0 z-10 bg-white/90 rounded-xl flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-gray-400" />
              <span className="text-gray-400 text-xs">Leyendo archivo…</span>
            </div>
          )}
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={`Pegue aquí los datos de la encuesta de madurez ${surveyKey === 'agil' ? 'Ágil' : 'Predictiva'}...\n\nEj:\nDimensión Iteraciones: 3/5\nDimensión Mejora: 2/5\n...`}
            rows={10} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y leading-relaxed bg-transparent border-0 focus:ring-0" />
        </div>
        <p className="text-gray-400 text-xs text-right mb-5">{text.length} caracteres</p>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => { if (!text.trim()) { toast.error('Ingrese datos antes de continuar.'); return; } onComplete(text); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm"
          style={{ background: accent, fontWeight: 600 }}>
          <CheckCircle2 size={15} />
          Guardar y marcar encuesta como completada
        </motion.button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Survey card (overview)
// ---------------------------------------------------------------------------
function SurveyCard({
  surveyKey,
  status,
  onOnline,
  onManual,
}: {
  surveyKey: SurveyKey;
  status: boolean;
  onOnline: () => void;
  onManual: () => void;
}) {
  const isAgil = surveyKey === 'agil';
  const accent = '#0a0a0a';
  const bg = '#f5f5f5';
  const Icon = ClipboardList;
  const label = isAgil ? 'Ágil' : 'Predictiva';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${status ? 'border-emerald-200 bg-emerald-50/20' : 'border-neutral-200/80'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon size={20} style={{ color: accent }} />
        </div>
        <div className="flex-1">
          <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Encuesta de Madurez {label}</p>
          <p className="text-gray-400 text-xs">{QUESTIONS_PREDICTIVA.length} preguntas · Escala Likert 1–5</p>
        </div>
        {status
          ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span className="text-emerald-700 text-xs" style={{ fontWeight: 600 }}>Completada</span>
            </div>
          : <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
              <AlertCircle size={12} className="text-gray-400" />
              <span className="text-gray-500 text-xs" style={{ fontWeight: 600 }}>Pendiente</span>
            </div>
        }
      </div>

      {!status ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onOnline}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-neutral-200/80 text-sm transition-all hover:bg-neutral-50"
            style={{ color: '#0a0a0a', fontWeight: 500 }}>
            <Globe size={14} /> Completar en línea
          </button>
          <button onClick={onManual}
            className="flex items-center justify-center gap-2 py-2.5 rounded-full border border-neutral-200/80 text-neutral-600 text-[13px] hover:bg-neutral-50 transition-all"
            style={{ fontWeight: 500 }}>
            <ClipboardEdit size={14} /> Cargar datos
          </button>
        </div>
      ) : (
        <button onClick={onOnline}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-neutral-200/80 text-neutral-400 text-[12px] hover:bg-neutral-50 transition-all"
          style={{ fontWeight: 500 }}>
          <RefreshCw size={11} /> Volver a responder
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version badge + Approve modal (shared pattern from Phase 4)
// ---------------------------------------------------------------------------
function VersionBadge({ version, timestamp }: { version: DiagnosisVersion; timestamp: string }) {
  const ts = new Date(timestamp);
  const fmt = ts.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${version === 'reprocesado' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`} style={{ fontWeight: 500 }}>
      {version === 'reprocesado' ? <RefreshCw size={10} /> : <Sparkles size={10} />}
      Diagnóstico {version === 'reprocesado' ? 'reprocesado' : 'original'}
      <span className="opacity-50">·</span>
      <Clock size={10} />{fmt}
    </div>
  );
}

function ApproveModal({ open, onCancel, onConfirm, isLoading }: { open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <ThumbsUp size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Aprobar diagnóstico de madurez</h3>
                <p className="text-gray-500 text-sm leading-relaxed">La Fase 5 quedará <strong>completada</strong> y la Fase 6 se desbloqueará automáticamente. Esta acción no puede deshacerse.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[13px] hover:bg-neutral-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                {isLoading ? <><Loader2 size={14} className="animate-spin" /> Aprobando…</> : <><ThumbsUp size={14} /> Aprobar</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Single maturity result card
// ---------------------------------------------------------------------------
function MaturityResultCard({ surveyKey, result, pmoType }: { surveyKey: SurveyKey; result: MaturityResult; pmoType: PmoType }) {
  const ml = MATURITY_LEVELS[result.level - 1];
  const isAgil = surveyKey === 'agil';
  const accent = '#0a0a0a';
  const Icon = ClipboardList;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 shadow-sm overflow-hidden">
      {/* Level header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
            <Icon size={16} style={{ color: accent }} />
          </div>
          <p className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>
            Madurez {isAgil ? 'Ágil' : 'Predictiva'}
          </p>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Nivel de madurez</p>
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: ml.color, lineHeight: 1 }}>{result.level}</span>
              <span className="text-gray-400 text-sm">/5</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs" style={{ background: ml.bg, color: ml.color, fontWeight: 700 }}>{ml.name}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Puntuación</span><span style={{ fontWeight: 600, color: ml.color }}>{result.score}/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: ml.color }}
                initial={{ width: 0 }} animate={{ width: `${result.score}%` }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }} />
            </div>
          </div>
        </div>
        <MaturityLevelBar level={result.level} />
        <p className="text-gray-500 text-xs mt-3 leading-relaxed">{ml.desc}</p>
      </div>
      {/* Gaps */}
      <div className="p-5 border-b border-gray-100">
        <p className="text-xs uppercase tracking-wider text-gray-400 mb-3" style={{ fontWeight: 700 }}>Brechas identificadas</p>
        <ul className="space-y-2">
          {result.gaps.map((g, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: ml.color }} />
              {g}
            </li>
          ))}
        </ul>
      </div>
      {/* Recommendations */}
      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-gray-400 mb-3" style={{ fontWeight: 700 }}>Recomendaciones</p>
        <ul className="space-y-2">
          {result.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white mt-0.5" style={{ background: accent, fontSize: '0.6rem', fontWeight: 700 }}>{i + 1}</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Module
// ---------------------------------------------------------------------------
export default function MadurezModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();
  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 5);
  const phase4 = project?.phases.find(p => p.number === 4);

  // Determine PMO type from Phase 4 result
  const pmoType: PmoType = parsePmoType(phase4?.agentData);
  const needsAgil = pmoType === 'Ágil' || pmoType === 'Híbrida';
  const needsPredictiva = pmoType === 'Predictiva' || pmoType === 'Híbrida';

  const initView = (): ModuleView => {
    if (!phase) return 'overview';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    return 'overview';
  };

  const [view, setView] = useState<ModuleView>(initView);
  const [activeSurvey, setActiveSurvey] = useState<{ key: SurveyKey; method: EntryMethod } | null>(null);

  const [surveys, setSurveys] = useState<Record<SurveyKey, SurveyState>>({
    agil:       { completed: false, method: null, answers: {}, manualText: '', attachedFile: null },
    predictiva: { completed: false, method: null, answers: {}, manualText: '', attachedFile: null },
  });

  const [results, setResults] = useState<FullResults | null>(
    phase?.status === 'completado' ? buildMockResults(pmoType) : null
  );
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Simulate agent processing on entering processing view
  const processingStarted = useRef(false);
  if (view === 'processing' && !processingStarted.current) {
    processingStarted.current = true;
    setTimeout(() => {
      const r = buildMockResults(pmoType);
      setResults(r);
      setView('results');
      playAgentSuccess(); // Agent_Success: Agente 5 terminó, resultados listos para revisión
      toast.success('Agente 5 completó el análisis de madurez', {
        description: `Nivel general: ${MATURITY_LEVELS[r.overallLevel - 1].name} (${r.overallScore}/100)`,
      });
    }, 5000);
  }

  if (!project || !phase) return null;

  // Survey completion check
  const agilDone = !needsAgil || surveys.agil.completed;
  const predictivaDone = !needsPredictiva || surveys.predictiva.completed;
  const allDone = agilDone && predictivaDone;
  const doneCount = [needsAgil && surveys.agil.completed, needsPredictiva && surveys.predictiva.completed].filter(Boolean).length;
  const totalCount = [needsAgil, needsPredictiva].filter(Boolean).length;

  // ── Handlers ──
  const completeSurvey = (key: SurveyKey, answers: Record<string, number>) => {
    setSurveys(prev => ({ ...prev, [key]: { ...prev[key], completed: true, method: 'online', answers } }));
    setActiveSurvey(null);
    setView('overview');
    toast.success(`Encuesta ${key === 'agil' ? 'Ágil' : 'Predictiva'} completada`);
  };

  const completeManual = (key: SurveyKey, text: string) => {
    setSurveys(prev => ({ ...prev, [key]: { ...prev[key], completed: true, method: 'manual', manualText: text } }));
    setActiveSurvey(null);
    setView('overview');
    toast.success(`Datos de encuesta ${key === 'agil' ? 'Ágil' : 'Predictiva'} guardados`);
  };

  const handleSend = () => {
    // TODO: N8N_WEBHOOK_AGENTE_5
    updatePhaseStatus(projectId!, 5, 'procesando');
    processingStarted.current = false;
    setView('processing');
  };

  const handleSaveComment = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario antes de guardar.'); return; }
    setIsSavingComment(true);
    await new Promise(r => setTimeout(r, 500));
    setSavedComment(comment);
    setIsSavingComment(false);
    toast.success('Comentario guardado');
  };

  const handleReprocess = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario para re-procesar.'); return; }
    setIsReprocessing(true);
    setView('processing');
    processingStarted.current = false;
    await new Promise(r => setTimeout(r, 4000));
    const updated = buildMockResults(pmoType, comment);
    setResults(updated);
    setSavedComment(comment);
    setComment('');
    setView('results');
    setIsReprocessing(false);
    playAgentSuccess(); // Agent_Success: reprocesado listo para revisión
    toast.success('Diagnóstico reprocesado con su comentario');
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsApproving(false);
    setShowApproveModal(false);
    updatePhaseStatus(projectId!, 5, 'completado',
      `Madurez PMO ${pmoType} · Nivel ${results?.overallLevel ?? 2} (${MATURITY_LEVELS[(results?.overallLevel ?? 2) - 1].name}) · Score ${results?.overallScore ?? 0}/100. ${results?.summary?.slice(0, 120)}…`
    );
    playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
    setView('approved');
    toast.success('¡Fase 5 aprobada!', { description: 'La Fase 6 se ha desbloqueado automáticamente.' });
  };

  // ── PMO type config ──
  const pmoCfg = PMO_CONFIG[pmoType];
  const { Icon: PmoIcon } = pmoCfg;

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={5}
        phaseName="Madurez de la PMO"
        eyebrow={`PMO ${pmoType}`}
        rightSlot={(
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px]"
            style={{ borderColor: pmoCfg.color, color: pmoCfg.color, background: `${pmoCfg.color}10`, fontWeight: 500 }}>
            <PmoIcon size={11} /> PMO {pmoType}
          </div>
        )}
      />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">

          {/* ── Overview ── */}
          {view === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · Madurez de la PMO</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Evaluación de madurez {pmoType}
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  Según la clasificación de la Fase 4, su organización tendrá una <span className="text-neutral-900" style={{ fontWeight: 500 }}>PMO {pmoType}</span>. Complete {totalCount === 2 ? 'ambas encuestas' : 'la encuesta'} para que el Agente 5 procese el diagnóstico de madurez.
                </p>

                <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Tipo de PMO</p>
                    <p className="mt-1.5 text-neutral-900" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {pmoType}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Encuestas</p>
                    <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {doneCount}<span className="text-[12px] text-neutral-400 ml-1">/ {totalCount}</span>
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Estado</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                        {allDone ? 'Listo para enviar' : 'En curso'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Survey cards — 2 col for Híbrida, 1 col otherwise */}
              <div className={`grid gap-5 mb-6 ${pmoType === 'Híbrida' ? 'grid-cols-2' : 'grid-cols-1 max-w-xl'}`}>
                {needsPredictiva && (
                  <SurveyCard surveyKey="predictiva" status={surveys.predictiva.completed}
                    onOnline={() => { setActiveSurvey({ key: 'predictiva', method: 'online' }); setView('online-survey' as any); }}
                    onManual={() => { setActiveSurvey({ key: 'predictiva', method: 'manual' }); setView('manual-entry' as any); }} />
                )}
                {needsAgil && (
                  <SurveyCard surveyKey="agil" status={surveys.agil.completed}
                    onOnline={() => { setActiveSurvey({ key: 'agil', method: 'online' }); setView('online-survey' as any); }}
                    onManual={() => { setActiveSurvey({ key: 'agil', method: 'manual' }); setView('manual-entry' as any); }} />
                )}
              </div>

              {/* Progress indicator (RF-F5-03) */}
              {pmoType === 'Híbrida' && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border mb-6 ${allDone ? 'bg-emerald-50/60 border-emerald-200/80' : 'bg-amber-50/60 border-amber-200/80'}`}>
                  {allDone
                    ? <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" strokeWidth={1.75} />
                    : <AlertCircle size={14} className="text-amber-600 flex-shrink-0" strokeWidth={1.75} />}
                  <p className="text-[13px]" style={{ fontWeight: 500, color: allDone ? '#047857' : '#92400e' }}>
                    {allDone
                      ? 'Ambas encuestas completadas. Listo para enviar al Agente 5.'
                      : `${doneCount} de ${totalCount} encuestas completadas — ${totalCount - doneCount} pendiente${totalCount - doneCount > 1 ? 's' : ''}`}
                  </p>
                </div>
              )}

              {/* Send to Agent 5 */}
              <div className="flex justify-end">
                <motion.button
                  whileHover={allDone ? { scale: 1.02 } : {}} whileTap={allDone ? { scale: 0.97 } : {}}
                  onClick={allDone ? handleSend : undefined}
                  disabled={!allDone}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-px"
                  style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                  <Send size={15} /> Marcar como completa y Enviar al Agente 5
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Inline survey ── */}
          {(view as string) === 'online-survey' && activeSurvey?.method === 'online' && (
            <motion.div key="online-survey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <InlineSurvey
                surveyKey={activeSurvey.key}
                initialAnswers={surveys[activeSurvey.key].answers}
                onComplete={answers => completeSurvey(activeSurvey.key, answers)}
                onBack={() => { setActiveSurvey(null); setView('overview'); }}
              />
            </motion.div>
          )}

          {/* ── Manual entry ── */}
          {(view as string) === 'manual-entry' && activeSurvey?.method === 'manual' && (
            <motion.div key="manual-entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ManualEntryPanel
                surveyKey={activeSurvey.key}
                initialText={surveys[activeSurvey.key].manualText}
                onComplete={text => completeManual(activeSurvey.key, text)}
                onBack={() => { setActiveSurvey(null); setView('overview'); }}
              />
            </motion.div>
          )}

          {/* ── Processing ── */}
          {view === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-neutral-100 flex items-center justify-center">
                  <Loader2 size={40} className="text-neutral-900 animate-spin" />
                </div>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-4 border-neutral-200 opacity-30" />
              </div>
              <h2 className="text-gray-900 mb-3" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
                {isReprocessing ? 'Re-procesando diagnóstico…' : 'Agente 5 analizando madurez'}
              </h2>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-4">
                {isReprocessing
                  ? 'El Agente 5 está incorporando el comentario del consultor y recalibrando el diagnóstico de madurez…'
                  : `Procesando las encuestas de madurez ${pmoType === 'Híbrida' ? 'Predictiva y Ágil' : pmoType} para determinar el nivel de madurez actual de la PMO…`}
              </p>
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs" style={{ fontWeight: 500 }}>Esto puede tomar unos momentos</span>
              </div>
            </motion.div>
          )}

          {/* ── Results ── */}
          {view === 'results' && results && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · PMO {pmoType}</p>
                  <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                    Diagnóstico de madurez
                  </h1>
                  <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                    El Agente 5 evaluó las dimensiones de madurez y consolidó el nivel global con recomendaciones por área.
                  </p>
                </div>
                <VersionBadge version={results.version} timestamp={results.timestamp} />
              </div>

              {/* Overall score hero */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 text-center px-4">
                    <p className="text-xs text-gray-400 mb-1">Nivel general</p>
                    <div className="flex items-baseline gap-1.5">
                      <span style={{ fontSize: '3rem', fontWeight: 900, color: MATURITY_LEVELS[results.overallLevel - 1].color, lineHeight: 1 }}>
                        {results.overallLevel}
                      </span>
                      <span className="text-gray-300 text-2xl">/5</span>
                    </div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs mt-1"
                      style={{ background: MATURITY_LEVELS[results.overallLevel - 1].bg, color: MATURITY_LEVELS[results.overallLevel - 1].color, fontWeight: 700 }}>
                      {MATURITY_LEVELS[results.overallLevel - 1].name}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">Puntuación ponderada</span>
                      <span style={{ fontWeight: 700, color: MATURITY_LEVELS[results.overallLevel - 1].color }}>{results.overallScore}/100</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                      <motion.div className="h-full rounded-full" style={{ background: MATURITY_LEVELS[results.overallLevel - 1].color }}
                        initial={{ width: 0 }} animate={{ width: `${results.overallScore}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                    </div>
                    <MaturityLevelBar level={results.overallLevel} />
                  </div>
                  <div className="flex-shrink-0 max-w-xs">
                    <p className="text-gray-600 text-sm leading-relaxed">{results.summary}</p>
                  </div>
                </div>
              </div>

              {/* Per-survey results */}
              <div className={`grid gap-5 mb-5 ${pmoType === 'Híbrida' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {results.predictiva && (
                  <MaturityResultCard surveyKey="predictiva" result={results.predictiva} pmoType={pmoType} />
                )}
                {results.agil && (
                  <MaturityResultCard surveyKey="agil" result={results.agil} pmoType={pmoType} />
                )}
              </div>

              {/* RF-F5-06: Comments */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare size={15} className="text-gray-500" />
                  <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Comentarios del consultor</h3>
                </div>
                <p className="text-gray-400 text-xs mb-3">
                  Agregue observaciones o contexto adicional. Puede guardar el comentario o re-procesar el diagnóstico incorporándolo.
                </p>
                {savedComment && (
                  <div className="mb-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 text-[13px] text-neutral-600">
                    <p className="text-gray-400 text-xs mb-1" style={{ fontWeight: 600 }}>Último comentario guardado</p>
                    <p className="leading-relaxed">{savedComment}</p>
                  </div>
                )}
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Ej: El área de manufactura tiene un nivel de madurez distinto al resto de la organización. Sus procesos predictivos están más avanzados debido a la regulación ISO aplicable..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed bg-white mb-3" />
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveComment} disabled={isSavingComment || !comment.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    style={{ fontWeight: 500 }}>
                    {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar comentario
                  </button>
                  <button onClick={handleReprocess} disabled={!comment.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-80"
                    style={{ borderColor: pmoCfg.color, color: pmoCfg.color, background: `${pmoCfg.color}10`, fontWeight: 500 }}>
                    <RefreshCw size={13} /> Re-procesar con comentario
                  </button>
                  <div className="flex-1" />
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowApproveModal(true)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
                    style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                    <ThumbsUp size={14} /> Aprobar diagnóstico de madurez
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Approved ── */}
          {view === 'approved' && results && (
            <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · PMO {pmoType}</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Diagnóstico aprobado
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  El nivel de madurez ha sido validado y registrado como referencia para la guía metodológica.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-emerald-700 text-[12px]" style={{ fontWeight: 500 }}>
                  <CheckCircle2 size={13} /> Fase completada y aprobada
                </span>
              </div>

              {/* Overall score */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 text-center px-4">
                    <p className="text-xs text-gray-400 mb-1">Nivel aprobado</p>
                    <span style={{ fontSize: '3rem', fontWeight: 900, color: MATURITY_LEVELS[results.overallLevel - 1].color, lineHeight: 1 }}>{results.overallLevel}</span>
                    <p className="text-xs mt-1" style={{ color: MATURITY_LEVELS[results.overallLevel - 1].color, fontWeight: 700 }}>
                      {MATURITY_LEVELS[results.overallLevel - 1].name}
                    </p>
                  </div>
                  <div className="flex-1">
                    <MaturityLevelBar level={results.overallLevel} />
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-gray-400 text-xs">Score ponderado</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: MATURITY_LEVELS[results.overallLevel - 1].color }}>{results.overallScore}/100</p>
                    {phase.completedAt && (
                      <p className="text-gray-400 text-xs mt-1 flex items-center gap-1 justify-end">
                        <CheckCircle2 size={10} className="text-green-500" /> Aprobado el {phase.completedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className={`grid gap-5 ${pmoType === 'Híbrida' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {results.predictiva && <MaturityResultCard surveyKey="predictiva" result={results.predictiva} pmoType={pmoType} />}
                {results.agil && <MaturityResultCard surveyKey="agil" result={results.agil} pmoType={pmoType} />}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Approve modal (RF-F5-07) */}
      <ApproveModal
        open={showApproveModal}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        isLoading={isApproving}
      />

      <NextPhaseButton projectId={projectId!} nextPhase={6} prevPhase={4} show={view === 'approved'} />
    </div>
  );
}
