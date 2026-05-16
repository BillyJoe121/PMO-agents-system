/**
 * GuiaMetodologicaView — Fase 7: Guía Metodológica
 *
 * RF-F7-01  Al desbloquearse la Fase 7, envía automáticamente al Agente 7 el JSON
 *           aprobado de la Fase 6. No requiere acción inicial del consultor.
 * RF-F7-02  Estado de procesamiento extendido con pasos animados y mensaje claro de
 *           duración ("esto puede tomar unos minutos").
 * RF-F7-03  Vista de resultado: visor de documento A4, botones "Ver" y "Descargar".
 * RF-F7-04  Comentarios y regeneración: "Solicitar ajustes" envía guía + comentario
 *           al Agente 7 y reemplaza la versión anterior.
 * RF-F7-05  Indicador de versión: "Versión 1 — generada el [fecha]", "Versión 2 —
 *           revisada el [fecha] con comentarios del consultor".
 * RF-F7-06  "Aprobar Guía Metodológica" → Fase 7 completada + desbloquea Fase 8.
 *
 * TODO: RF-F7-01 → axios.post(N8N_WEBHOOK_AGENTE_7, { json_fase6_aprobado })
 * TODO: RF-F7-04 → axios.post(N8N_WEBHOOK_AGENTE_7, { version_actual, comentario })
 * TODO: RF-F7-03 → iframe apuntando a signedUrl de Supabase Storage (PDF/DOCX real)
 * TODO: RF-F7-06 → supabase.from('fases_resultado').upsert({ fase: 7, json: { version } })
 */

// @refresh reset
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useSoundManager } from '../../hooks/useSoundManager';
import PhaseHeader from './_shared/PhaseHeader';
import { supabase } from '../../lib/supabase';
import { ApproveModal } from './guia-metodologica/ApproveModal';
import { DocumentRenderer } from './guia-metodologica/DocumentRenderer';
import { GuideSidebar } from './guia-metodologica/GuideSidebar';
import { ProcessingView } from './guia-metodologica/ProcessingView';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';
import {
  MAX_TRANSIENT_GEMINI_RETRIES,
  PROCESSING_STEPS,
  TRANSIENT_GEMINI_RETRY_DELAYS,
  isTransientGeminiError,
  parsePmoType,
} from './guia-metodologica/guideContent';
import { hasUsableGuidePayload, normalizeChapters, unwrapGuidePayload, versionsFromPayload } from './guia-metodologica/normalizeGuide';
import type { DocVersion, GuideChapter, ModuleView } from './guia-metodologica/types';
// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function GuiaMetodologicaView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, isLoading } = useApp();
  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase    = project?.phases.find(p => p.number === 7);
  const phase4   = project?.phases.find(p => p.number === 4);

  const pmoType      = parsePmoType(phase4?.agentData ?? phase4?.agentDiagnosis);

  const deriveView = (): ModuleView => {
    if (!project || !phase) return 'processing';
    if (phase.status === 'completado' && hasUsableGuidePayload(phase.agentData)) return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (hasUsableGuidePayload(phase.agentData)) return 'results';
    return 'auto-trigger';
  };

  const [view, setView]                     = useState<ModuleView>(deriveView);
  const [processingStep, setProcessingStep] = useState(1);
  const [isAdjustment, setIsAdjustment]     = useState(false);
  const [chapters, setChapters]             = useState<GuideChapter[]>(() => normalizeChapters(unwrapGuidePayload(phase?.agentData)));
  const [versions, setVersions]             = useState<DocVersion[]>(() => versionsFromPayload(phase?.agentData));
  const [currentVersionIdx, setCurrentVersionIdx] = useState(0);
  const [adjustText, setAdjustText]         = useState('');
  const [isAdjusting, setIsAdjusting]       = useState(false);
  const [showApprove, setShowApprove]       = useState(false);
  const [isApproving, setIsApproving]       = useState(false);
  const autoTriggered = useRef(false);
  const hasFailed = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(0);
  const pollTimeoutStartRef = useRef(0);
  const transientRetryCountRef = useRef(0);
  const transientRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAgentRequestRef = useRef<{ iteration: number; comments: string | null } | null>(null);
  const guideFinishedRef = useRef(false);

  const currentVersion = versions[currentVersionIdx] ?? null;

  const applyGuidePayload = useCallback((raw: any) => {
    const current = unwrapGuidePayload(raw);
    const nextChapters = normalizeChapters(current);
    if (nextChapters.length === 0) {
      return false;
    }
    const nextVersions = versionsFromPayload(raw);
    setChapters(nextChapters);
    setVersions(nextVersions);
    setCurrentVersionIdx(Math.max(0, nextVersions.length - 1));
    return true;
  }, []);

  const finishGuideGeneration = useCallback((raw: any, status: 'disponible' | 'completado' = 'disponible') => {
    if (guideFinishedRef.current) return true;
    const ok = applyGuidePayload(raw);
    if (!ok) return false;

    guideFinishedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setIsAdjusting(false);
    transientRetryCountRef.current = 0;
    setView(status === 'completado' ? 'approved' : 'results');
    updatePhaseStatus(projectId!, 7, status);
    playAgentSuccess();
    toast.success('Agente 7 genero la guia metodologica', {
      description: 'El documento quedo listo para revision.',
    });
    return true;
  }, [applyGuidePayload, playAgentSuccess, projectId, updatePhaseStatus]);

  // ── RF-F7-01: Auto-trigger on mount ──────────────────────────────────────
  const startPolling = useCallback((startedAt = Date.now(), forceRestart = false) => {
    if (!projectId) return;
    if (pollRef.current && !forceRestart) return;
    if (pollRef.current) clearInterval(pollRef.current);
    guideFinishedRef.current = false;
    pollStartRef.current = startedAt;
    pollTimeoutStartRef.current = Date.now();

    const scheduleTransientRetry = (message: string) => {
      if (
        !isTransientGeminiError(message) ||
        !lastAgentRequestRef.current ||
        transientRetryCountRef.current >= MAX_TRANSIENT_GEMINI_RETRIES
      ) {
        return false;
      }

      const attempt = transientRetryCountRef.current + 1;
      transientRetryCountRef.current = attempt;
      const delay = TRANSIENT_GEMINI_RETRY_DELAYS[attempt - 1] ?? TRANSIENT_GEMINI_RETRY_DELAYS[TRANSIENT_GEMINI_RETRY_DELAYS.length - 1];

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setIsAdjusting(false);
      setView('processing');
      setProcessingStep(1);

      toast.info(`Gemini esta saturado. Reintentando Agente 7 (${attempt}/${MAX_TRANSIENT_GEMINI_RETRIES})...`, {
        description: 'La pantalla seguira en modo de carga y volvera a consultar automaticamente.',
        duration: 7000,
      });

      transientRetryTimeoutRef.current = setTimeout(async () => {
        const retryStartedAt = Date.now();
        pollStartRef.current = retryStartedAt;
        pollTimeoutStartRef.current = retryStartedAt;

        try {
          await supabase
            .from('fases_estado')
            .update({ estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() })
            .eq('proyecto_id', projectId)
            .eq('numero_fase', 7);

          updatePhaseStatus(projectId, 7, 'procesando');
          guideFinishedRef.current = false;
          setView('processing');
          setProcessingStep(1);

          const { data: retryData, error: retryError } = await supabase.functions.invoke('pmo-agent', {
            body: { projectId, phaseNumber: 7, ...lastAgentRequestRef.current },
          });
          if (retryError) throw new Error(retryError.message);

          const retryPayload = (retryData as any)?.data ?? (retryData as any)?.diagnosis;
          if (retryPayload && !(retryData as any)?.inProgress && finishGuideGeneration(retryPayload, 'disponible')) return;
          startPolling(retryStartedAt, true);
        } catch (retryErr: any) {
          setIsAdjusting(false);
          setView(chapters.length > 0 ? 'results' : 'auto-trigger');
          updatePhaseStatus(projectId, 7, 'disponible');
          toast.error('No se pudo reintentar el Agente 7.', { description: retryErr?.message, duration: 9000 });
        }
      }, delay);

      return true;
    };

    const poll = async () => {
      if (Date.now() - pollTimeoutStartRef.current > 8 * 60 * 1000) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView(chapters.length > 0 ? 'results' : 'auto-trigger');
        updatePhaseStatus(projectId, 7, 'disponible');
        toast.error('El Agente 7 tardo demasiado en responder.', {
          description: 'La fase quedo disponible para reintentar la generacion.',
          duration: 9000,
        });
        return;
      }

      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual, updated_at')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7)
        .single();

      if (error) return;
      // Removed: if (data?.updated_at && new Date(data.updated_at).getTime() < pollStartRef.current) return;

      const phase7Data = data?.datos_consolidados as any;
      const lastUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
      const staleProcessingMs = Date.now() - lastUpdatedAt;
      if (
        data?.estado_visual === 'procesando' &&
        (!data?.datos_consolidados || phase7Data?._processing === true) &&
        lastUpdatedAt > 0 &&
        staleProcessingMs > 10 * 60 * 1000
      ) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView('auto-trigger');
        updatePhaseStatus(projectId, 7, 'disponible');
        await supabase
          .from('fases_estado')
          .update({
            estado_visual: 'disponible',
            updated_at: new Date().toISOString(),
          })
          .eq('proyecto_id', projectId)
          .eq('numero_fase', 7);
        toast.error('La ejecucion anterior del Agente 7 quedo sin actividad.', {
          description: 'La fase quedo disponible para intentar generar la guia nuevamente.',
          duration: 9000,
        });
        return;
      }

      if (data?.datos_consolidados && (data.estado_visual === 'disponible' || data.estado_visual === 'completado')) {
        if ((data.datos_consolidados as any)?._error) {
          const message = (data.datos_consolidados as any)?.message || 'Revise el prompt del Agente 7 e intente nuevamente.';
          if (scheduleTransientRetry(message)) return;
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsAdjusting(false);
          setView(chapters.length > 0 ? 'results' : 'auto-trigger');
          updatePhaseStatus(projectId, 7, 'disponible');
          toast.error('El Agente 7 encontro un error.', { description: message, duration: 9000 });
          return;
        }
        if (!finishGuideGeneration(data.datos_consolidados, data.estado_visual === 'completado' ? 'completado' : 'disponible')) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsAdjusting(false);
          hasFailed.current = true; // Prevent auto-retrigger loop
          setView(chapters.length > 0 ? 'results' : 'auto-trigger');
          updatePhaseStatus(projectId, 7, 'disponible');
          return;
        }
        return;
      }

      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView('auto-trigger');
        toast.error('El Agente 7 no genero datos. Revisa el prompt o intenta nuevamente.');
      }

      if (data?.estado_visual === 'error') {
        const message = (data?.datos_consolidados as any)?.message || 'Revise el prompt del Agente 7 e intente nuevamente.';
        if (scheduleTransientRetry(message)) return;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView(chapters.length > 0 ? 'results' : 'auto-trigger');
        updatePhaseStatus(projectId, 7, 'disponible');
        toast.error('El Agente 7 encontro un error.', { description: message, duration: 9000 });
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
  }, [chapters.length, finishGuideGeneration, projectId, updatePhaseStatus]);

  const invokeAgent7 = useCallback(async (iteration = 1, comments: string | null = null) => {
    if (!projectId) return;
    const startedAt = Date.now();
    pollStartRef.current = startedAt;
    transientRetryCountRef.current = 0;
    if (transientRetryTimeoutRef.current) clearTimeout(transientRetryTimeoutRef.current);
    transientRetryTimeoutRef.current = null;
    lastAgentRequestRef.current = { iteration, comments };
    guideFinishedRef.current = false;

    // CRITICAL: Update DB directly BEFORE invoking the edge function.
    // The edge function checks DB estado_visual === 'procesando' before saving results.
    // updatePhaseStatus only updates React context; if the DB still says 'bloqueado',
    // the agent will silently discard its result.
    // Also clear datos_consolidados to remove any stale _processing markers from
    // previous failed/timed-out runs — otherwise the edge function sees _processing:true
    // and returns inProgress:true without actually starting a new run.
    await supabase
      .from('fases_estado')
      .update({ estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() })
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 7);

    updatePhaseStatus(projectId, 7, 'procesando');
    setView('processing');
    setProcessingStep(1);
    startPolling(startedAt, true);
    try {
      const { data, error } = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 7, iteration, comments },
      });
      if (error) throw new Error(error.message);
      const agentPayload = (data as any)?.data ?? (data as any)?.diagnosis;
      if (agentPayload && !(data as any)?.inProgress && finishGuideGeneration(agentPayload, 'disponible')) return;
      startPolling(startedAt, true);
    } catch (err: any) {
      if (isTransientGeminiError(err?.message || '')) {
        setView('processing');
        startPolling(startedAt, true);
        return;
      }
      const { data: stateAfterError } = await supabase
        .from('fases_estado')
        .select('estado_visual, datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7)
        .single();

      if (stateAfterError?.datos_consolidados && stateAfterError.estado_visual !== 'error') {
        if (finishGuideGeneration(stateAfterError.datos_consolidados, stateAfterError.estado_visual === 'completado' ? 'completado' : 'disponible')) return;
      }

      if (stateAfterError?.estado_visual === 'procesando') {
        setView('processing');
        startPolling(startedAt, true);
        toast.info('El Agente 7 sigue en ejecucion.', {
          description: 'Seguiremos monitoreando el resultado en esta pantalla.',
        });
        return;
      }

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setIsAdjusting(false);
      setView(versions.length > 0 ? 'results' : 'auto-trigger');
      updatePhaseStatus(projectId, 7, 'disponible');
      toast.error('Error iniciando Agente 7', { description: err.message });
    }
  }, [finishGuideGeneration, projectId, startPolling, updatePhaseStatus, versions.length]);

  // ── Processing: advance steps then show results ───────────────────────────
  useEffect(() => {
    if (view !== 'processing') return;
    const interval = setInterval(() => {
      setProcessingStep(prev => Math.min(PROCESSING_STEPS.length, prev + 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (phase?.agentData && chapters.length === 0) applyGuidePayload(phase.agentData);
  }, [phase?.agentData, chapters.length, applyGuidePayload]);

  useEffect(() => {
    if (!project || !phase) return;

    if (hasUsableGuidePayload(phase.agentData)) {
      applyGuidePayload(phase.agentData);
      setView(phase.status === 'completado' ? 'approved' : 'results');
      return;
    }

    if (phase.status === 'procesando') {
      setView('processing');
      startPolling(0);
      return;
    }

    if (phase.status === 'completado') {
      setView('auto-trigger');
      return;
    }

    if (phase.status === 'disponible') {
      setView('auto-trigger');
    }
  }, [applyGuidePayload, phase, project, startPolling]);

  // hasFailed prevents re-triggering after a parse failure (would cause infinite loop)
  useEffect(() => {
    if (!project || !phase || isLoading) return;
    if (phase.status !== 'disponible') return;
    if (autoTriggered.current || hasFailed.current || view !== 'auto-trigger' || chapters.length > 0) return;
    if (hasUsableGuidePayload(phase.agentData)) return;
    autoTriggered.current = true;
    invokeAgent7(1, null);
  }, [chapters.length, invokeAgent7, isLoading, phase, project, view]);

  useEffect(() => {
    if (phase?.status === 'procesando') {
      setView('processing');
      startPolling(0);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (transientRetryTimeoutRef.current) clearTimeout(transientRetryTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!project || !phase) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y la guia metodologica..." />
      : <MissingProjectState title="Fase no disponible" description="No pudimos encontrar el proyecto o la guia metodologica." />;
  }

  // ── Remaining handlers (non-hook, safe after guard) ──────────────────────
  const handleRequestAdjustments = async () => {
    if (!adjustText.trim()) { toast.error('Escriba las instrucciones de ajuste antes de enviar.'); return; }
    setIsAdjusting(true);
    setIsAdjustment(true);
    const nextIteration = (currentVersion?.number ?? versions.length) + 1;
    const comment = adjustText;
    setAdjustText('');
    await invokeAgent7(nextIteration, comment);
  };

  const handleReprocess = async () => {
    if (!adjustText.trim()) { toast.error('Escriba un comentario para reprocesar.'); return; }
    const nextIteration = (currentVersion?.number ?? versions.length) + 1;
    const comment = adjustText;
    setAdjustText('');
    setIsAdjustment(true);
    setIsAdjusting(true);
    const startedAt = Date.now();
    pollStartRef.current = startedAt;
    transientRetryCountRef.current = 0;
    if (transientRetryTimeoutRef.current) clearTimeout(transientRetryTimeoutRef.current);
    transientRetryTimeoutRef.current = null;
    lastAgentRequestRef.current = { iteration: nextIteration, comments: comment };

    try {
      // 1. Bloquear fases posteriores sin borrar la guía actual.
      // El backend usa el payload previo para conservar el historial de versiones.
      await supabase
        .from('fases_estado')
        .update({ estado_visual: 'bloqueado', datos_consolidados: null, updated_at: new Date().toISOString() })
        .eq('proyecto_id', projectId!)
        .gt('numero_fase', 7);

      // 2. Update DB to 'procesando' BEFORE invoking so cancellation check passes.
      // Also clear datos_consolidados to remove stale _processing markers.
      await supabase
        .from('fases_estado')
        .update({ estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7);

      updatePhaseStatus(projectId!, 7, 'procesando');
      hasFailed.current = false;
      autoTriggered.current = true; // prevent auto-trigger loop during reprocess
      guideFinishedRef.current = false;
      setView('processing');
      setProcessingStep(1);
      startPolling(startedAt, true);

      // 3. Invoke the agent; polling will detect completion
      const { data, error } = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 7, iteration: nextIteration, comments: comment },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      const agentPayload = (data as any)?.data ?? (data as any)?.diagnosis;
      if (agentPayload && !(data as any)?.inProgress && finishGuideGeneration(agentPayload, 'disponible')) return;

      toast.info('Reprocesando guía metodológica…', {
        description: 'El Agente 7 está incorporando las instrucciones del consultor.',
      });
    } catch (e) {
      console.error('[Phase7] Reprocess error:', e);
      if (isTransientGeminiError(e instanceof Error ? e.message : String(e))) {
        setView('processing');
        startPolling(startedAt, true);
        return;
      }
      const { data } = await supabase
        .from('fases_estado')
        .select('estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7)
        .single();

      if (data?.estado_visual === 'procesando') {
        toast.info('El Agente 7 ya quedó en ejecución.', {
          description: 'Seguiremos monitoreando el resultado en esta pantalla.',
        });
        return;
      }

      toast.error('Error al reprocesar', { description: e instanceof Error ? e.message : undefined });
      setIsAdjusting(false);
      setView('results');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    
    try {
      // Invocamos el Agente 8 para que empiece a procesar los artefactos en background
      updatePhaseStatus(projectId!, 8, 'procesando');
      supabase.functions.invoke('pmo-agent-artefactos', {
        body: { projectId }
      }).catch(e => console.error('[Phase7] Agent 8 trigger failed:', e));

      await new Promise(r => setTimeout(r, 700));
      
      setIsApproving(false);
      setShowApprove(false);

      // RF-F7-06: marca Fase 7 completada + desbloquea Fase 8
      updatePhaseStatus(
        projectId!, 7, 'completado',
        `Guía Metodológica aprobada · Versión ${currentVersion?.number} · PMO ${pmoType} · ${chapters.length} capítulos.`
      );
      
      playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
      setView('approved');
      toast.success('¡Fase 7 aprobada!', { 
        description: 'La Guía Metodológica ha sido completada. El Agente 8 está generando las recomendaciones de artefactos.' 
      });
    } catch (e) {
      console.error('[Phase7] Approval error:', e);
      toast.error('Error al procesar la aprobación');
      setIsApproving(false);
    }
  };

  const isCompleted = view === 'approved';

  // ── Render: auto-trigger → skip straight to processing ───────────────────
  // There is no separate "sending" screen. The moment the component mounts
  // with no data it immediately invokes the agent and shows the processing overlay.
  if (view === 'auto-trigger') {
    return (
      <div className="h-screen bg-[#f7f8ff] flex flex-col overflow-hidden">
        <PhaseHeader
          projectId={projectId!}
          companyName={project.companyName}
          phaseNumber={7}
          phaseName="Guía Metodológica"
        />
        <ProcessingView steps={PROCESSING_STEPS} currentStep={processingStep} isAdjustment={false} />
      </div>
    );
  }



  // ── Render: processing ────────────────────────────────────────────────────
  if (view === 'processing') {
    return (
      <div className="h-screen bg-[#f7f8ff] flex flex-col overflow-hidden">
        <PhaseHeader
          projectId={projectId!}
          companyName={project.companyName}
          phaseNumber={7}
          phaseName="Guía Metodológica"
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProcessingView steps={PROCESSING_STEPS} currentStep={processingStep} isAdjustment={isAdjustment} />
        </div>
      </div>
    );
  }

  // ── Render: results & approved (split layout) ─────────────────────────────
  return (
    <div className="h-screen bg-[#f7f8ff] flex flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={7}
        phaseName="Guía Metodológica"
        eyebrow={isCompleted ? 'Completada' : undefined}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] overflow-hidden print:block print:h-auto print:overflow-visible">

        {/* ── Left: Document Viewer 70% ── */}
        <div className="min-h-0 flex flex-col bg-[#f2f3f7] overflow-hidden print:block print:h-auto print:overflow-visible">

          {/* Document canvas */}
          {/* RF-F7-03: Integrar iframe apuntando a la signedUrl de Supabase Storage (PDF real del Agente 7) */}
          <div className="flex-1 min-h-0 bg-[#f2f3f7] overflow-y-auto overscroll-contain p-4 lg:p-6 relative print:block print:h-auto print:overflow-visible print:p-0 [&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary [&::-webkit-scrollbar-thumb]:rounded-full">

            {/* Adjustment overlay */}
            <AnimatePresence>
              {isAdjusting && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center print:hidden">
                  <Loader2 size={36} className="text-white animate-spin mb-4" />
                  <p className="text-white text-sm" style={{ fontWeight: 600 }}>Enviando ajustes al Agente 7…</p>
                  <p className="text-gray-300 text-xs mt-1">Preparando nueva versión del documento</p>
                </motion.div>
              )}
            </AnimatePresence>

            {currentVersion && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="print:h-auto print:overflow-visible">
                <DocumentRenderer
                  chapters={chapters}
                  org={project.companyName}
                  pmoType={pmoType}
                  version={currentVersion}
                />
              </motion.div>
            )}
          </div>
        </div>

        <GuideSidebar
          versions={versions}
          currentVersionIdx={currentVersionIdx}
          currentVersion={currentVersion}
          adjustText={adjustText}
          isAdjusting={isAdjusting}
          isCompleted={isCompleted}
          completedAt={phase.completedAt}
          onVersionSelect={(version, index) => {
            setCurrentVersionIdx(index);
            if (version.data) setChapters(normalizeChapters(version.data));
          }}
          onAdjustTextChange={setAdjustText}
          onRequestAdjustments={handleRequestAdjustments}
          onReprocess={handleReprocess}
          onApprove={() => setShowApprove(true)}
          onGoPhase6={() => navigate(`/dashboard/project/${projectId}/phase/6`)}
          onGoPhase8={() => navigate(`/dashboard/project/${projectId}/phase/8`)}
        />      </div>

      <ApproveModal
        open={showApprove}
        onCancel={() => setShowApprove(false)}
        onConfirm={handleApprove}
        isLoading={isApproving}
        versionNum={currentVersion?.number ?? 1}
      />


    </div>
  );
}
