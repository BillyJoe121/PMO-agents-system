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

const PHASE7_PROGRESS_STEPS = [
  { key: 'part_1a', stage: 'part_1a', label: '7.1A - Introduccion, objetivo y alcance' },
  { key: 'part_1b', stage: 'part_1b', label: '7.1B - Responsables, marco conceptual y marco de referencia' },
  { key: 'part_1c', stage: 'part_1c', label: '7.1C - Politicas, roles y comites' },
  { key: 'part_2a', stage: 'part_2a', label: '7.2A - Flujos de inicio y planificacion' },
  { key: 'part_2b', stage: 'part_2b', label: '7.2B - Flujos de ejecucion, monitoreo, control y cierre' },
  { key: 'part_2c', stage: 'part_2c', label: '7.2C - Indicadores predictivos y de control' },
  { key: 'part_2d', stage: 'part_2d', label: '7.2D - Indicadores agiles, valor y adopcion' },
  { key: 'part_2e', stage: 'part_2e', label: '7.2E - Documentos de inicio, planificacion y ejecucion' },
  { key: 'part_2f', stage: 'part_2f', label: '7.2F - Documentos de seguimiento, control, cierre y mejora' },
];

type Phase7Progress = {
  current: number;
  total: number;
  label: string;
  detail?: string;
};

function getPhase7Progress(data: any): Phase7Progress {
  const total = PHASE7_PROGRESS_STEPS.length;
  const parts = data?._parts ?? {};
  const completed = PHASE7_PROGRESS_STEPS.filter(step => parts?.[step.key]?.status === 'success').length;
  const stage = typeof data?.stage === 'string' ? data.stage : '';
  const activeIndex = PHASE7_PROGRESS_STEPS.findIndex(step => step.stage === stage);
  const nextIndex = activeIndex >= 0 ? activeIndex : Math.min(total - 1, completed);
  const current = Math.min(total, Math.max(1, Math.max(completed + 1, nextIndex + 1)));
  const active = PHASE7_PROGRESS_STEPS[Math.min(total - 1, current - 1)];

  return {
    current,
    total,
    label: active.label,
    detail: data?.message || (completed > 0 ? `${completed} subpartes completadas` : 'Preparando la primera subparte'),
  };
}

function logPhase7(event: string, details: Record<string, unknown> = {}) {
  console.info(`[PMO][Phase7][${event}]`, {
    at: new Date().toISOString(),
    ...details,
  });
}

// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function GuiaMetodologicaView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, isLoading } = useApp();
  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 7);
  const phase4 = project?.phases.find(p => p.number === 4);

  const pmoType = parsePmoType(phase4?.agentData ?? phase4?.agentDiagnosis);

  const deriveView = (): ModuleView => {
    if (!project || !phase) return 'processing';
    if ((phase.agentData as any)?._error) return 'error';
    if (phase.status === 'error') return 'error';
    if (phase.status === 'completado' && hasUsableGuidePayload(phase.agentData)) return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (hasUsableGuidePayload(phase.agentData)) return 'results';
    return 'auto-trigger';
  };

  const [view, setView] = useState<ModuleView>(deriveView);
  const [processingStep, setProcessingStep] = useState(1);
  const [phase7Progress, setPhase7Progress] = useState<Phase7Progress>(() => getPhase7Progress(null));
  const [isAdjustment, setIsAdjustment] = useState(false);
  const [chapters, setChapters] = useState<GuideChapter[]>(() => normalizeChapters(unwrapGuidePayload(phase?.agentData)));
  const [versions, setVersions] = useState<DocVersion[]>(() => versionsFromPayload(phase?.agentData));
  const [currentVersionIdx, setCurrentVersionIdx] = useState(0);
  const [adjustText, setAdjustText] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const autoTriggered = useRef(false);
  const hasFailed = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(0);
  const pollTimeoutStartRef = useRef(0);
  const transientRetryCountRef = useRef(0);
  const transientRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAgentRequestRef = useRef<{ iteration: number; comments: string | null } | null>(null);
  const guideFinishedRef = useRef(false);
  const stageTriggerRef = useRef<Record<string, boolean>>({});
  const lastPollSignatureRef = useRef('');
  const approvalCommittedRef = useRef(false);

  const currentVersion = versions[currentVersionIdx] ?? null;

  const applyGuidePayload = useCallback((raw: any) => {
    const current = unwrapGuidePayload(raw);
    const nextChapters = normalizeChapters(current);
    if (nextChapters.length === 0) {
      logPhase7('apply_payload_failed_empty_chapters', {
        projectId,
        rawKeys: raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 12) : typeof raw,
      });
      return false;
    }
    const nextVersions = versionsFromPayload(raw);
    logPhase7('apply_payload_ok', {
      projectId,
      chapters: nextChapters.length,
      versions: nextVersions.length,
    });
    setChapters(nextChapters);
    setVersions(nextVersions);
    setCurrentVersionIdx(Math.max(0, nextVersions.length - 1));
    return true;
  }, [projectId]);

  const finishGuideGeneration = useCallback((raw: any, status: 'disponible' | 'completado' = 'disponible') => {
    if (guideFinishedRef.current) return true;
    const ok = applyGuidePayload(raw);
    if (!ok) return false;

    logPhase7('finish_generation', {
      projectId,
      status,
    });
    guideFinishedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setIsAdjusting(false);
    setErrorMessage('');
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
    logPhase7('poll_start', { projectId, startedAt, forceRestart });
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

      toast.info(`La IA esta saturada. Reintentando Agente 7 (${attempt}/${MAX_TRANSIENT_GEMINI_RETRIES})...`, {
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

    const triggerQueuedStage = async (stage: 'part1' | 'part2', runId: string, queueSignature: string) => {
      const key = `${runId}:${stage}:${queueSignature}`;
      if (stageTriggerRef.current[key]) return;
      stageTriggerRef.current[key] = true;

      try {
        const request = lastAgentRequestRef.current ?? { iteration: 1, comments: null };
        logPhase7('trigger_stage', { projectId, stage, runId, queueSignature, iteration: request.iteration });
        const { error } = await supabase.functions.invoke('pmo-agent', {
          body: {
            projectId,
            phaseNumber: 7,
            phase7Stage: stage,
            runId,
            iteration: request.iteration,
            comments: request.comments,
          },
        });
        if (error) throw new Error(error.message);
        logPhase7('trigger_stage_response_ok', { projectId, stage, runId, queueSignature });
      } catch (err) {
        delete stageTriggerRef.current[key];
        logPhase7('trigger_stage_error', { projectId, stage, runId, queueSignature, message: err instanceof Error ? err.message : String(err) });
      }
    };

    const poll = async () => {
      if (Date.now() - pollTimeoutStartRef.current > 30 * 60 * 1000) {
        const message = 'El Agente 7 tardo demasiado en responder. La ejecucion se marco como fallida para evitar dejar la fase pegada.';
        logPhase7('poll_timeout', { projectId, elapsedMs: Date.now() - pollTimeoutStartRef.current });
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        hasFailed.current = true;
        setErrorMessage(message);
        setView(chapters.length > 0 ? 'results' : 'error');
        updatePhaseStatus(projectId, 7, 'error');
        await supabase
          .from('fases_estado')
          .update({
            estado_visual: 'error',
            datos_consolidados: {
              _error: true,
              message,
              phaseNumber: 7,
              stage: 'frontend_poll_timeout',
              timestamp: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('proyecto_id', projectId)
          .eq('numero_fase', 7);
        toast.error('El Agente 7 tardo demasiado en responder.', {
          description: 'La fase quedo marcada con error para reintentar sin dejar marcadores viejos.',
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
      setPhase7Progress(getPhase7Progress(phase7Data));
      const lastUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
      const staleProcessingMs = Date.now() - lastUpdatedAt;
      const pollSignature = [
        data?.estado_visual ?? 'unknown',
        phase7Data?.stage ?? 'no-stage',
        phase7Data?._run_id ?? 'no-run',
        data?.updated_at ?? 'no-updated',
      ].join('|');
      if (pollSignature !== lastPollSignatureRef.current) {
        lastPollSignatureRef.current = pollSignature;
        logPhase7('poll_state', {
          projectId,
          estado_visual: data?.estado_visual,
          stage: phase7Data?.stage ?? null,
          runId: phase7Data?._run_id ?? null,
          message: phase7Data?.message ?? null,
          updated_at: data?.updated_at ?? null,
          staleProcessingMs,
          hasPart1: Boolean(phase7Data?._parts?.part_1),
          hasPart2: Boolean(phase7Data?._parts?.part_2),
        });
      }
      if (
        data?.estado_visual === 'procesando' &&
        phase7Data?._processing === true &&
        phase7Data?._run_id &&
        lastUpdatedAt > 0
      ) {
        if ((phase7Data.stage === 'part_1_queued' || phase7Data.stage === 'part_1_combine_queued') && staleProcessingMs > 12_000) {
          void triggerQueuedStage('part1', String(phase7Data._run_id), `${phase7Data.stage}:${data.updated_at}`);
        }
        if ((phase7Data.stage === 'part_2_queued' || phase7Data.stage === 'part_2_combine_queued') && staleProcessingMs > 12_000) {
          void triggerQueuedStage('part2', String(phase7Data._run_id), `${phase7Data.stage}:${data.updated_at}`);
        }
        if (typeof phase7Data.stage === 'string' && phase7Data.stage.startsWith('part_1') && staleProcessingMs > 5 * 60 * 1000) {
          void triggerQueuedStage('part1', String(phase7Data._run_id), `${phase7Data.stage}:${data.updated_at}`);
        }
        if (typeof phase7Data.stage === 'string' && phase7Data.stage.startsWith('part_2') && staleProcessingMs > 5 * 60 * 1000) {
          void triggerQueuedStage('part2', String(phase7Data._run_id), `${phase7Data.stage}:${data.updated_at}`);
        }
      }
      if (
        data?.estado_visual === 'procesando' &&
        (!data?.datos_consolidados || phase7Data?._processing === true) &&
        lastUpdatedAt > 0 &&
        staleProcessingMs > 30 * 60 * 1000
      ) {
        const message = `La ejecucion anterior del Agente 7 quedo sin actividad en ${phase7Data?.stage ?? 'processing'}.`;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        hasFailed.current = true;
        setErrorMessage(message);
        setView('error');
        updatePhaseStatus(projectId, 7, 'error');
        await supabase
          .from('fases_estado')
          .update({
            estado_visual: 'error',
            datos_consolidados: {
              _error: true,
              message,
              phaseNumber: 7,
              stage: phase7Data?.stage ?? 'stale_processing',
              _run_id: phase7Data?._run_id ?? null,
              _parts: phase7Data?._parts ?? {},
              timestamp: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('proyecto_id', projectId)
          .eq('numero_fase', 7);
        toast.error('La ejecucion anterior del Agente 7 quedo sin actividad.', {
          description: 'La fase quedo marcada con error para que puedas reintentar limpiamente.',
          duration: 9000,
        });
        return;
      }

      if (data?.datos_consolidados && (data.estado_visual === 'disponible' || data.estado_visual === 'completado')) {
        if ((data.datos_consolidados as any)?._error) {
          const message = (data.datos_consolidados as any)?.message || 'Revise el prompt del Agente 7 e intente nuevamente.';
          logPhase7('poll_error_payload', { projectId, message });
          if (scheduleTransientRetry(message)) return;
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsAdjusting(false);
          hasFailed.current = true;
          setErrorMessage(message);
          setView(chapters.length > 0 ? 'results' : 'error');
          updatePhaseStatus(projectId, 7, 'error');
          toast.error('El Agente 7 encontro un error.', { description: message, duration: 9000 });
          return;
        }
        if (!finishGuideGeneration(data.datos_consolidados, data.estado_visual === 'completado' ? 'completado' : 'disponible')) {
          logPhase7('poll_result_unusable', { projectId, estado_visual: data.estado_visual });
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
        logPhase7('poll_available_without_data', { projectId });
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        hasFailed.current = true;
        setErrorMessage('El Agente 7 no genero datos. Revisa el prompt o intenta nuevamente.');
        setView('error');
        toast.error('El Agente 7 no genero datos. Revisa el prompt o intenta nuevamente.');
      }

      if (data?.estado_visual === 'error') {
        const message = (data?.datos_consolidados as any)?.message || 'Revise el prompt del Agente 7 e intente nuevamente.';
        logPhase7('poll_error_state', { projectId, message });
        if (scheduleTransientRetry(message)) return;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        hasFailed.current = true;
        setErrorMessage(message);
        setView(chapters.length > 0 ? 'results' : 'error');
        updatePhaseStatus(projectId, 7, 'error');
        toast.error('El Agente 7 encontro un error.', { description: message, duration: 9000 });
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
  }, [chapters.length, finishGuideGeneration, projectId, updatePhaseStatus]);

  const invokeAgent7 = useCallback(async (iteration = 1, comments: string | null = null) => {
    if (!projectId) return;
    const startedAt = Date.now();
    logPhase7('invoke_start', { projectId, iteration, hasComments: Boolean(comments) });
    pollStartRef.current = startedAt;
    transientRetryCountRef.current = 0;
    if (transientRetryTimeoutRef.current) clearTimeout(transientRetryTimeoutRef.current);
    transientRetryTimeoutRef.current = null;
    lastAgentRequestRef.current = { iteration, comments };
    guideFinishedRef.current = false;
    stageTriggerRef.current = {};
    hasFailed.current = false;
    setErrorMessage('');
    setPhase7Progress(getPhase7Progress(null));

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
    logPhase7('invoke_marked_processing', { projectId, iteration });

    updatePhaseStatus(projectId, 7, 'procesando');
    setView('processing');
    setProcessingStep(1);
    setPhase7Progress(getPhase7Progress(null));
    startPolling(startedAt, true);
    try {
      const { data, error } = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 7, iteration, comments },
      });
      if (error) throw new Error(error.message);
      logPhase7('invoke_response', {
        projectId,
        iteration,
        inProgress: Boolean((data as any)?.inProgress),
        stage: (data as any)?.stage ?? null,
        cached: Boolean((data as any)?.cached),
      });
      const agentPayload = (data as any)?.data ?? (data as any)?.diagnosis;
      if (agentPayload && !(data as any)?.inProgress && finishGuideGeneration(agentPayload, 'disponible')) return;
      startPolling(startedAt, true);
    } catch (err: any) {
      logPhase7('invoke_error', { projectId, iteration, message: err?.message ?? String(err) });
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
      hasFailed.current = true;
      setErrorMessage(err.message);
      setView(versions.length > 0 ? 'results' : 'error');
      updatePhaseStatus(projectId, 7, 'error');
      toast.error('Error iniciando Agente 7', { description: err.message });
    }
  }, [finishGuideGeneration, projectId, startPolling, updatePhaseStatus, versions.length]);

  // ── Processing: advance steps then show results ───────────────────────────
  useEffect(() => {
    logPhase7('view_changed', {
      projectId,
      view,
      phaseStatus: phase?.status ?? null,
      chapters: chapters.length,
      versions: versions.length,
    });
  }, [chapters.length, phase?.status, projectId, versions.length, view]);

  useEffect(() => {
    if (view !== 'processing') return;
    const interval = setInterval(() => {
      setProcessingStep(prev => Math.min(PROCESSING_STEPS.length, prev + 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (phase?.agentData && chapters.length === 0 && hasUsableGuidePayload(phase.agentData)) {
      applyGuidePayload(phase.agentData);
    }
  }, [phase?.agentData, chapters.length, applyGuidePayload]);

  useEffect(() => {
    if (!project || !phase) return;
    if (isAdjusting && view === 'processing') return;

    if ((phase.agentData as any)?._error) {
      const message = (phase.agentData as any)?.message ?? 'El Agente 7 encontro un error.';
      logPhase7('phase_payload_error', { projectId, message });
      hasFailed.current = true;
      setErrorMessage(message);
      setView(chapters.length > 0 ? 'results' : 'error');
      return;
    }

    if (phase.status === 'error') {
      const message = (phase.agentData as any)?.message ?? 'El Agente 7 encontro un error.';
      logPhase7('phase_state_error', { projectId, message });
      hasFailed.current = true;
      setErrorMessage(message);
      setView(chapters.length > 0 ? 'results' : 'error');
      return;
    }

    if (hasUsableGuidePayload(phase.agentData)) {
      logPhase7('phase_state_has_usable_payload', { projectId, phaseStatus: phase.status });
      applyGuidePayload(phase.agentData);
      setView(approvalCommittedRef.current || phase.status === 'completado' ? 'approved' : 'results');
      return;
    }

    if (phase.status === 'procesando') {
      logPhase7('phase_state_processing_resume_poll', { projectId });
      setView('processing');
      startPolling(0);
      return;
    }

    if (phase.status === 'completado') {
      logPhase7('phase_completed_without_payload', { projectId });
      setView(chapters.length > 0 ? 'approved' : 'auto-trigger');
      return;
    }

    if (phase.status === 'disponible') {
      logPhase7('phase_available_waiting_auto_trigger', { projectId });
      setView(approvalCommittedRef.current && chapters.length > 0 ? 'approved' : chapters.length > 0 ? 'results' : 'auto-trigger');
    }
  }, [applyGuidePayload, chapters.length, isAdjusting, phase, project, startPolling, view]);

  // hasFailed prevents re-triggering after a parse failure (would cause infinite loop)
  useEffect(() => {
    if (!project || !phase || isLoading) return;
    if (phase.status !== 'disponible') return;
    if (autoTriggered.current || hasFailed.current || view !== 'auto-trigger' || chapters.length > 0) return;
    if ((phase.agentData as any)?._error) return;
    if (hasUsableGuidePayload(phase.agentData)) return;
    autoTriggered.current = true;
    logPhase7('auto_trigger_conditions_met', { projectId });
    invokeAgent7(1, null);
  }, [chapters.length, invokeAgent7, isLoading, phase, project, view]);

  useEffect(() => {
    logPhase7('mount', {
      projectId,
      initialPhaseStatus: phase?.status ?? null,
      hasAgentData: Boolean(phase?.agentData),
    });
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
    logPhase7('request_adjustments', {
      projectId,
      currentVersion: currentVersion?.number ?? null,
      commentChars: adjustText.trim().length,
    });
    setIsAdjusting(true);
    setIsAdjustment(true);
    const nextIteration = (currentVersion?.number ?? versions.length) + 1;
    const comment = adjustText;
    setAdjustText('');
    await invokeAgent7(nextIteration, comment);
  };

  const handleRetry = async () => {
    if (!projectId) return;
    logPhase7('retry_clicked', { projectId });
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    hasFailed.current = false;
    approvalCommittedRef.current = false;
    autoTriggered.current = true;
    guideFinishedRef.current = false;
    stageTriggerRef.current = {};
    setErrorMessage('');
    setView('processing');
    setProcessingStep(1);
    setPhase7Progress(getPhase7Progress(null));
    await invokeAgent7(1, null);
  };

  const handleReprocess = async () => {
    if (!adjustText.trim()) { toast.error('Escriba un comentario para reprocesar.'); return; }
    logPhase7('manual_reprocess', {
      projectId,
      currentVersion: currentVersion?.number ?? null,
      commentChars: adjustText.trim().length,
    });
    const nextIteration = (currentVersion?.number ?? versions.length) + 1;
    const comment = adjustText;
    setAdjustText('');
    setIsAdjustment(true);
    setIsAdjusting(true);
    setErrorMessage('');
    hasFailed.current = false;
    approvalCommittedRef.current = false;
    autoTriggered.current = true; // prevent auto-trigger loop during reprocess
    guideFinishedRef.current = false;
    setView('processing');
    setProcessingStep(1);
    setPhase7Progress(getPhase7Progress(null));
    const startedAt = Date.now();
    pollStartRef.current = startedAt;
    transientRetryCountRef.current = 0;
    if (transientRetryTimeoutRef.current) clearTimeout(transientRetryTimeoutRef.current);
    transientRetryTimeoutRef.current = null;
    lastAgentRequestRef.current = { iteration: nextIteration, comments: comment };
    stageTriggerRef.current = {};

    try {
      // 1. Bloquear fases posteriores sin borrar la guía actual.
      // El backend usa el payload previo para conservar el historial de versiones.
      await supabase
        .from('fases_estado')
        .update({ estado_visual: 'bloqueado', datos_consolidados: null, updated_at: new Date().toISOString() })
        .eq('proyecto_id', projectId!)
        .gt('numero_fase', 7);
      logPhase7('manual_reprocess_later_phases_blocked', { projectId });

      // 2. Update DB to 'procesando' BEFORE invoking so cancellation check passes.
      // Also clear datos_consolidados to remove stale _processing markers.
      await supabase
        .from('fases_estado')
        .update({ estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7);
      logPhase7('manual_reprocess_marked_processing', { projectId, iteration: nextIteration });

      updatePhaseStatus(projectId!, 7, 'procesando');
      startPolling(startedAt, true);

      // 3. Invoke the agent; polling will detect completion
      const { data, error } = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 7, iteration: nextIteration, comments: comment },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      logPhase7('manual_reprocess_invoke_response', {
        projectId,
        iteration: nextIteration,
        inProgress: Boolean((data as any)?.inProgress),
        stage: (data as any)?.stage ?? null,
      });
      const agentPayload = (data as any)?.data ?? (data as any)?.diagnosis;
      if (agentPayload && !(data as any)?.inProgress && finishGuideGeneration(agentPayload, 'disponible')) return;

      toast.info('Reprocesando guía metodológica…', {
        description: 'El Agente 7 está incorporando las instrucciones del consultor.',
      });
    } catch (e) {
      logPhase7('manual_reprocess_error', { projectId, message: e instanceof Error ? e.message : String(e) });
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
    logPhase7('approve_clicked', {
      projectId,
      currentVersion: currentVersion?.number ?? null,
      chapters: chapters.length,
    });
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
      approvalCommittedRef.current = true;

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

  if (view === 'error') {
    return (
      <div className="h-screen bg-[#f7f8ff] flex flex-col overflow-hidden">
        <PhaseHeader
          projectId={projectId!}
          companyName={project.companyName}
          phaseNumber={7}
          phaseName="Construcción guía metodológica"
          eyebrow="Revision requerida"
        />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-orange-600 mb-3" style={{ fontWeight: 700 }}>
              Agente detenido
            </p>
            <h2 className="text-neutral-900 mb-3" style={{ fontWeight: 600, fontSize: '1.6rem' }}>
              La Fase 7 no pudo completar la guia
            </h2>
            <p className="text-neutral-500 text-sm leading-relaxed mb-7">
              {errorMessage || 'Revisa la consola del navegador y los logs de Supabase para ver el ultimo paso registrado.'}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-[#5454e9] text-white text-sm"
              style={{ fontWeight: 600 }}
            >
              Reintentar Agente 7
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          phaseName="Construcción guía metodológica"
        />
        <ProcessingView steps={PROCESSING_STEPS} currentStep={processingStep} isAdjustment={false} phaseProgress={phase7Progress} />
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
          phaseName="Construcción guía metodológica"
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProcessingView steps={PROCESSING_STEPS} currentStep={processingStep} isAdjustment={isAdjustment} phaseProgress={phase7Progress} />
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
        phaseName="Construcción guía metodológica"
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
