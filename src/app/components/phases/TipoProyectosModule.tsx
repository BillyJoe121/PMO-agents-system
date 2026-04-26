/**
 * TipoProyectosModule — Fase 4: Clasificación de Proyectos / Tipo de PMO
 *
 * RF-F4-01  Se desbloquea automáticamente al completarse Fases 1, 2 y 3 (lógica en AppContext).
 * RF-F4-02  Al desbloquearse, el módulo auto-dispara el envío al Agente 4 sin acción del consultor.
 * RF-F4-03  Mientras procesa, muestra spinner en módulo y en la tarjeta del dashboard.
 * RF-F4-04  Vista del diagnóstico: tipo PMO con tarjeta destacada, justificación, confianza.
 * RF-F4-05  Sección de comentarios: Guardar / Re-procesar con comentario.
 * RF-F4-06  Indicador claro de versión (original / reprocesado) con fecha y hora.
 * RF-F4-07  Botón "Aprobar diagnóstico" → marca Fase 4 completada y desbloquea Fase 5.
 *
 * TODO: RF-F4-02 → axios.post(N8N_WEBHOOK_AGENTE_4, { consolidado_agentes_1_2_3 })
 * TODO: RF-F4-05 → guardar comentario en tabla 'consultor_comentarios' (Supabase)
 * TODO: RF-F4-05 → axios.post(N8N_WEBHOOK_AGENTE_4, { diagnostico_original, comentario_consultor })
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Loader2, CheckCircle2, Brain, Zap, GitMerge, BarChart2,
  MessageSquare, Save, RefreshCw, ThumbsUp, AlertTriangle, Send,
  Clock, Sparkles, ChevronRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useSoundManager } from '../../hooks/useSoundManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type DiagnosisVersion = 'original' | 'reprocesado';
type ModuleView = 'auto-trigger' | 'processing' | 'diagnosis' | 'approved';

interface DiagnosisResult {
  pmoType: PmoType;
  confidence: number;
  justification: string;
  keyFactors: string[];
  recommendation: string;
  timestamp: string;
  version: DiagnosisVersion;
}

// ---------------------------------------------------------------------------
// Config por tipo de PMO
// ---------------------------------------------------------------------------
const PMO_CONFIG: Record<PmoType, {
  color: string; bg: string; border: string; lightText: string;
  Icon: React.ElementType; tagline: string;
}> = {
  Ágil: {
    color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', lightText: '#065f46',
    Icon: Zap,
    tagline: 'Estructura flexible orientada a ciclos iterativos y entrega continua de valor.',
  },
  Híbrida: {
    color: '#4f46e5', bg: '#eef2ff', border: '#a5b4fc', lightText: '#3730a3',
    Icon: GitMerge,
    tagline: 'Combina prácticas ágiles y predictivas según el contexto y naturaleza de cada proyecto.',
  },
  Predictiva: {
    color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', lightText: '#5b21b6',
    Icon: BarChart2,
    tagline: 'Gestión secuencial con planificación detallada y control formal de cambios.',
  },
};

// ---------------------------------------------------------------------------
// Mock diagnosis data (Agente 4 response)
// ---------------------------------------------------------------------------
const MOCK_ORIGINAL: DiagnosisResult = {
  pmoType: 'Híbrida',
  confidence: 87,
  justification:
    'El análisis consolidado de los tres agentes previos revela una organización con procesos parcialmente estandarizados y equipos con distintos niveles de madurez metodológica. Se identificaron proyectos de alto nivel de incertidumbre (candidatos a marcos ágiles) coexistiendo con proyectos de infraestructura y regulatorios que requieren control predictivo estricto. Esta dualidad, junto con la estructura de gobernanza existente, favorece una PMO de tipo Híbrida que permita aplicar marcos adaptativos o secuenciales según la naturaleza de cada iniciativa.',
  keyFactors: [
    'El 60% de los proyectos activos presentan requisitos cambiantes o alta incertidumbre.',
    'Existe una PMO informal con artefactos de control predictivo (cronogramas, actas).',
    'Los equipos de TI ya aplican Scrum; otras áreas utilizan metodologías secuenciales.',
    'La alta dirección demanda visibilidad y control de alcance (predictivo), pero valora la velocidad ágil.',
    'La regulación sectorial exige trazabilidad documental compatible con marcos predictivos.',
  ],
  recommendation:
    'Implementar una PMO Híbrida en tres fases: (1) Estandarizar el marco de decisión metodológica, (2) Definir el portafolio de proyectos por cuadrante ágil/predictivo, (3) Capacitar a los líderes en gestión adaptativa.',
  timestamp: new Date().toISOString(),
  version: 'original',
};

function buildReprocessedDiagnosis(comment: string): DiagnosisResult {
  return {
    ...MOCK_ORIGINAL,
    justification:
      `[Diagnóstico reprocesado incorporando observación del consultor]\n\n${MOCK_ORIGINAL.justification}\n\nContexto adicional del consultor: "${comment.trim()}"\n\nTras evaluar el contexto adicional provisto, el Agente 4 confirma la clasificación Híbrida con ajuste en el nivel de confianza. Se incorpora la perspectiva del consultor como variable cualitativa en el modelo de clasificación.`,
    confidence: 91,
    timestamp: new Date().toISOString(),
    version: 'reprocesado',
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Tarjeta hero del tipo de PMO (RF-F4-04) */
function PmoTypeCard({ diagnosis }: { diagnosis: DiagnosisResult }) {
  const cfg = PMO_CONFIG[diagnosis.pmoType];
  const { Icon } = cfg;
  const pct = diagnosis.confidence;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 p-6 mb-6"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
        {/* Icon + type */}
        <div className="flex items-center gap-4 flex-1">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: cfg.color }}
          >
            <Icon size={30} className="text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: cfg.color, fontWeight: 700 }}>
              Tipo de PMO detectado
            </p>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: cfg.lightText, lineHeight: 1.1 }}>
              PMO {diagnosis.pmoType}
            </h2>
            <p className="text-sm mt-1" style={{ color: cfg.lightText, opacity: 0.75 }}>
              {cfg.tagline}
            </p>
          </div>
        </div>

        {/* Confidence */}
        <div
          className="flex-shrink-0 rounded-xl p-4 min-w-[140px]"
          style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${cfg.border}` }}
        >
          <p className="text-xs mb-2" style={{ color: cfg.lightText, fontWeight: 600 }}>
            Nivel de confianza
          </p>
          <div className="flex items-end gap-1 mb-2">
            <span style={{ fontSize: '2rem', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{pct}</span>
            <span className="text-sm mb-0.5" style={{ color: cfg.color, fontWeight: 600 }}>%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: `${cfg.color}30` }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: cfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: cfg.lightText, opacity: 0.7 }}>
            {pct >= 85 ? 'Alta certeza' : pct >= 70 ? 'Certeza media' : 'Certeza baja'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/** Indicador de versión del diagnóstico (RF-F4-06) */
function VersionBadge({ diagnosis }: { diagnosis: DiagnosisResult }) {
  const ts = new Date(diagnosis.timestamp);
  const formatted = ts.toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${
      diagnosis.version === 'reprocesado'
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-gray-100 border-gray-200 text-gray-500'
    }`} style={{ fontWeight: 500 }}>
      {diagnosis.version === 'reprocesado' ? <RefreshCw size={11} /> : <Sparkles size={11} />}
      Diagnóstico {diagnosis.version === 'reprocesado' ? 'reprocesado' : 'original'}
      <span className="opacity-60">·</span>
      <Clock size={10} />
      {formatted}
    </div>
  );
}

/** Modal de confirmación de aprobación (RF-F4-07) */
function ApproveModal({ open, onCancel, onConfirm, isLoading }: {
  open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <ThumbsUp size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Aprobar diagnóstico</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Al aprobar, la Fase 4 quedará <strong>completada</strong> y la Fase 5 se desbloqueará automáticamente.
                  Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                style={{ background: '#030213', fontWeight: 600 }}>
                {isLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Aprobando...</>
                  : <><ThumbsUp size={14} /> Aprobar diagnóstico</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function TipoProyectosModule() {
  // useParams() extrae :id y :phaseNum desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();
  const { playAgentSuccess, playProcessError, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 4);

  // Derive initial view from phase status
  const deriveInitialView = (): ModuleView => {
    if (!phase) return 'processing';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    // 'disponible' → auto-trigger
    return 'auto-trigger';
  };

  const [view, setView] = useState<ModuleView>(deriveInitialView);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(
    phase?.status === 'completado' ? MOCK_ORIGINAL : null
  );
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const autoTriggered = useRef(false);

  // RF-F4-02: Auto-trigger on mount when disponible
  useEffect(() => {
    if (autoTriggered.current) return;
    if (view === 'auto-trigger') {
      autoTriggered.current = true;
      // Show auto-trigger animation for 2s, then transition to processing
      const t1 = setTimeout(() => {
        updatePhaseStatus(projectId!, 4, 'procesando');
        setView('processing');
      }, 2200);
      return () => clearTimeout(t1);
    }
  }, [view]);

  // RF-F4-03: While processing, simulate agent response (~5s)
  useEffect(() => {
    if (view !== 'processing') return;
    const t = setTimeout(() => {
      const result = { ...MOCK_ORIGINAL, timestamp: new Date().toISOString() };
      setDiagnosis(result);
      setView('diagnosis');
      playAgentSuccess(); // Agent_Success: agente terminó, diagnóstico listo para revisión
      toast.success('Agente 4 completó el diagnóstico', {
        description: `Tipo de PMO detectado: ${result.pmoType} (${result.confidence}% confianza)`,
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [view, playAgentSuccess]);

  if (!project || !phase) return null;

  // ── Handlers ──

  const handleSaveComment = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario antes de guardar.'); return; }
    setIsSavingComment(true);
    // TODO: supabase.from('consultor_comentarios').insert({ proyecto_id, fase: 4, comentario: comment })
    await new Promise(r => setTimeout(r, 600));
    setSavedComment(comment);
    setIsSavingComment(false);
    toast.success('Comentario guardado', { description: 'El comentario quedará asociado al diagnóstico.' });
  };

  const handleReprocess = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario para re-procesar.'); return; }
    setIsReprocessing(true);
    setView('processing');
    // TODO: axios.post(N8N_WEBHOOK_AGENTE_4, { diagnostico_original: diagnosis, comentario: comment })
    await new Promise(r => setTimeout(r, 4000));
    const updated = buildReprocessedDiagnosis(comment);
    setDiagnosis(updated);
    setComment('');
    setSavedComment(comment);
    setView('diagnosis');
    setIsReprocessing(false);
    playAgentSuccess(); // Agent_Success: reprocesado listo para revisión
    toast.success('Diagnóstico reprocesado', { description: 'El Agente 4 incorporó su comentario.' });
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise(r => setTimeout(r, 700));
    setIsApproving(false);
    setShowApproveModal(false);
    // RF-F4-07: marca Fase 4 completada → computePhaseAvailability desbloquea Fase 5
    updatePhaseStatus(
      projectId!, 4, 'completado',
      `PMO ${diagnosis?.pmoType} · Confianza ${diagnosis?.confidence}% · ${diagnosis?.version === 'reprocesado' ? 'Diagnóstico reprocesado' : 'Diagnóstico original'}. ${diagnosis?.recommendation}`
    );
    playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
    setView('approved');
    toast.success('¡Fase 4 aprobada!', { description: 'La Fase 5 se ha desbloqueado automáticamente.' });
  };

  // ── Render helpers ──

  const renderAutoTrigger = () => (
    <motion.div key="auto-trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
        style={{ background: '#030213' }}
      >
        <Send size={34} className="text-white" />
      </motion.div>
      <h2 className="text-gray-900 mb-3" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
        Enviando al Agente 4
      </h2>
      <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-6">
        Las Fases 1, 2 y 3 están completas. El sistema está consolidando automáticamente los resultados de los Agentes 1, 2 y 3 y enviándolos al Agente 4 para la clasificación del tipo de PMO.
      </p>
      {/* Pipeline visual */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.2 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs"
              style={{ background: '#030213', fontWeight: 600 }}
            >
              <CheckCircle2 size={12} />
              Agente {n}
            </motion.div>
            <ChevronRight size={14} className="text-gray-300" />
          </div>
        ))}
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border-2 border-dashed"
          style={{ borderColor: '#4f46e5', color: '#4f46e5', fontWeight: 600 }}
        >
          <Brain size={12} />
          Agente 4
        </motion.div>
      </div>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <Loader2 size={13} className="animate-spin" />
        Iniciando procesamiento…
      </div>
    </motion.div>
  );

  const renderProcessing = () => (
    <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full border-4 border-indigo-100 flex items-center justify-center">
          <Loader2 size={40} className="text-indigo-500 animate-spin" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-full border-4 border-indigo-200 opacity-30"
        />
      </div>
      <h2 className="text-gray-900 mb-3" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
        Agente 4 clasificando el tipo de PMO
      </h2>
      <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-4">
        {isReprocessing
          ? 'El Agente 4 está incorporando el comentario del consultor y regenerando el diagnóstico…'
          : 'Analizando el consolidado de los tres agentes previos para determinar el tipo de PMO más adecuado…'}
      </p>
      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
        <Loader2 size={13} className="animate-spin" />
        <span className="text-xs" style={{ fontWeight: 500 }}>Esto puede tomar unos momentos</span>
      </div>
    </motion.div>
  );

  const renderDiagnosis = () => {
    if (!diagnosis) return null;
    const cfg = PMO_CONFIG[diagnosis.pmoType];

    return (
      <motion.div key="diagnosis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Version badge (RF-F4-06) */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
              Diagnóstico de Clasificación
            </h1>
          </div>
          <VersionBadge diagnosis={diagnosis} />
        </div>

        {/* PMO type hero (RF-F4-04) */}
        <PmoTypeCard diagnosis={diagnosis} />

        {/* 2-col: Justification + Key factors */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Justification */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: cfg.bg }}>
                <Brain size={13} style={{ color: cfg.color }} />
              </div>
              <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Justificación del Agente 4</h3>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {diagnosis.justification}
            </p>
          </div>

          {/* Key factors + recommendation */}
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: cfg.bg }}>
                  <Info size={13} style={{ color: cfg.color }} />
                </div>
                <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Factores determinantes</h3>
              </div>
              <ul className="space-y-2">
                {diagnosis.keyFactors.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>{i + 1}</span>
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: cfg.border, background: cfg.bg }}>
              <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: cfg.color, fontWeight: 700 }}>
                Recomendación
              </p>
              <p className="text-sm leading-relaxed" style={{ color: cfg.lightText }}>
                {diagnosis.recommendation}
              </p>
            </div>
          </div>
        </div>

        {/* RF-F4-05: Consultant comments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={15} className="text-gray-500" />
            <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Comentarios del consultor</h3>
          </div>
          <p className="text-gray-400 text-xs mb-3">
            Agregue observaciones, contexto o ajustes al diagnóstico. Puede guardar el comentario o re-procesar el diagnóstico incorporándolo.
          </p>

          {savedComment && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
              <p className="text-gray-400 text-xs mb-1" style={{ fontWeight: 600 }}>Último comentario guardado</p>
              <p className="leading-relaxed">{savedComment}</p>
            </div>
          )}

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Ej: Considerando que el área de manufactura opera con proyectos de alta regulación, se sugiere reforzar el componente predictivo para esas unidades de negocio específicas..."
            rows={4}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed bg-white mb-3"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveComment}
              disabled={isSavingComment || !comment.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ fontWeight: 500 }}
            >
              {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar comentario
            </button>
            <button
              onClick={handleReprocess}
              disabled={isReprocessing || !comment.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-80"
              style={{ borderColor: cfg.color, color: cfg.color, background: cfg.bg, fontWeight: 500 }}
            >
              <RefreshCw size={13} />
              Re-procesar con comentario
            </button>
            <div className="flex-1" />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowApproveModal(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
              style={{ background: '#030213', fontWeight: 600 }}
            >
              <ThumbsUp size={14} />
              Aprobar diagnóstico
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderApproved = () => (
    <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 size={18} className="text-green-500" />
        <span className="text-green-600 text-sm" style={{ fontWeight: 600 }}>Fase 4 completada y aprobada</span>
      </div>
      <h1 className="text-gray-900 mb-6" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
        Diagnóstico de Clasificación
      </h1>

      <PmoTypeCard diagnosis={diagnosis ?? MOCK_ORIGINAL} />

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-gray-400" />
            <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Justificación</h3>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
            {(diagnosis ?? MOCK_ORIGINAL).justification}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-gray-400" />
            <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Factores determinantes</h3>
          </div>
          <ul className="space-y-2">
            {(diagnosis ?? MOCK_ORIGINAL).keyFactors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-gray-400" />
                {f}
              </li>
            ))}
          </ul>
          {phase.completedAt && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-gray-400 text-xs">
              <CheckCircle2 size={11} className="text-green-500" />
              Aprobado el {phase.completedAt}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  // ── Layout ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              {project.companyName}
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs"
                style={{ background: '#030213', fontWeight: 700 }}>4</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Clasificación de Proyectos</span>
            </div>
          </div>
          <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'auto-trigger' && renderAutoTrigger()}
          {view === 'processing' && renderProcessing()}
          {view === 'diagnosis' && renderDiagnosis()}
          {view === 'approved' && renderApproved()}
        </AnimatePresence>
      </div>

      {/* RF-F4-07: Approve confirm modal */}
      <ApproveModal
        open={showApproveModal}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        isLoading={isApproving}
      />
    </div>
  );
}