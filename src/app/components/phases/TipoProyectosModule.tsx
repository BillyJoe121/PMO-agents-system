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
  Loader2, CheckCircle2, Brain, Zap,
  RefreshCw, AlertTriangle, Send, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { useSoundManager } from '../../hooks/useSoundManager';
import { normalizeIdoneidadDiagnosisItems, getIdoneidadItemCode, getIdoneidadItemScore, inferIdoneidadDimension, factorMapping } from './IdoneidadModule';
import TipoProyectosDiagnosisView from './tipo-proyectos/TipoProyectosDiagnosisView';
import TipoProyectosIdoneidadAnnex from './tipo-proyectos/TipoProyectosIdoneidadAnnex';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type DiagnosisVersion = 'original' | 'reprocesado';
type ModuleView = 'auto-trigger' | 'processing' | 'diagnosis' | 'approved' | 'error';

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
                style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
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
      const factorInfo = factorMapping[itemLabel];

      return {
        subject: factorInfo ? factorInfo.name : itemLabel,
        fullLabel: factorInfo ? `${itemLabel} - ${factorInfo.name}` : itemLabel,
        dimension: res.dimension ?? inferIdoneidadDimension(itemLabel),
        Puntaje: score,
        AgileZone: 4,
        HybridZone: 8,
        PredictiveZone: 10,
      };
    });
  }, [phase3?.agentData]);

  // Derive initial view from phase status
  const deriveInitialView = (): ModuleView => {
    if (!phase) return 'auto-trigger';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (phase.status === 'error') return 'error';
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
  const processingGuardUntilRef = useRef(0);

  const keepProcessingIfAgentStarted = async () => {
    if (!projectId) return false;

    const { data } = await supabase
      .from('fases_estado')
      .select('estado_visual, datos_consolidados')
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 4)
      .single();

    if (data?.estado_visual === 'procesando') {
      setView('processing');
      return true;
    }

    if (data?.estado_visual === 'disponible' && !data?.datos_consolidados && Date.now() < processingGuardUntilRef.current) {
      setView('processing');
      return true;
    }

    return false;
  };

  const handlePhase4InvokeError = async (label: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error || 'Error desconocido');
    console.error(`[Phase4] ${label}:`, error);
    if (await keepProcessingIfAgentStarted()) {
      toast.info('El Agente 4 ya quedó en ejecución.', {
        description: 'Seguiremos monitoreando el resultado en esta pantalla.',
      });
      return;
    }
    setIsReprocessing(false);
    updatePhaseStatus(projectId!, 4, 'error');
    setView('error');
    playProcessError();
    toast.error('Error en el Agente 4', { description: detail, duration: 8000 });
  };

  // ── Sync with context if it loads after initial render ──
  useEffect(() => {
    if (phase?.agentData && !diagnosis) {
      const parsed = parseDiagnosisPayload(phase.agentData);
      if (parsed) {
        setDiagnosis(parsed);
        setView(phase.status === 'completado' ? 'approved' : 'diagnosis');
        autoTriggered.current = true;
      }
    } else if (phase?.status === 'error' && view !== 'error') {
      setView('error');
      autoTriggered.current = true;
    }
  }, [phase?.agentData, phase?.status, diagnosis, view]);

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
        processingGuardUntilRef.current = Date.now() + 15000;
        setView('processing');
        autoTriggered.current = true; // don't double-trigger
        return;
      }

      // Explicitly handle 'error' state from DB on mount
      if (data.estado_visual === 'error') {
        setView('error');
        autoTriggered.current = true;
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
        supabase.functions.invoke('pmo-agent', {
          body: { projectId, phaseNumber: 4, iteration: 1 }
        }).then(({ data, error }) => {
          if (error) {
            const detail = (data as any)?.error || error.message;
            handlePhase4InvokeError('Edge function error', new Error(detail));
          }
        }).catch(e => handlePhase4InvokeError('invoke failed', e));
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

      if (data?.estado_visual === 'error') {
        setIsReprocessing(false);
        setView('error');
        playProcessError();
        const errorMessage = (data?.datos_consolidados as any)?.message;
        toast.error('El Agente 4 encontró un error al procesar.', {
          description: errorMessage,
          duration: 8000,
        });
        return;
      }

      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados && Date.now() < processingGuardUntilRef.current) {
        return;
      }

      // If reverted to disponible WITHOUT data, the agent truly failed
      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados) {
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 4, 'disponible');
        setView('error');
        playProcessError();
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
    processingGuardUntilRef.current = Date.now() + 15000;
    setView('processing');
    supabase.functions.invoke('pmo-agent', {
      body: { projectId, phaseNumber: 4, iteration: 1 }
    }).then(({ error }) => {
      if (error) {
        handlePhase4InvokeError('manual trigger error', error);
      }
    }).catch(e => handlePhase4InvokeError('invoke failed', e));
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

      // 1. Switch view immediately; the edge function owns the DB processing marker and run id.
      processingGuardUntilRef.current = Date.now() + 15000;
      setView('processing');

      // 2. Fire-and-forget: the polling effect will detect when the agent finishes
      supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 4, iteration: nextIteration, comments: reprocessComment }
      }).then(({ error }) => {
        if (error) {
          handlePhase4InvokeError('Reprocess edge error', error);
        }
      }).catch(e => handlePhase4InvokeError('Reprocess invoke failed', e));

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
        style={{ background: '#5454e9' }}
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
              style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
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
        className="fixed inset-0 z-[100] bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center"
      >
        <div 
          className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" 
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>
          Procesando
        </p>
        <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
          {isReprocessing ? 'Regenerando diagnóstico' : 'Clasificando tipo de PMO'}
        </h2>
        <p className="text-[#5454e9] text-[13px] mt-2 max-w-sm text-center">
          {isReprocessing
            ? 'El Agente está incorporando el comentario del consultor y actualizando el diagnóstico…'
            : 'El Agente está analizando el consolidado de los tres agentes previos…'}
        </p>
      </motion.div>
    </AnimatePresence>
  );

  const renderPhase3Annex = () => (
    <TipoProyectosIdoneidadAnnex phase3AgentData={phase3?.agentData} radarData={radarData} />
  );

  const renderDiagnosis = () => {
    if (!diagnosis) return null;
    return (
      <TipoProyectosDiagnosisView
        diagnosis={diagnosis}
        savedComment={savedComment}
        comment={comment}
        isSavingComment={isSavingComment}
        isReprocessing={isReprocessing}
        onCommentChange={setComment}
        onSaveComment={handleSaveComment}
        onReprocess={handleReprocess}
        onApprove={() => setShowApproveModal(true)}
        annex={renderPhase3Annex()}
      />
    );
  };

  const renderApproved = () => {
    if (!diagnosis) return null;
    return (
      <TipoProyectosDiagnosisView
        diagnosis={diagnosis}
        approved
        completedAt={safePhase.completedAt}
        annex={renderPhase3Annex()}
      />
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
        style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
      >
        <RefreshCw size={14} />
        Reintentar
      </button>
    </motion.div>
  );

  // ── Layout ──
  return (
    <div className="min-h-screen bg-[#f7f8ff]">
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
          const nextIteration = (diagnosis?.iteration || 1) + 1;

          // 2. Block downstream phases (5, 6, 7…) in DB
          await supabase
            .from('fases_estado')
            .update({ estado_visual: 'bloqueado', datos_consolidados: null, updated_at: new Date().toISOString() })
            .eq('proyecto_id', projectId!)
            .gt('numero_fase', 4);

          // 3. Clear this phase without marking it as processing; the edge function must create the run marker.
          await supabase
            .from('fases_estado')
            .update({ estado_visual: 'disponible', datos_consolidados: null, updated_at: new Date().toISOString() })
            .eq('proyecto_id', projectId!)
            .eq('numero_fase', 4);

          // 4. Switch to the local loading view while the edge function starts.
          processingGuardUntilRef.current = Date.now() + 15000;
          setView('processing');

          // 5. Fire-and-forget the agent call
          supabase.functions.invoke('pmo-agent', {
            body: { projectId, phaseNumber: 4, iteration: nextIteration }
          }).then(({ error }) => {
            if (error) handlePhase4InvokeError('Reprocess (header) error', error);
          }).catch(e => handlePhase4InvokeError('Reprocess invoke failed', e));
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
