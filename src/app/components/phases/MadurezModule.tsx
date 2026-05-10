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

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { useSoundManager } from '../../hooks/useSoundManager';
import { useMadurez } from '../../hooks/useMadurez';
import { supabase } from '../../lib/supabase';
import MadurezDiagnosisView from './madurez/MadurezDiagnosisView';
import { ApproveModal } from './madurez/module/ApproveModal';
import { MadurezOverview } from './madurez/module/MadurezOverview';
import { ProcessingOverlay } from './madurez/module/ProcessingOverlay';
import { MATURITY_LEVELS, PMO_CONFIG, formatMaturityLabel, formatOneDecimal, parseAgentResults, parsePmoType } from './madurez/module/maturityLogic';
import type { FullResults, ModuleView, PmoType } from './madurez/module/types';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';

export default function MadurezModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const { getProject, updatePhaseStatus, reprocessPhase, isLoading } = useApp();
  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 5);
  const phase4 = project?.phases.find(p => p.number === 4);

  // ── Fresh Phase 4 data from DB to avoid stale AppContext race ──
  // When the user reprocesses Phase 4 and immediately navigates to Phase 5,
  // the AppContext may not have hydrated yet with the new Phase 4 result.
  // We query the DB directly on mount so pmoType is always accurate.
  const [freshPhase4Data, setFreshPhase4Data] = useState<any>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from('fases_estado')
        .select('datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 4)
        .maybeSingle();
      if (data?.datos_consolidados) {
        setFreshPhase4Data(data.datos_consolidados);
      }
    })();
  }, [projectId]);

  // Prefer fresh DB data over potentially stale AppContext data
  const phase4AgentData = freshPhase4Data ?? phase4?.agentData;

  // Determine PMO type from Phase 4 result
  const pmoType: PmoType = parsePmoType(phase4AgentData);
  const needsAgil = pmoType === 'Ágil' || pmoType === 'Híbrida';
  const needsPredictiva = pmoType === 'Predictiva' || pmoType === 'Híbrida';

  // State — derive initial view from phase status (same pattern as Phase 4)
  const [view, setView] = useState<ModuleView>(() => {
    if (!phase) return 'overview';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (phase.status === 'bloqueado') return 'overview';
    // 'disponible' with data = pending review; without data = overview
    if (phase.agentData && Object.keys(phase.agentData).length > 0) return 'results';
    return 'overview';
  });

  // Managers
  const predictivaManager = useMadurez(projectId, 'predictiva');
  const agilManager = useMadurez(projectId, 'agil');

  const [results, setResults] = useState<FullResults | null>(() => {
    if (phase?.agentData && phase.status !== 'bloqueado') {
      return parseAgentResults(phase.agentData);
    }
    return null;
  });
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const processingGuardUntilRef = useRef(0);

  const keepProcessingAfterInvokeError = useCallback(async () => {
    if (!projectId) return false;

    const { data } = await supabase
      .from('fases_estado')
      .select('estado_visual, datos_consolidados')
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 5)
      .single();

    if (data?.estado_visual === 'procesando') {
      setView('processing');
      return true;
    }

    return false;
  }, [projectId]);

  // ── Sync with context — only when we have real results and aren't actively processing ──
  useEffect(() => {
    // Never override the processing view from context sync
    if (phase?.status === 'bloqueado' || phase?.status === 'procesando') return;
    if (phase?.agentData && !results) {
      const parsed = parseAgentResults(phase.agentData);
      if (parsed) {
        setResults(parsed);
        setView(phase.status === 'completado' ? 'approved' : 'results');
      }
    }
  }, [phase?.agentData, phase?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load from DB on mount ──
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 5)
        .single();

      if (error || !data) return;

      // Blocked = clean slate
      if (data.estado_visual === 'bloqueado') {
        setResults(null);
        setView('overview');
        return;
      }

      // Has data = show results or approved (same as Phase 4: disponible + data → diagnosis view)
      if (data.datos_consolidados) {
        if ((data.datos_consolidados as any)?._error) {
          setResults(null);
          setView('overview');
          return;
        }
        const parsed = parseAgentResults(data.datos_consolidados);
        if (parsed) {
          setResults(parsed);
          if (data.estado_visual === 'completado') {
            setView('approved');
          } else if (data.estado_visual === 'procesando') {
            setView('processing');
          } else {
            // 'disponible' with data = agent finished, pending review
            setView('results');
          }
          return;
        }
      }

      // disponible with no data = overview (hasn't been processed yet)
      if (data.estado_visual === 'disponible' && !data.datos_consolidados) {
        setResults(null);
        setView('overview');
      }

      // procesando with no data = still running
      if (data.estado_visual === 'procesando') {
        setView('processing');
      }
    })();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling — activates when view==='processing', exactly like Phase 4 ──
  useEffect(() => {
    if (view !== 'processing') return;

    let isMounted = true;

    const fetchResult = async () => {
      if (!isMounted || !projectId) return;
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 5)
        .single();

      if (error || !isMounted) return;

      // Agent finished successfully (completado OR disponible + data)
      if (data?.datos_consolidados && (data.estado_visual === 'completado' || data.estado_visual === 'disponible')) {
        if ((data.datos_consolidados as any)?._error) {
          const message = (data.datos_consolidados as any)?.message || 'Revise la configuración del agente e intente nuevamente.';
          setIsReprocessing(false);
          updatePhaseStatus(projectId!, 5, 'disponible');
          setView('overview');
          toast.error('El Agente 5 encontró un error.', { description: message, duration: 9000 });
          return;
        }
        const parsed = parseAgentResults(data.datos_consolidados);
        if (parsed) {
          setResults(parsed);
          setIsReprocessing(false);
          setView('results');
          updatePhaseStatus(projectId!, 5, data.estado_visual as any);
          playAgentSuccess();
          toast.success('Agente 5 completó el análisis de madurez', {
            description: `Nivel general: ${formatMaturityLabel(MATURITY_LEVELS[(parsed.overallLevel || 1) - 1]?.name, parsed.overallLevel || 1)} (${formatOneDecimal(parsed.overallScore)})`,
          });
          return;
        }
      }

      if (data?.estado_visual === 'error') {
        const message = (data?.datos_consolidados as any)?.message || 'Revise la configuración del agente e intente nuevamente.';
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 5, 'disponible');
        setView('overview');
        toast.error('El Agente 5 encontró un error.', { description: message, duration: 9000 });
        return;
      }

      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados && Date.now() < processingGuardUntilRef.current) {
        return;
      }

      // Agent failed (reverted to disponible with no data)
      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados) {
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 5, 'disponible');
        setView('overview');
        toast.error('El Agente 5 encontró un error. Intente nuevamente.');
      }
    };

    fetchResult();
    const intervalId = setInterval(fetchResult, 4000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [view, projectId, playAgentSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project || !phase) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y la fase de madurez..." />
      : <MissingProjectState title="Fase no disponible" description="No pudimos encontrar el proyecto o la fase de madurez." />;
  }

  // Survey completion check
  const hasPredictivaData = predictivaManager.responses.length > 0 || predictivaManager.existingFiles.length > 0 || predictivaManager.externalFiles.length > 0;
  const hasAgilData = agilManager.responses.length > 0 || agilManager.existingFiles.length > 0 || agilManager.externalFiles.length > 0;

  const predictivaDone = !needsPredictiva || hasPredictivaData;
  const agilDone = !needsAgil || hasAgilData;
  
  const allDone = predictivaDone && agilDone;
  const doneCount = [needsAgil && hasAgilData, needsPredictiva && hasPredictivaData].filter(Boolean).length;
  const totalCount = [needsAgil, needsPredictiva].filter(Boolean).length;

  // ── Handlers ──
  const handleSend = async () => {
    processingGuardUntilRef.current = Date.now() + 15000;
    setView('processing');
    setResults(null);
    let didInvokeAgent = false;
    
    try {
      let predictivaFileUrl: string | null = null;
      let agilFileUrl: string | null = null;
      if (needsPredictiva) predictivaFileUrl = await predictivaManager.uploadFileIfAny() || null;
      if (needsAgil) agilFileUrl = await agilManager.uploadFileIfAny() || null;

      didInvokeAgent = true;
      const response = await supabase.functions.invoke('pmo-agent', {
        body: {
          projectId,
          phaseNumber: 5,
          iteration: 1,
          pmoType,
          ...(predictivaFileUrl && { predictivaFileUrl }),
          ...(agilFileUrl && { agilFileUrl }),
        }
      });
      if (response.error) throw new Error((response.data as any)?.error || response.error.message);
      // Polling is now driven by the useEffect(view==='processing') — nothing else needed
    } catch (err: any) {
      if (didInvokeAgent && await keepProcessingAfterInvokeError()) {
        toast.info('El Agente 5 ya quedÃ³ en ejecuciÃ³n.', {
          description: 'Seguiremos monitoreando el resultado en esta pantalla.',
        });
        return;
      }
      toast.error('Error enviando datos al Agente 5', { description: err.message });
      updatePhaseStatus(projectId!, 5, 'disponible');
      setView('overview');
    }
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
    setResults(null);
    processingGuardUntilRef.current = Date.now() + 15000;
    let didInvokeAgent = false;

    try {
      // Bloquear fases posteriores y limpiar datos
      await reprocessPhase(projectId!, 5);

      // Set view to processing AFTER supabase update so the polling useEffect picks it up
      setView('processing');

      let predictivaFileUrl: string | null = null;
      let agilFileUrl: string | null = null;
      if (needsPredictiva) predictivaFileUrl = await predictivaManager.uploadFileIfAny() || null;
      if (needsAgil) agilFileUrl = await agilManager.uploadFileIfAny() || null;

      didInvokeAgent = true;
      const response = await supabase.functions.invoke('pmo-agent', {
        body: {
          projectId,
          phaseNumber: 5,
          iteration: 2,
          pmoType,
          comentario_consultor: comment,
          ...(predictivaFileUrl && { predictivaFileUrl }),
          ...(agilFileUrl && { agilFileUrl }),
        }
      });
      if (response.error) throw new Error((response.data as any)?.error || response.error.message);
      setSavedComment(comment);
      setComment('');
    } catch (err: any) {
      if (didInvokeAgent && await keepProcessingAfterInvokeError()) {
        toast.info('El Agente 5 ya quedÃ³ en ejecuciÃ³n.', {
          description: 'Seguiremos monitoreando el resultado en esta pantalla.',
        });
        return;
      }
      toast.error('Error re-procesando', { description: err.message });
      setIsReprocessing(false);
      setView('overview');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsApproving(false);
    setShowApproveModal(false);
    updatePhaseStatus(projectId!, 5, 'completado',
      `Madurez PMO ${pmoType} - Nivel ${formatMaturityLabel(MATURITY_LEVELS[(results?.overallLevel ?? 2) - 1].name, results?.overallLevel ?? 2)} - Promedio ${formatOneDecimal(results?.overallScore ?? 0)}. ${results?.summary?.slice(0, 120)}...`
    );
    playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
    setView('approved');
    toast.success('¡Fase 5 aprobada!', { description: 'La Fase 6 se ha desbloqueado automáticamente.' });
  };

  // ── PMO type config ──
  const pmoCfg = PMO_CONFIG[pmoType];

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#f7f8ff]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={5}
        phaseName="Madurez de la PMO"
        onReprocessed={async () => {
          // 1. Block downstream phases (6, 7…)
          await reprocessPhase(projectId!, 5);
          // 2. Clear local state
          setResults(null);
          setComment('');
          setSavedComment('');
          setIsReprocessing(false);
          // 3. Reset view to survey management
          setView('overview');
        }}
      />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">

          {/* ?? Overview ?? */}
          {view === 'overview' && (
            <MadurezOverview
              pmoType={pmoType}
              totalCount={totalCount}
              doneCount={doneCount}
              allDone={allDone}
              needsPredictiva={needsPredictiva}
              needsAgil={needsAgil}
              predictivaManager={predictivaManager}
              agilManager={agilManager}
              onSend={handleSend}
            />
          )}

          {/* ?? Processing Overlay ?? */}
          {view === 'processing' && (
            <ProcessingOverlay isReprocessing={isReprocessing} pmoType={pmoType} />
          )}

          {/* ── Results ── */}
          {view === 'results' && results && (
            <MadurezDiagnosisView
              results={results}
              pmoType={pmoType}
              pmoColor={pmoCfg.color}
              comment={comment}
              savedComment={savedComment}
              isSavingComment={isSavingComment}
              isReprocessing={isReprocessing}
              onCommentChange={setComment}
              onSaveComment={handleSaveComment}
              onReprocess={handleReprocess}
              onApprove={() => setShowApproveModal(true)}
            />
          )}

          {view === 'approved' && results && (
            <MadurezDiagnosisView
              results={results}
              pmoType={pmoType}
              pmoColor={pmoCfg.color}
              approved
              completedAt={phase.completedAt}
            />
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
