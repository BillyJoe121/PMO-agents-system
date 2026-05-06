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

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, CheckCircle2, Brain, Zap, GitMerge, BarChart2,
  MessageSquare, Save, RefreshCw, ThumbsUp, AlertTriangle, Send,
  Clock, Sparkles, ChevronRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { useSoundManager } from '../../hooks/useSoundManager';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { normalizeIdoneidadDiagnosisItems, getIdoneidadItemCode, getIdoneidadItemScore, inferIdoneidadDimension } from './IdoneidadModule';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type DiagnosisVersion = 'original' | 'reprocesado';
type ModuleView = 'auto-trigger' | 'processing' | 'diagnosis' | 'approved' | 'error';

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
    color: '#171717', bg: '#f5f5f5', border: '#e5e5e5', lightText: '#404040',
    Icon: Zap,
    tagline: 'Estructura flexible orientada a ciclos iterativos y entrega continua de valor.',
  },
  Híbrida: {
    color: '#404040', bg: '#fcfcfc', border: '#e5e5e5', lightText: '#525252',
    Icon: GitMerge,
    tagline: 'Combina prácticas ágiles y predictivas según el contexto y naturaleza de cada proyecto.',
  },
  Predictiva: {
    color: '#525252', bg: '#ffffff', border: '#d4d4d4', lightText: '#737373',
    Icon: BarChart2,
    tagline: 'Gestión secuencial con planificación detallada y control formal de cambios.',
  },
};

// Eliminado MOCK_ORIGINAL y buildReprocessedDiagnosis

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
            {diagnosis.confidence_label || (pct >= 85 ? 'Alta certeza' : pct >= 70 ? 'Certeza media' : 'Certeza baja')}
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
        ? 'bg-neutral-800 border-neutral-800 text-white'
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
            <div className="mb-5">
              <h3 className="text-neutral-900 mb-1.5" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>¿Aprobar este diagnóstico?</h3>
              <p className="text-neutral-500 text-[13px] leading-relaxed">
                La Fase 4 quedará completada y la Fase 5 se desbloqueará automáticamente. Esta acción no puede deshacerse.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[13px] hover:bg-neutral-50 transition-colors"
                style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                {isLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Aprobando…</>
                  : 'Aprobar diagnóstico'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Helper: parse diagnosis payload from DB into component state
// ---------------------------------------------------------------------------
function parseDiagnosisPayload(data: any): any | null {
  if (!data) return null;
  const payload = data;
  const diag = payload.diagnosis || payload;
  if (!diag.pmo_type && !diag.pmoType) return null;

  let rawType = String(diag.pmo_type || diag.pmoType || 'Híbrido').toLowerCase();
  let mappedType: PmoType = 'Híbrida';
  if (rawType.includes('agil') || rawType.includes('ágil')) {
    mappedType = 'Ágil';
  } else if (rawType.includes('predictiv')) {
    mappedType = 'Predictiva';
  }

  return {
    pmoType: mappedType,
    confidence: diag.confidence_level || 0,
    confidence_label: diag.confidence_label,
    justification: diag.justification || '',
    keyFactors: diag.supporting_evidence || [],
    tensiones: diag.tensiones || [],
    type_breakdown: diag.type_breakdown,
    orientaciones_por_fuente: diag.orientaciones_por_fuente,
    coherencia: diag.coherencia,
    advertencias_de_entrada: diag.advertencias_de_entrada || [],
    timestamp: payload.metadata?.timestamp || new Date().toISOString(),
    version: (payload.metadata?.iteration || 1) > 1 ? 'reprocesado' as DiagnosisVersion : 'original' as DiagnosisVersion,
    iteration: payload.metadata?.iteration || 1,
    estado_integracion: diag.estado_integracion,
  };
}

// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function TipoProyectosModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase } = useApp();
  const { playAgentSuccess, playProcessError, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 4);
  const phase3 = project?.phases.find(p => p.number === 3);

  const radarData = useMemo(() => {
    const diagnosisFase3 = phase3?.agentData?.diagnosis || phase3?.agentData;
    if (!diagnosisFase3) return [];
    
    const items = normalizeIdoneidadDiagnosisItems(diagnosisFase3);
    
    if (items.length === 0 && diagnosisFase3.indicadores) {
      return Object.entries(diagnosisFase3.indicadores).filter(([key]) => key !== 'general').map(([key, data]: [string, any]) => {
        const label = key === 'cultura' ? 'CULTURA (Promedio)' : 
                      key === 'equipo' ? 'EQUIPO (Promedio)' : 
                      key === 'proyecto' ? 'PROYECTO (Promedio)' : key.toUpperCase();
        return {
          subject: label,
          fullLabel: `Dimensión General: ${key}`,
          dimension: key,
          Puntaje: typeof data.promedio === 'number' ? Number(data.promedio.toFixed(1)) : 0,
          AgileZone: 4,
          HybridZone: 8,
          PredictiveZone: 10,
        };
      });
    }

    return items.map((res: any) => {
      const itemLabel = getIdoneidadItemCode(res);
      const score = getIdoneidadItemScore(res) ?? 0;

      return {
        subject: itemLabel,
        fullLabel: itemLabel,
        dimension: res.dimension ?? inferIdoneidadDimension(itemLabel),
        Puntaje: score,
        AgileZone: 4,
        HybridZone: 8,
        PredictiveZone: 10,
      };
    });
  }, [phase3?.agentData]);

  const emptyValue = 'N/A';
  const valueOrEmpty = (value: unknown) => {
    if (value === null || value === undefined || value === '') return emptyValue;
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    return String(value);
  };

  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-neutral-200/80 p-3.5 rounded-xl" style={{ boxShadow: '0 4px 24px -6px rgba(0,0,0,0.12)' }}>
          <div className="mb-2.5 pb-2 border-b border-neutral-100">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-0.5">{data.dimension}</p>
            <p className="text-[12px] text-neutral-900 leading-tight" style={{ fontWeight: 600 }}>{data.fullLabel}</p>
          </div>
          <div className="space-y-1.5">
            {payload.filter((p: any) => p.dataKey === 'Puntaje').map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <span className="text-[12px] flex items-center gap-1.5 text-neutral-600 font-medium">
                  <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                  {entry.name}
                </span>
                <span className="text-[13px] tabular-nums font-bold" style={{ color: entry.color }}>
                  {entry.value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Derive initial view from phase status
  const deriveInitialView = (): ModuleView => {
    if (!phase) return 'auto-trigger';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (phase.agentData && Object.keys(phase.agentData).length > 0) return 'diagnosis';
    return 'auto-trigger';
  };

  const [diagnosis, setDiagnosis] = useState<any>(() => {
    if (phase?.agentData) {
      return parseDiagnosisPayload(phase.agentData);
    }
    return null;
  });

  const [view, setView] = useState<ModuleView>(() => {
    const initialView = deriveInitialView();
    // If we have parsed diagnosis, force view to diagnosis or approved
    if (phase?.agentData && Object.keys(phase.agentData).length > 0) {
      return phase.status === 'completado' ? 'approved' : 'diagnosis';
    }
    return initialView;
  });

  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const autoTriggered = useRef(false);

  // ── Sync with context if it loads after initial render ──
  useEffect(() => {
    if (phase?.agentData && !diagnosis) {
      const parsed = parseDiagnosisPayload(phase.agentData);
      if (parsed) {
        setDiagnosis(parsed);
        setView(phase.status === 'completado' ? 'approved' : 'diagnosis');
        autoTriggered.current = true;
      }
    }
  }, [phase?.agentData, phase?.status, diagnosis]);

  // ── Load existing diagnosis from DB on mount ──
  useEffect(() => {
    if (!projectId) return;

    (async () => {
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 4)
        .single();

      if (error || !data) return;

      // If there is data (regardless of status being 'completado' or 'disponible')
      if (data.datos_consolidados) {
        const parsed = parseDiagnosisPayload(data.datos_consolidados);
        if (parsed) {
          setDiagnosis(parsed);
          // If phase context says 'approved', keep it; otherwise show diagnosis for review
          if (data.estado_visual === 'completado' || phase?.status === 'completado') {
            setView('approved');
          } else {
            setView('diagnosis');
          }
          autoTriggered.current = true; // prevent auto-trigger
          return;
        }
      }

      // If it's already processing (edge auto-trigger in progress), just go to polling
      if (data.estado_visual === 'procesando') {
        setView('processing');
        autoTriggered.current = true; // don't double-trigger
        return;
      }
    })();
  }, [projectId]); // Run once on mount per project

  // RF-F4-02: Auto-trigger on mount when disponible — invokes the edge function
  useEffect(() => {
    if (autoTriggered.current || !projectId) return;
    if (view === 'auto-trigger') {
      autoTriggered.current = true;
      (async () => {
        // Check DB one more time to avoid double-trigger if edge already started
        const { data: check } = await supabase
          .from('fases_estado')
          .select('estado_visual, datos_consolidados')
          .eq('proyecto_id', projectId)
          .eq('numero_fase', 4)
          .single();

        if (check?.estado_visual === 'completado' && check?.datos_consolidados) {
          const parsed = parseDiagnosisPayload(check.datos_consolidados);
          if (parsed) {
            setDiagnosis(parsed);
            setView('diagnosis');
            playAgentSuccess();
            return;
          }
        }
        if (check?.estado_visual === 'procesando') {
          setView('processing');
          return;
        }

        setView('processing');
        updatePhaseStatus(projectId!, 4, 'procesando');
        supabase.functions.invoke('pmo-agent', {
          body: { projectId, phaseNumber: 4, iteration: 1 }
        }).then(({ data, error }) => {
          if (error) {
            const detail = (data as any)?.error || error.message;
            console.error('[Phase4] Edge function error:', detail);
            toast.error('Error en el Agente 4', { description: detail, duration: 8000 });
          }
        }).catch(e => console.error('[Phase4] invoke failed:', e));
      })();
    }
  }, [view, projectId]);

  // Poll Supabase every 4s while processing to detect when agent finishes
  useEffect(() => {
    // Only poll when actively waiting for the agent
    if (view !== 'processing') return;

    let isMounted = true;

    const fetchDiagnosis = async () => {
      if (!isMounted) return;
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 4)
        .single();

      if (error) { console.error('[Phase4 poll] error:', error); return; }

      if (!isMounted) return;

      // Success: agent completed and saved diagnosis (may be 'completado' OR 'disponible' with data)
      if (data?.datos_consolidados && (data?.estado_visual === 'completado' || data?.estado_visual === 'disponible')) {
        const parsed = parseDiagnosisPayload(data.datos_consolidados);
        if (parsed) {
          setDiagnosis(parsed);
          setIsReprocessing(false);
          setView('diagnosis');
          playAgentSuccess();
          toast.success('Agente 4 completó el diagnóstico', {
            description: `Tipo de PMO: ${parsed.pmoType}`,
          });
          return;
        }
      }

      // If reverted to disponible WITHOUT data, the agent truly failed
      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados) {
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 4, 'disponible');
        setView('error');
        toast.error('El Agente 4 encontró un error al procesar.');
        return;
      }
    };

    // Immediate first check, then poll every 4s
    fetchDiagnosis();
    const intervalId = setInterval(fetchDiagnosis, 4000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [view, projectId, playAgentSuccess]);

  if (!project) return null;
  // phase may be undefined briefly when navigating from Phase 3 — use safe defaults
  const safePhase = phase ?? { number: 4, status: 'disponible' as const, agentData: null, completedAt: null };

  // Manual retry handler — resets the guard and re-triggers
  const handleRetry = async () => {
    autoTriggered.current = false;
    updatePhaseStatus(projectId!, 4, 'disponible');
    setView('auto-trigger');
  };

  // Manual trigger if auto trigger failed or wasn't called
  const handleTriggerAgent = async () => {
    autoTriggered.current = true;
    updatePhaseStatus(projectId!, 4, 'procesando');
    setView('processing');
    supabase.functions.invoke('pmo-agent', {
      body: { projectId, phaseNumber: 4, iteration: 1 }
    }).then(({ error }) => {
      if (error) {
        console.error('[Phase4] manual trigger error:', error);
        // Let the poll handle the error state
      }
    }).catch(e => console.error('[Phase4] invoke failed:', e));
  };

  // ── Handlers ──

  const handleSaveComment = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario antes de guardar.'); return; }
    setIsSavingComment(true);
    try {
      // Guardar comentario en fases_estado como parte de los datos consolidados
      const { data: currentData } = await supabase
        .from('fases_estado')
        .select('datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 4)
        .single();

      const existing = (currentData?.datos_consolidados as any) || {};
      const comments_history = existing._comments_history || [];
      comments_history.push({
        text: comment,
        timestamp: new Date().toISOString(),
      });

      await supabase
        .from('fases_estado')
        .update({
          datos_consolidados: { ...existing, _comments_history: comments_history, _last_comment: comment },
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 4);

      setSavedComment(comment);
      toast.success('Comentario guardado', { description: 'El comentario quedará asociado al diagnóstico.' });
    } catch (err) {
      console.error('[Phase4] Error saving comment:', err);
      toast.error('Error guardando comentario');
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleReprocess = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario para re-procesar.'); return; }
    const nextIteration = (diagnosis?.iteration || 1) + 1;
    const reprocessComment = comment;

    setIsReprocessing(true);
    setSavedComment(reprocessComment);
    setComment('');

    try {
      // 0. Bloquear fases posteriores en AppContext + Supabase
      await reprocessPhase(projectId!, 4);

      // 1. Update DB FIRST so the poll won't see old 'completado' state
      await supabase
        .from('fases_estado')
        .update({ estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 4);

      updatePhaseStatus(projectId!, 4, 'procesando');

      // 2. NOW switch view — poll will see 'procesando' and wait
      setView('processing');

      // 3. Fire-and-forget: the polling effect will detect when the agent finishes
      supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 4, iteration: nextIteration, comments: reprocessComment }
      }).then(({ error }) => {
        if (error) {
          console.error('[Phase4] Reprocess edge error:', error);
        }
      }).catch(e => console.error('[Phase4] Reprocess invoke failed:', e));

      toast.info('Re-procesando diagnóstico con retroalimentación...', {
        description: 'El Agente 4 está incorporando el comentario del consultor.',
      });
    } catch (e) {
      console.error('[Phase4] Reprocess error:', e);
      toast.error('Error al re-procesar');
      setIsReprocessing(false);
      setView('diagnosis');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise(r => setTimeout(r, 700));
    setIsApproving(false);
    setShowApproveModal(false);
    // RF-F4-07: marca Fase 4 completada → computePhaseAvailability desbloquea Fase 5
    updatePhaseStatus(
      projectId!, 4, 'completado',
      `PMO ${diagnosis?.pmoType} · Confianza ${diagnosis?.confidence}% · ${diagnosis?.version === 'reprocesado' ? 'Diagnóstico reprocesado' : 'Diagnóstico original'}.`
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
        style={{ background: '#0a0a0a' }}
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
              style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
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
      <div className="flex flex-col items-center gap-3 text-gray-400 text-xs">
        <div className="flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" />
          Iniciando procesamiento…
        </div>
        
        {/* Manual trigger button */}
        <button 
          onClick={handleTriggerAgent}
          className="mt-4 px-4 py-2 border border-neutral-300 rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <Zap size={14} />
          Disparar Agente Manualmente
        </button>
      </div>
    </motion.div>
  );

  const renderProcessing = () => (
    <AnimatePresence>
      <motion.div 
        key="processing-overlay"
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center"
      >
        <div 
          className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" 
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>
          Procesando
        </p>
        <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
          {isReprocessing ? 'Regenerando diagnóstico' : 'Clasificando tipo de PMO'}
        </h2>
        <p className="text-neutral-500 text-[13px] mt-2 max-w-sm text-center">
          {isReprocessing
            ? 'El Agente 4 está incorporando el comentario del consultor y actualizando el diagnóstico…'
            : 'El Agente 4 está analizando el consolidado de los tres agentes previos…'}
        </p>
      </motion.div>
    </AnimatePresence>
  );

  const renderDiagnosis = () => {
    if (!diagnosis) return null;
    const cfg = PMO_CONFIG[diagnosis.pmoType];

    return (
      <motion.div key="diagnosis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 4 · Clasificación de proyectos</p>
            <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
              Diagnóstico de clasificación
            </h1>
            <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
              El Agente 4 evaluó el portafolio y determinó la tipología de PMO óptima con factores determinantes y recomendación.
            </p>
          </div>
          <VersionBadge diagnosis={diagnosis} />
        </div>

        {/* PMO type hero (RF-F4-04) */}
        <PmoTypeCard diagnosis={diagnosis} />

        {/* Justification */}
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
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

        {/* Key factors */}
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: cfg.bg }}>
              <Info size={13} style={{ color: cfg.color }} />
            </div>
            <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Evidencia Principal</h3>
          </div>
          <ul className="space-y-3">
            {diagnosis.keyFactors?.map((f: any, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-gray-600 text-sm">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase' }}>
                  {typeof f === 'string' ? i + 1 : f.split && f.split(':')[0] ? f.split(':')[0].substring(0, 3) : 'EV'}
                </div>
                <span className="leading-relaxed">{typeof f === 'string' ? f : JSON.stringify(f)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Breakdown and Tensiones */}
        {(diagnosis.type_breakdown || (diagnosis.tensiones && diagnosis.tensiones.length > 0)) && (
          <div className="grid grid-cols-2 gap-5 mb-5">
            {diagnosis.type_breakdown && (
              <div className="rounded-2xl border p-5" style={{ borderColor: cfg.border, background: cfg.bg }}>
                <p className="text-xs uppercase tracking-wide mb-3" style={{ color: cfg.color, fontWeight: 700 }}>
                  Composición del Enfoque
                </p>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4 bg-white/50 border border-white/40">
                  <div style={{ width: `${diagnosis.type_breakdown.agile_weight}%`, background: '#262626' }} />
                  <div style={{ width: `${diagnosis.type_breakdown.predictive_weight}%`, background: '#a3a3a3' }} />
                </div>
                <div className="flex justify-between text-[11px] mb-3" style={{ fontWeight: 600 }}>
                  <span className="text-neutral-800">{diagnosis.type_breakdown.agile_weight}% Ágil</span>
                  <span className="text-neutral-500">{diagnosis.type_breakdown.predictive_weight}% Predictivo</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: cfg.lightText }}>
                  {diagnosis.type_breakdown.hybrid_rationale}
                </p>
              </div>
            )}
            
            {diagnosis.tensiones && diagnosis.tensiones.length > 0 && (
              <div className="rounded-2xl border p-5 bg-white border-neutral-200">
                <p className="text-xs uppercase tracking-wide mb-3 text-neutral-600" style={{ fontWeight: 700 }}>
                  Tensiones Detectadas
                </p>
                <ul className="space-y-3">
                  {diagnosis.tensiones.map((tens: any, i: number) => (
                    <li key={i} className="text-[12px] text-neutral-700 leading-relaxed border-l-2 border-neutral-300 pl-3">
                      <span className="font-semibold text-neutral-900">{tens.tipo}: </span>
                      {tens.descripcion}
                      {tens.intensidad && (
                        <span className={`ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-medium border ${
                          tens.intensidad === 'Alta' ? 'bg-neutral-800 text-neutral-100 border-neutral-800'
                          : tens.intensidad === 'Moderada' ? 'bg-neutral-200 text-neutral-700 border-neutral-300'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                        }`}>{tens.intensidad}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Orientaciones por Fuente + Coherencia + Advertencias */}
        {diagnosis.orientaciones_por_fuente && (
          <div className="grid grid-cols-3 gap-5 mb-5">
            {['cuantitativo', 'cualitativo', 'documental'].map((fuente) => {
              const data = diagnosis.orientaciones_por_fuente[fuente];
              if (!data) return null;
              const orientColors: Record<string, { bg: string; text: string; border: string }> = {
                'Agil': { bg: '#262626', text: '#ffffff', border: '#171717' },
                'Ágil': { bg: '#262626', text: '#ffffff', border: '#171717' },
                'Predictivo': { bg: '#f5f5f5', text: '#525252', border: '#e5e5e5' },
                'Hibrido': { bg: '#fcfcfc', text: '#404040', border: '#d4d4d4' },
                'Híbrido': { bg: '#fcfcfc', text: '#404040', border: '#d4d4d4' },
              };
              const colors = orientColors[data.orientacion] || { bg: '#ffffff', text: '#737373', border: '#f4f4f5' };
              const labels: Record<string, string> = { cuantitativo: 'Encuesta (Cuantitativo)', cualitativo: 'Entrevistas (Cualitativo)', documental: 'Documentos (Documental)' };
              return (
                <div key={fuente} className="bg-white rounded-2xl border border-neutral-200/70 p-5">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-2" style={{ fontWeight: 600 }}>{labels[fuente]}</p>
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] mb-3" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontWeight: 600 }}>
                    {data.orientacion || 'No disponible'}
                  </div>
                  <p className="text-neutral-600 text-[12px] leading-relaxed">{data.evidencia_principal || 'Sin evidencia detallada'}</p>
                  {data.promedio_general !== undefined && data.promedio_general > 0 && (
                    <p className="text-neutral-400 text-[11px] mt-2">Promedio: <span className="font-semibold text-neutral-600">{data.promedio_general}</span></p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Coherencia + Estado de integración + Advertencias */}
        <div className="flex gap-5 mb-5">
          {diagnosis.coherencia && (
            <div className={`flex-1 rounded-2xl border p-5 ${
              diagnosis.coherencia === 'Alta' ? 'bg-neutral-900 text-white border-neutral-900' 
              : diagnosis.coherencia === 'Media' ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
              : 'bg-neutral-50 text-neutral-500 border-neutral-200'
            }`}>
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1" style={{ fontWeight: 600 }}>Coherencia entre Fuentes</p>
              <p className="text-lg" style={{ fontWeight: 700 }}>{diagnosis.coherencia}</p>
            </div>
          )}
          {diagnosis.estado_integracion && (
            <div className="flex-1 rounded-2xl border border-neutral-200/70 bg-white p-5">
              <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1" style={{ fontWeight: 600 }}>Estado de Integración</p>
              <p className="text-lg text-neutral-800" style={{ fontWeight: 700 }}>{diagnosis.estado_integracion}</p>
            </div>
          )}
        </div>

        {diagnosis.advertencias_de_entrada && diagnosis.advertencias_de_entrada.length > 0 && (
          <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-neutral-500" />
              <p className="text-xs uppercase tracking-wide text-neutral-700" style={{ fontWeight: 700 }}>Advertencias de Entrada</p>
            </div>
            <ul className="space-y-2">
              {diagnosis.advertencias_de_entrada.map((adv: string, i: number) => (
                <li key={i} className="text-[12px] text-neutral-600 leading-relaxed flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full mt-2 bg-neutral-400 flex-shrink-0" />
                  {adv}
                </li>
              ))}
            </ul>
          </div>
        )}

        {renderPhase3Details()}

        {/* RF-F4-05: Consultant comments */}
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={15} className="text-gray-500" />
            <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Comentarios del consultor</h3>
          </div>
          <p className="text-gray-400 text-xs mb-3">
            Agregue observaciones, contexto o ajustes al diagnóstico. Puede guardar el comentario o re-procesar el diagnóstico incorporándolo.
          </p>

          {savedComment && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 text-[13px] text-neutral-600">
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
              style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              <ThumbsUp size={14} />
              Aprobar diagnóstico
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderApproved = () => {
    if (!diagnosis) return null;
    const cfg = PMO_CONFIG[diagnosis.pmoType as PmoType];
    
    return (
      <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 4 · Clasificación de proyectos</p>
          <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            Diagnóstico aprobado
          </h1>
          <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
            La tipología de PMO ha sido validada y registrada como referencia para las fases siguientes.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-neutral-900 text-[12px]" style={{ fontWeight: 600 }}>
            <CheckCircle2 size={13} /> Fase completada y aprobada
          </span>
        </div>

        <PmoTypeCard diagnosis={diagnosis} />

        {/* Justification */}
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
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

        {/* Key factors */}
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: cfg.bg }}>
              <Info size={13} style={{ color: cfg.color }} />
            </div>
            <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Evidencia Principal</h3>
          </div>
          <ul className="space-y-3">
            {diagnosis.keyFactors?.map((f: any, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-gray-600 text-sm">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase' }}>
                  {typeof f === 'string' ? i + 1 : f.split && f.split(':')[0] ? f.split(':')[0].substring(0, 3) : 'EV'}
                </div>
                <span className="leading-relaxed">{typeof f === 'string' ? f : JSON.stringify(f)}</span>
              </li>
            ))}
          </ul>
          {safePhase.completedAt && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-gray-400 text-xs">
              <CheckCircle2 size={11} className="text-neutral-900" />
              Aprobado el {safePhase.completedAt}
            </div>
          )}
        </div>

        {/* Breakdown and Tensiones */}
        {(diagnosis.type_breakdown || (diagnosis.tensiones && diagnosis.tensiones.length > 0)) && (
          <div className="grid grid-cols-2 gap-5 mb-5">
            {diagnosis.type_breakdown && (
              <div className="rounded-2xl border p-5" style={{ borderColor: cfg.border, background: cfg.bg }}>
                <p className="text-xs uppercase tracking-wide mb-3" style={{ color: cfg.color, fontWeight: 700 }}>
                  Composición del Enfoque
                </p>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4 bg-white/50 border border-white/40">
                  <div style={{ width: `${diagnosis.type_breakdown.agile_weight}%`, background: '#0a0a0a' }} />
                  <div style={{ width: `${diagnosis.type_breakdown.predictive_weight}%`, background: '#525252' }} />
                </div>
                <div className="flex justify-between text-[11px] mb-3" style={{ fontWeight: 600 }}>
                  <span className="text-neutral-900">{diagnosis.type_breakdown.agile_weight}% Ágil</span>
                  <span className="text-neutral-600">{diagnosis.type_breakdown.predictive_weight}% Predictivo</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: cfg.lightText }}>
                  {diagnosis.type_breakdown.hybrid_rationale}
                </p>
              </div>
            )}
            
            {diagnosis.tensiones && diagnosis.tensiones.length > 0 && (
              <div className="rounded-2xl border p-5 bg-white border-neutral-200">
                <p className="text-xs uppercase tracking-wide mb-3 text-neutral-900" style={{ fontWeight: 700 }}>
                  Tensiones Detectadas
                </p>
                <ul className="space-y-3">
                  {diagnosis.tensiones.map((tens: any, i: number) => (
                    <li key={i} className="text-[12px] text-neutral-700 leading-relaxed border-l-2 border-neutral-300 pl-3">
                      <span className="font-semibold text-neutral-900">{tens.tipo}: </span>
                      {tens.descripcion}
                      {tens.intensidad && (
                        <span className={`ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-medium border ${
                          tens.intensidad === 'Alta' ? 'bg-neutral-900 text-white border-neutral-900'
                          : tens.intensidad === 'Moderada' ? 'bg-neutral-200 text-neutral-700 border-neutral-300'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                        }`}>{tens.intensidad}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Orientaciones por Fuente + Coherencia + Advertencias */}
        {diagnosis.orientaciones_por_fuente && (
          <div className="grid grid-cols-3 gap-5 mb-5">
            {['cuantitativo', 'cualitativo', 'documental'].map((fuente) => {
              const data = diagnosis.orientaciones_por_fuente[fuente];
              if (!data) return null;
              const orientColors: Record<string, { bg: string; text: string; border: string }> = {
                'Agil': { bg: '#262626', text: '#ffffff', border: '#171717' },
                'Ágil': { bg: '#262626', text: '#ffffff', border: '#171717' },
                'Predictivo': { bg: '#f5f5f5', text: '#525252', border: '#e5e5e5' },
                'Hibrido': { bg: '#fcfcfc', text: '#404040', border: '#d4d4d4' },
                'Híbrido': { bg: '#fcfcfc', text: '#404040', border: '#d4d4d4' },
              };
              const colors = orientColors[data.orientacion] || { bg: '#ffffff', text: '#737373', border: '#f4f4f5' };
              const labels: Record<string, string> = { cuantitativo: 'Encuesta (Cuantitativo)', cualitativo: 'Entrevistas (Cualitativo)', documental: 'Documentos (Documental)' };
              return (
                <div key={fuente} className="bg-white rounded-2xl border border-neutral-200/70 p-5">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-2" style={{ fontWeight: 600 }}>{labels[fuente]}</p>
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] mb-3" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontWeight: 600 }}>
                    {data.orientacion || 'No disponible'}
                  </div>
                  <p className="text-neutral-600 text-[12px] leading-relaxed">{data.evidencia_principal || 'Sin evidencia detallada'}</p>
                  {data.promedio_general !== undefined && data.promedio_general > 0 && (
                    <p className="text-neutral-400 text-[11px] mt-2">Promedio: <span className="font-semibold text-neutral-600">{data.promedio_general}</span></p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Coherencia + Estado de integración + Advertencias */}
        <div className="flex gap-5 mb-5">
          {diagnosis.coherencia && (
            <div className={`flex-1 rounded-2xl border p-5 ${
              diagnosis.coherencia === 'Alta' ? 'bg-neutral-900 text-white border-neutral-900' 
              : diagnosis.coherencia === 'Media' ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
              : 'bg-neutral-50 text-neutral-500 border-neutral-200'
            }`}>
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1" style={{ fontWeight: 600 }}>Coherencia entre Fuentes</p>
              <p className="text-lg" style={{ fontWeight: 700 }}>{diagnosis.coherencia}</p>
            </div>
          )}
          {diagnosis.estado_integracion && (
            <div className="flex-1 rounded-2xl border border-neutral-200/70 bg-white p-5">
              <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1" style={{ fontWeight: 600 }}>Estado de Integración</p>
              <p className="text-lg text-neutral-800" style={{ fontWeight: 700 }}>{diagnosis.estado_integracion}</p>
            </div>
          )}
        </div>

        {diagnosis.advertencias_de_entrada && diagnosis.advertencias_de_entrada.length > 0 && (
          <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-neutral-500" />
              <p className="text-xs uppercase tracking-wide text-neutral-700" style={{ fontWeight: 700 }}>Advertencias de Entrada</p>
            </div>
            <ul className="space-y-2">
              {diagnosis.advertencias_de_entrada.map((adv: string, i: number) => (
                <li key={i} className="text-[12px] text-neutral-600 leading-relaxed flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full mt-2 bg-neutral-400 flex-shrink-0" />
                  {adv}
                </li>
              ))}
            </ul>
          </div>
        )}

        {renderPhase3Details()}
      </motion.div>
    );
  };

  const renderError = () => (
    <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: '#f5f5f5', border: '1px solid #e5e5e5' }}>
        <AlertTriangle size={28} className="text-neutral-400" />
      </div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 600 }}>
        Error de procesamiento
      </p>
      <h2 className="text-neutral-900 tracking-tight mb-3"
        style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
        El Agente 4 encontró un error
      </h2>
      <p className="text-neutral-500 text-[13px] max-w-sm leading-relaxed mb-8">
        Hubo un problema al procesar los datos de las fases anteriores. Esto puede ocurrir si los diagnósticos de las fases 1, 2 o 3 están vacíos. Revisa los logs en Supabase para más detalle.
      </p>
      <button
        onClick={handleRetry}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm"
        style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
      >
        <RefreshCw size={14} />
        Reintentar
      </button>
    </motion.div>
  );

  const renderPhase3Details = () => {
    if (!phase3?.agentData) return null;
    const diagnosisFase3 = phase3.agentData.diagnosis || phase3.agentData;
    
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 border-t border-neutral-200/70 pt-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200">
            <BarChart2 size={15} className="text-neutral-600" />
          </div>
          <div>
            <h2 className="text-neutral-900 text-[15px]" style={{ fontWeight: 600 }}>Anexo: Resultados de Idoneidad (Fase 3)</h2>
            <p className="text-neutral-500 text-[12px] mt-0.5">Gráfica de radar y cuadro de detalles por factor generados en la fase anterior.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-sm">
             <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Gráfica de radar de la organización</p>
             <div className="h-[400px] w-full">
               {radarData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                     <PolarGrid stroke="#e5e5e5" />
                     <PolarAngleAxis dataKey="subject" tick={{ fill: '#737373', fontSize: 10, fontWeight: 500 }} />
                     <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#a3a3a3', fontSize: 10 }} axisLine={false} />
                     <Radar name="Zona Predictiva (8-10)" dataKey="PredictiveZone" stroke="none" fill="#ef4444" fillOpacity={0.12} isAnimationActive={false} />
                     <Radar name="Zona Híbrida (4-8)" dataKey="HybridZone" stroke="none" fill="#f59e0b" fillOpacity={0.18} isAnimationActive={false} />
                     <Radar name="Zona Ágil (0-4)" dataKey="AgileZone" stroke="none" fill="#10b981" fillOpacity={0.25} isAnimationActive={false} />
                     <Radar name="Puntaje Real" dataKey="Puntaje" stroke="#171717" strokeWidth={3} fill="#171717" fillOpacity={0.45} />
                     <Tooltip content={<CustomRadarTooltip />} />
                   </RadarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
                    <p className="text-[13px]">Gráfica no disponible para estos datos</p>
                 </div>
               )}
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 flex flex-col shadow-sm overflow-hidden">
            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Detalle de factores evaluados</p>
            <div className="rounded-xl border border-neutral-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    {['Item', 'Dimensión', 'Prom', 'Min', 'Max', 'Zona', 'Crítico'].map((h) => (
                      <th key={h} className="px-3 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 bg-white">
                  {((normalizeIdoneidadDiagnosisItems(diagnosisFase3).length ? normalizeIdoneidadDiagnosisItems(diagnosisFase3) : [{ item: emptyValue, dimension: emptyValue, promedio: emptyValue, minimo: emptyValue, maximo: emptyValue, zona: emptyValue, factor_critico: emptyValue }]) as any[]).map((item, i) => (
                    <tr key={i} className="hover:bg-neutral-50/60">
                      <td className="px-3 py-3 text-[12px] text-neutral-800" style={{ fontWeight: 600 }}>{valueOrEmpty(getIdoneidadItemCode(item))}</td>
                      <td className="px-3 py-3 text-[12px] text-neutral-600 truncate max-w-[90px]">{valueOrEmpty(item.dimension)}</td>
                      <td className="px-3 py-3 text-[12px] text-neutral-900 tabular-nums font-semibold">{valueOrEmpty(getIdoneidadItemScore(item))}</td>
                      <td className="px-3 py-3 text-[12px] text-neutral-500 tabular-nums">{valueOrEmpty(item.minimo)}</td>
                      <td className="px-3 py-3 text-[12px] text-neutral-500 tabular-nums">{valueOrEmpty(item.maximo)}</td>
                      <td className="px-3 py-3 text-[11px] text-neutral-600 truncate max-w-[80px]">{valueOrEmpty(item.zona)}</td>
                      <td className="px-3 py-3 text-[11px] text-neutral-500 truncate max-w-[60px]">{valueOrEmpty(item.factor_critico)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Layout ──
  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={4}
        phaseName="Clasificación de Proyectos"
        onCancelled={() => {
          autoTriggered.current = false;
          setView('auto-trigger');
        }}
        onReprocessed={async () => {
          // 1. Clear local state first
          autoTriggered.current = true;
          setDiagnosis(null);
          setIsReprocessing(true);

          // 2. Block downstream phases (5, 6, 7…) in DB
          await supabase
            .from('fases_estado')
            .update({ estado_visual: 'bloqueado', datos_consolidados: null, updated_at: new Date().toISOString() })
            .eq('proyecto_id', projectId!)
            .gt('numero_fase', 4);

          // 3. Set THIS phase to 'procesando' in DB BEFORE switching view (avoids poll seeing 'disponible')
          await supabase
            .from('fases_estado')
            .update({ estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() })
            .eq('proyecto_id', projectId!)
            .eq('numero_fase', 4);

          // 4. Sync AppContext
          updatePhaseStatus(projectId!, 4, 'procesando');

          // 5. NOW switch view — polling starts and sees 'procesando', not 'disponible'
          setView('processing');

          // 6. Fire-and-forget the agent call
          supabase.functions.invoke('pmo-agent', {
            body: { projectId, phaseNumber: 4, iteration: 1 }
          }).then(({ error }) => {
            if (error) console.error('[Phase4] Reprocess (header) error:', error);
          }).catch(e => console.error('[Phase4] Reprocess invoke failed:', e));
        }}
      />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">
          {view === 'auto-trigger' && renderAutoTrigger()}
          {view === 'processing' && renderProcessing()}
          {view === 'diagnosis' && renderDiagnosis()}
          {view === 'approved' && renderApproved()}
          {view === 'error' && renderError()}
        </AnimatePresence>
      </div>

      {/* RF-F4-07: Approve confirm modal */}
      <ApproveModal
        open={showApproveModal}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        isLoading={isApproving}
      />

      <NextPhaseButton projectId={projectId!} nextPhase={5} prevPhase={3} show={view === 'approved'} />
    </div>
  );
}