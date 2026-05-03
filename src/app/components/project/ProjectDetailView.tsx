import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BarChart3, CheckCircle2, X, Sparkles, MoreVertical, Edit2, Trash2, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import PhaseItem from './PhaseItem';
import EditProjectModal from '../dashboard/EditProjectModal';

export default function ProjectDetailView() {
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, reprocessPhase, editProject, moveToTrash, updatePhaseStatus } = useApp();
  const [showSummary, setShowSummary] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // TODO: Realtime - subscribe to 'fases_estado' where proyecto_id = current_id
  // RF-PROJ-04: Mapear el ENUM de base de datos 'public.estado_fase' a las props del componente
  // TODO: fetch('fases_estado').order('numero_fase', { ascending: true })
  // TODO: Lógica de cliente para determinar disponibilidad basado en el array de estados

  const project = getProject(projectId!);

  if (!project) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 text-sm mb-4">Proyecto no encontrado.</p>
          <button onClick={() => navigate('/dashboard')} className="text-neutral-900 hover:underline text-sm" style={{ fontWeight: 500 }}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const completedCount = project.phases.filter(p => p.status === 'completado').length;
  const totalPhases = project.phases.length;
  const progressPct = (completedCount / totalPhases) * 100;
  const isComplete = completedCount === totalPhases;

  const handleRetry = async (phaseNumber: number) => {
    await reprocessPhase(project.id, phaseNumber);
    toast.success(`Fase ${phaseNumber} reiniciada`, { description: 'La fase actual y todas las fases posteriores han sido restablecidas.' });
  };

  const processingPhase = project.phases.find(p => p.status === 'procesando');

  const handleStopProcessing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (!processingPhase) return;
    try {
      const { error } = await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'disponible',
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', project.id)
        .eq('numero_fase', processingPhase.number);

      if (error) throw error;

      updatePhaseStatus(project.id, processingPhase.number, 'disponible');
      toast.info('Procesamiento detenido exitosamente');
    } catch (err: any) {
      toast.error('Error al detener procesamiento', { description: err.message });
    }
  };

  const handleEditProject = async (data: { companyName: string; projectName: string; auditorId: string }) => {
    try {
      await editProject(project.id, data);
      toast.success('Proyecto actualizado exitosamente');
    } catch (err: any) {
      toast.error('Error al actualizar el proyecto', { description: err.message });
    }
  };

  const completedPhasesWithDiagnosis = project.phases.filter(
    p => p.status === 'completado' && p.agentDiagnosis
  );

  const startDate = new Date(project.startDate).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#fafaf9]/85 backdrop-blur-md border-b border-neutral-200/60">
        <div className="max-w-[1100px] mx-auto px-10 pt-6 pb-5">
          <button
            onClick={() => navigate('/dashboard')}
            className="group inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full bg-white border border-neutral-200/80 text-neutral-700 hover:border-neutral-300 hover:text-neutral-900 text-[13px] mb-5 transition-all"
            style={{ fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <span className="w-5 h-5 rounded-full bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center transition-colors">
              <ArrowLeft size={11} strokeWidth={2} className="transition-transform group-hover:-translate-x-px" />
            </span>
            Mis proyectos
          </button>

          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>
                {project.companyName}
              </p>
              <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {project.projectName}
              </h1>
              <div className="flex items-center gap-4 mt-4 text-[12px] text-neutral-500">
                <span>Inicio · {startDate}</span>
                <span className="text-neutral-300">·</span>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {project.auditors.slice(0, 5).map(a => (
                      <div
                        key={a.id}
                        title={a.name}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white ring-2 ring-[#fafaf9]"
                        style={{ background: a.color, fontSize: '0.625rem', fontWeight: 600 }}
                      >
                        {a.initials}
                      </div>
                    ))}
                  </div>
                  <span>{project.auditors.length} auditor{project.auditors.length !== 1 ? 'es' : ''}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSummary(s => !s)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] border border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900 transition-all"
                style={{ fontWeight: 500 }}
              >
                <Sparkles size={13} strokeWidth={1.75} />
                Diagnósticos
              </button>

              <div className="relative ml-2">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-[40px] h-[40px] rounded-full border border-neutral-200/80 bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:border-neutral-300 transition-all shadow-sm"
                >
                  <MoreVertical size={16} strokeWidth={1.75} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-neutral-200/80 rounded-xl shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full text-left px-4 py-3 text-[13px] text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 border-b border-neutral-100"
                        style={{ fontWeight: 500 }}
                      >
                        <Edit2 size={13} /> Editar proyecto
                      </button>
                      {processingPhase && (
                        <button
                          onClick={handleStopProcessing}
                          className="w-full text-left px-4 py-3 text-[13px] text-amber-600 hover:bg-amber-50 flex items-center gap-2 border-b border-neutral-100"
                          style={{ fontWeight: 500 }}
                        >
                          <Square size={13} /> Detener procesamiento
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full text-left px-4 py-3 text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        style={{ fontWeight: 500 }}
                      >
                        <Trash2 size={14} /> Mover a papelera
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>
                Progreso global
              </span>
              <div className="flex items-baseline gap-2">
                {isComplete && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 text-[12px]" style={{ fontWeight: 500 }}>
                    <CheckCircle2 size={13} /> Proyecto completado
                  </span>
                )}
                {!isComplete && (
                  <span className="text-[12px] text-neutral-500 tabular-nums">
                    {completedCount} de {totalPhases} fases
                  </span>
                )}
                <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
                  {Math.round(progressPct)}%
                </span>
              </div>
            </div>
            <div className="w-full h-1 bg-neutral-200/70 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: isComplete ? '#10b981' : '#0a0a0a' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[1100px] mx-auto px-10 py-10">
        {/* Diagnoses panel */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mb-10 overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-neutral-200/70" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-center">
                      <Sparkles size={13} className="text-neutral-700" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>Diagnósticos del agente IA</h3>
                  </div>
                  <button onClick={() => setShowSummary(false)} className="w-7 h-7 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors">
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
                {completedPhasesWithDiagnosis.length === 0 ? (
                  <div className="px-6 py-12 text-center text-neutral-400 text-sm">
                    Aún no hay diagnósticos completados para mostrar.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {completedPhasesWithDiagnosis.map(phase => (
                      <div key={phase.number} className="px-6 py-5">
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] tabular-nums" style={{ fontWeight: 600 }}>
                            {phase.number}
                          </span>
                          <span className="text-[13px] text-neutral-900" style={{ fontWeight: 500 }}>
                            {phase.name}
                          </span>
                          <span className="text-[11px] text-neutral-400 ml-auto">{phase.completedAt}</span>
                        </div>
                        <p className="text-neutral-600 text-[13px] leading-relaxed pl-7">{phase.agentDiagnosis}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pipeline */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400" style={{ fontWeight: 500 }}>
              Pipeline
            </p>
            <h2 className="text-neutral-900 mt-1.5 tracking-tight" style={{ fontWeight: 500, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
              Fases del proyecto
            </h2>
          </div>
          <span className="text-[12px] text-neutral-400">
            Haga clic en una fase disponible para iniciarla
          </span>
        </div>

        {/* All phases — sequential */}
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-1.5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div className="flex flex-col">
            {project.phases.map((phase, i) => (
              <PhaseItem
                key={phase.number}
                phase={phase}
                projectId={project.id}
                onRetry={handleRetry}
                isLast={i === project.phases.length - 1}
                indexInGroup={i}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)} 
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70 shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-rose-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>Mover a papelera</h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Estás seguro de que deseas enviar el proyecto <strong>{project.projectName}</strong> a la papelera? Podrás restaurarlo más adelante desde la papelera.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" 
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await moveToTrash(project.id);
                      toast.success('Proyecto movido a la papelera');
                      navigate('/dashboard');
                    } catch (error) {
                      toast.error('Error al mover a la papelera');
                    } finally {
                      setIsDeleting(false);
                      setShowDeleteModal(false);
                    }
                  }} 
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 hover:-translate-y-px transition-all"
                  style={{ background: '#e11d48', fontWeight: 500 }}
                >
                  {isDeleting ? <><Loader2 size={13} className="animate-spin" /> Moviendo…</> : 'Sí, mover a papelera'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EditProjectModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditProject}
        project={project}
      />
    </div>
  );
}