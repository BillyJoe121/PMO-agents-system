import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Download, Archive,
  Loader2, AlertTriangle, CheckCircle2, Send, RotateCcw,
  FileSpreadsheet, FileText, File,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import NextPhaseButton from './_shared/NextPhaseButton';
import PhaseHeader from './_shared/PhaseHeader';

interface Artifact {
  id: string;
  name: string;
  description: string;
  format: 'xlsx' | 'docx' | 'pdf';
  size: string;
  category: 'recommended' | 'other';
}

const MOCK_ARTIFACTS: Artifact[] = [
  {
    id: 'a1',
    name: 'Caso de negocio.docx',
    description: 'Justificación económica y estratégica de la iniciativa.',
    format: 'docx',
    size: '112 KB',
    category: 'recommended',
  },
  {
    id: 'a2',
    name: 'Acta de constitución.docx',
    description: 'Documento formal que autoriza la existencia del proyecto.',
    format: 'docx',
    size: '85 KB',
    category: 'recommended',
  },
  {
    id: 'a3',
    name: 'Matriz de interesados.xlsx',
    description: 'Registro de personas u organizaciones afectadas por el proyecto.',
    format: 'xlsx',
    size: '64 KB',
    category: 'recommended',
  },
  {
    id: 'a4',
    name: 'Enunciado de alcance.docx',
    description: 'Descripción detallada de los entregables y límites del proyecto.',
    format: 'docx',
    size: '95 KB',
    category: 'recommended',
  },
  {
    id: 'a5',
    name: 'Cronograma (Sin formato).xlsx',
    description: 'Listado de actividades, hitos y duraciones estimadas.',
    format: 'xlsx',
    size: '142 KB',
    category: 'recommended',
  },
  {
    id: 'a6',
    name: 'Formato de presupuesto.xlsx',
    description: 'Control de costos, egresos y proyecciones financieras.',
    format: 'xlsx',
    size: '98 KB',
    category: 'recommended',
  },
  {
    id: 'a7',
    name: 'Matriz de riesgos.xlsx',
    description: 'Identificación, análisis y plan de respuesta a riesgos.',
    format: 'xlsx',
    size: '76 KB',
    category: 'recommended',
  },
  {
    id: 'a8',
    name: 'Formato de comunicaciones.docx',
    description: 'Plan de distribución de información a los interesados.',
    format: 'docx',
    size: '52 KB',
    category: 'other',
  },
  {
    id: 'a9',
    name: 'Formato de incidencias.xlsx',
    description: 'Registro y seguimiento de problemas surgidos durante la ejecución.',
    format: 'xlsx',
    size: '44 KB',
    category: 'other',
  },
  {
    id: 'a10',
    name: 'Formato de entregables y validación.docx',
    description: 'Plantilla para la aceptación formal de los productos del proyecto.',
    format: 'docx',
    size: '68 KB',
    category: 'recommended',
  },
  {
    id: 'a11',
    name: 'Informe de avance e indicadores.pdf',
    description: 'Reporte periódico de estado con métricas de desempeño.',
    format: 'pdf',
    size: '1.2 MB',
    category: 'recommended',
  },
  {
    id: 'a12',
    name: 'Acta de cierre.docx',
    description: 'Documento que certifica la finalización exitosa del proyecto.',
    format: 'docx',
    size: '58 KB',
    category: 'recommended',
  },
  {
    id: 'a13',
    name: 'Encuesta de satisfacción.docx',
    description: 'Evaluación de la percepción del cliente sobre los resultados.',
    format: 'docx',
    size: '35 KB',
    category: 'other',
  },
  {
    id: 'a14',
    name: 'Matriz de lecciones aprendidas.xlsx',
    description: 'Conocimiento adquirido para mejorar proyectos futuros.',
    format: 'xlsx',
    size: '41 KB',
    category: 'other',
  },
];

function normalizeArtifactName(value: string): string {
  return value
    .replace(/\.(docx|xlsx|pdf)$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapArtifactsFromAgentData(agentData: any): Artifact[] {
  const data = agentData?._current ?? agentData?.data ?? agentData?.diagnosis ?? agentData;
  const recommended = Array.isArray(data?.artefactos_recomendados)
    ? data.artefactos_recomendados
    : [];
  const recommendedSet = new Set(recommended.map((name: string) => normalizeArtifactName(name)));

  return MOCK_ARTIFACTS.map(artifact => {
    const baseName = artifact.name.replace(/\.(docx|xlsx|pdf)$/i, '');
    const isRecommended =
      recommendedSet.has(normalizeArtifactName(baseName)) ||
      recommendedSet.has(normalizeArtifactName(artifact.name));

    return {
      ...artifact,
      category: isRecommended ? 'recommended' as const : 'other' as const,
    };
  });
}

function FormatIcon({ format }: { format: Artifact['format'] }) {
  if (format === 'xlsx') return <FileSpreadsheet size={28} className="text-neutral-900" />;
  if (format === 'docx') return <FileText size={28} className="text-neutral-700" />;
  return <File size={28} className="text-neutral-500" />;
}

function FormatBadge({ format }: { format: Artifact['format'] }) {
  const styles = {
    xlsx: 'bg-neutral-900 text-white',
    docx: 'bg-neutral-200 text-neutral-800',
    pdf: 'bg-neutral-100 text-neutral-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wide ${styles[format]}`} style={{ fontWeight: 600 }}>
      {format}
    </span>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow h-full"
    >
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <FormatIcon format={artifact.format} />
        </div>
        <FormatBadge format={artifact.format} />
      </div>
      <div className="flex-1">
        <p className="text-gray-800 text-sm leading-snug mb-1" style={{ fontWeight: 600 }}>{artifact.name}</p>
        <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2">{artifact.description}</p>
        <p className="text-gray-400 text-[10px] mt-1">{artifact.size}</p>
      </div>
      <div className="flex gap-2 pt-1 border-t border-gray-100 mt-auto">
        <button
          className="flex-1 py-2 rounded-lg text-white text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
          style={{ background: '#030213', fontWeight: 500 }}
        >
          <Download size={12} />Descargar
        </button>
      </div>
    </motion.div>
  );
}

function ConfirmFinalModal({
  open, onCancel, onConfirm, isLoading,
}: { open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-neutral-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-2" style={{ fontWeight: 600 }}>Cierre definitivo del proyecto</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Está a punto de aprobar los artefactos y cerrar definitivamente el proyecto.
                  <strong className="text-gray-700"> No se permitirán más modificaciones.</strong> ¿Desea proceder?
                </p>
              </div>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 mb-5 text-xs text-neutral-600 leading-relaxed">
              Esta acción cerrará el proyecto. Esta operación es irreversible.
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#0a0a0a', fontWeight: 600 }}
              >
                {isLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Cerrando...</>
                  : <><Send size={14} /> Sí, completar proyecto</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function ArtefactosView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 8);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [hasLoadedArtifacts, setHasLoadedArtifacts] = useState(false);
  const [realArtifacts, setRealArtifacts] = useState<Artifact[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 8)
        .single();

      if (data?.estado_visual === 'disponible' && data.datos_consolidados) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        const res = data.datos_consolidados as any;
        setRealArtifacts(mapArtifactsFromAgentData(res));
        setHasLoadedArtifacts(true);
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 8, 'disponible');
        toast.success('¡Catálogo de artefactos listo!', { description: 'El Agente 8 ha finalizado las recomendaciones.' });
      } else if (data?.estado_visual === 'error') {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setHasLoadedArtifacts(true);
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 8, 'disponible');
        toast.error('Error en el Agente 8', { description: 'No se pudo generar el catálogo. Intente aprobar la fase 7 nuevamente.' });
      }
    }, 4000);
  }, [projectId, updatePhaseStatus]);

  const loadPhase8State = useCallback(async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from('fases_estado')
      .select('datos_consolidados, estado_visual')
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 8)
      .single();

    if (data?.estado_visual === 'procesando') {
      updatePhaseStatus(projectId, 8, 'procesando');
      setHasLoadedArtifacts(true);
      startPolling();
      return;
    }

    if (data?.datos_consolidados && data.estado_visual !== 'error') {
      setRealArtifacts(mapArtifactsFromAgentData(data.datos_consolidados));
      setHasLoadedArtifacts(true);
      updatePhaseStatus(projectId, 8, data.estado_visual === 'completado' ? 'completado' : 'disponible');
      return;
    }

    setRealArtifacts(MOCK_ARTIFACTS.map(a => ({ ...a, category: 'other' })));
    setHasLoadedArtifacts(true);
  }, [projectId, startPolling, updatePhaseStatus]);

  const handleReprocessAgent8 = useCallback(async () => {
    if (!projectId) return;

    setIsReprocessing(true);
    setHasLoadedArtifacts(true);
    setRealArtifacts([]);
    updatePhaseStatus(projectId, 8, 'procesando');
    startPolling();

    try {
      const { data, error } = await supabase.functions.invoke('pmo-agent-artefactos', {
        body: { projectId },
      });

      if (error) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsReprocessing(false);
        updatePhaseStatus(projectId, 8, 'disponible');
        toast.error('No se pudo iniciar el Agente 8', { description: error.message });
        return;
      }

      if ((data as any)?.data) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRealArtifacts(mapArtifactsFromAgentData((data as any).data));
        setIsReprocessing(false);
        setHasLoadedArtifacts(true);
        updatePhaseStatus(projectId, 8, 'disponible');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setIsReprocessing(false);
      updatePhaseStatus(projectId, 8, 'disponible');
      toast.error('No se pudo iniciar el Agente 8', { description: message });
    }
  }, [projectId, startPolling, updatePhaseStatus]);

  useEffect(() => {
    if (phase?.status === 'procesando') {
      setHasLoadedArtifacts(true);
      startPolling();
    } else if (phase?.agentData) {
      const res = phase.agentData as any;
      setRealArtifacts(mapArtifactsFromAgentData(res));
      setHasLoadedArtifacts(true);
    } else if (!hasLoadedArtifacts) {
      loadPhase8State();
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase?.status, phase?.agentData, hasLoadedArtifacts, startPolling, loadPhase8State]);

  if (!project || !phase) return null;

  const isCompleted = phase.status === 'completado';

  const handleFinalApprove = async () => {
    setIsSending(true);
    // TODO: Mutación real -> update public.proyectos set fecha_cierre = NOW()
    setIsSending(false);
    setShowConfirm(false);
    updatePhaseStatus(projectId!, 8, 'completado',
      'Paquete de artefactos aprobado. Proyecto cerrado exitosamente. Todos los entregables han sido entregados al cliente.');
    toast.success('¡Proyecto completado!', { description: 'Todos los artefactos fueron aprobados.' });
    navigate(`/dashboard/project/${projectId}`);
  };

  const isProcessing = phase.status === 'procesando' || isSending || isReprocessing;

  const renderProcessing = () => (
    <AnimatePresence>
      {isProcessing && (
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
            {isSending ? 'Finalizando' : 'Fase 8 · Agente 8'}
          </p>
          <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
            {isSending ? 'Cerrando proyecto' : 'Generando catálogo de artefactos'}
          </h2>
          <p className="text-neutral-500 text-[13px] mt-2 max-w-sm text-center">
            {isSending
              ? 'Consolidando el paquete final y registrando el cierre...'
              : 'El Agente 8 está analizando la Guía Metodológica para recomendar los mejores artefactos para su PMO...'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const recommendedArtifacts = realArtifacts.filter(a => a.category === 'recommended');
  const otherArtifacts = realArtifacts.filter(a => a.category === 'other');
  const hasEmptyRecommendations = hasLoadedArtifacts && !isProcessing && recommendedArtifacts.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {renderProcessing()}

      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={8}
        phaseName="Artefactos y Entrega Final"
        eyebrow={isCompleted ? 'Completada' : undefined}
        onReprocessed={handleReprocessAgent8}
      />

      {/* Split Layout */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

        {/* ── Left: Artifacts Grid (col-span-8) ── */}
        <div className="col-span-8 flex flex-col border-r border-gray-200 overflow-hidden">
          {/* Section Header */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Paquete de Artefactos de Soporte</h2>
              <p className="text-gray-500 text-sm mt-0.5">{MOCK_ARTIFACTS.length} archivos generados para este proyecto</p>
            </div>
            <div className="flex items-center gap-2">

              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
                style={{ background: '#030213', fontWeight: 600 }}
              >
                <Archive size={15} />
                Descargar todos (ZIP)
              </button>
            </div>
          </div>

          {/* Artifacts Grid Container */}
          <div className="flex-1 overflow-y-auto p-8 relative">
            <div className="max-w-5xl mx-auto space-y-10">

              {/* Recommended Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 text-lg" style={{ fontWeight: 700 }}>Artefactos Recomendados</h3>
                    <p className="text-gray-500 text-sm">Documentación esencial recomendada por el Agente 8 basada en su metodología.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  {recommendedArtifacts.map(artifact => (
                    <ArtifactCard key={artifact.id} artifact={artifact} />
                  ))}
                </div>
                {hasEmptyRecommendations && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 leading-relaxed">
                    El Agente 8 no dejó recomendaciones utilizables para esta guía. Puede reprocesar el análisis desde el panel derecho para volver a clasificar los artefactos con la guía metodológica aprobada.
                  </div>
                )}
              </section>

              {/* Others Section */}
              <section className="opacity-75 hover:opacity-100 transition-opacity pb-10">
                <div className="flex items-center gap-3 mb-6 pt-4 border-t border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                    <File size={16} className="text-gray-500" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 text-lg" style={{ fontWeight: 700 }}>Otros Artefactos</h3>
                    <p className="text-gray-500 text-sm">Material complementario que puede ser útil para la gestión operativa.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  {otherArtifacts.map(artifact => (
                    <ArtifactCard key={artifact.id} artifact={artifact} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* ── Right: Iteration & Close (col-span-4) ── */}
        <div className="col-span-4 flex flex-col bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="text-gray-700 text-sm mb-1" style={{ fontWeight: 600 }}>Estado del Paquete</h3>
              <div className="flex items-center gap-2 text-sm mt-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-gray-600 font-medium">{recommendedArtifacts.length} artefactos recomendados</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1.5">
                <div className="w-2 h-2 rounded-full bg-neutral-300 flex-shrink-0" />
                <span className="text-gray-600">{otherArtifacts.length} artefactos complementarios</span>
              </div>
            </div>

            <hr className="border-gray-100" />

            {!isCompleted && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex items-start gap-4">
                <AlertTriangle size={20} className="text-neutral-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-neutral-900 text-sm mb-1" style={{ fontWeight: 600 }}>Revisión final</p>
                  <p className="text-neutral-500 text-xs leading-relaxed">
                    Asegúrese de que todos los artefactos seleccionados cumplen con los requisitos de la organización. Al completar, el sistema generará el informe de entrega.
                  </p>
                </div>
              </div>
            )}
            {isCompleted && (
              <div className="bg-neutral-900 border border-neutral-900 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-white flex-shrink-0" />
                </div>
                <div>
                  <p className="text-white text-sm" style={{ fontWeight: 600 }}>Proyecto completado</p>
                  <p className="text-neutral-400 text-xs mt-0.5">Todos los artefactos fueron entregados.</p>
                </div>
              </div>
            )}
          </div>

          {!isCompleted && (
            <div className="p-6 border-t border-gray-100 bg-white flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirm(true)}
                className="w-full py-5 rounded-2xl text-white flex flex-col items-center justify-center shadow-lg"
                style={{ background: '#0a0a0a', fontWeight: 700 }}
              >
                <div className="flex items-center gap-2 text-base">
                  <Send size={18} />
                  Aprobar y Completar Proyecto
                </div>
                <span className="text-neutral-400 text-xs mt-1" style={{ fontWeight: 400 }}>
                  Esta acción cerrará formalmente el compromiso
                </span>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <ConfirmFinalModal
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleFinalApprove}
        isLoading={isSending}
      />

      <NextPhaseButton projectId={projectId!} prevPhase={7} show={isCompleted} />
    </div>
  );
}
