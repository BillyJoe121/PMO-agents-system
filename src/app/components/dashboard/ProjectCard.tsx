import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { ArrowUpRight, AlertCircle, CheckCircle2, Loader2, Circle, MoreVertical, Trash2, Edit2, Square } from 'lucide-react';
import { Project, PhaseStatus, useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import EditProjectModal from './EditProjectModal';

interface ProjectCardProps {
  project: Project;
  index: number;
}

const STATUS_META: Record<PhaseStatus, { label: string; dot: string; text: string; icon: React.ReactNode }> = {
  bloqueado: { label: 'No iniciada', dot: 'bg-neutral-300', text: 'text-neutral-500', icon: <Circle size={9} className="text-neutral-300" fill="currentColor" /> },
  disponible: { label: 'Disponible', dot: 'bg-neutral-900', text: 'text-neutral-800', icon: <Circle size={9} className="text-neutral-900" fill="currentColor" /> },
  procesando: { label: 'En proceso', dot: 'bg-amber-500', text: 'text-amber-700', icon: <Loader2 size={10} className="animate-spin text-amber-600" /> },
  completado: { label: 'Completada', dot: 'bg-emerald-500', text: 'text-emerald-700', icon: <CheckCircle2 size={10} className="text-emerald-600" /> },
  error: { label: 'Error', dot: 'bg-rose-500', text: 'text-rose-700', icon: <AlertCircle size={10} className="text-rose-600" /> },
};

export default function ProjectCard({ project, index }: ProjectCardProps) {
  const navigate = useNavigate();
  const { currentUser, moveToTrash, editProject, updatePhaseStatus } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const completedCount = project.phases.filter(p => p.status === 'completado').length;
  const totalPhases = project.phases.length;
  const progress = (completedCount / totalPhases) * 100;

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

  const currentPhase =
    project.phases.find(p => p.status === 'procesando' || p.status === 'disponible' || p.status === 'error') ||
    project.phases[project.phases.length - 1];

  const meta = STATUS_META[currentPhase?.status || 'bloqueado'] || STATUS_META.bloqueado;

  // Append T12:00:00 to prevent timezone offset shift when formatting YYYY-MM-DD
  const startDate = new Date(project.startDate + 'T12:00:00').toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      onClick={() => navigate(`/dashboard/project/${project.id}`)}
      className="group relative bg-white rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden border border-neutral-200/70 hover:border-neutral-300/80"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
    >
      {/* Subtle hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 12px 40px -12px rgba(0,0,0,0.12)' }}
      />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>
                {meta.label}
              </span>
            </div>
            <h3 className="text-neutral-900 truncate tracking-tight" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>
              {project.companyName}
            </h3>
            <p className="text-neutral-500 text-[13px] truncate mt-0.5">{project.projectName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="w-9 h-9 rounded-full border border-transparent hover:bg-neutral-100 hover:border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all duration-300"
                >
                  <MoreVertical size={15} strokeWidth={1.75} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200/80 rounded-xl shadow-lg z-20 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-[13px] text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 border-b border-neutral-100"
                        style={{ fontWeight: 500 }}
                      >
                        <Edit2 size={13} /> Editar proyecto
                      </button>
                      {processingPhase && (
                        <button
                          onClick={handleStopProcessing}
                          className="w-full text-left px-4 py-2.5 text-[13px] text-amber-600 hover:bg-amber-50 flex items-center gap-2 border-b border-neutral-100"
                          style={{ fontWeight: 500 }}
                        >
                          <Square size={13} /> Detener procesamiento
                        </button>
                      )}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        style={{ fontWeight: 500 }}
                      >
                        <Trash2 size={14} /> Mover a papelera
                      </button>
                    </div>
                  </>
                )}
              </div>
            <div className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:border-neutral-900 group-hover:text-white transition-all duration-300">
              <ArrowUpRight size={15} strokeWidth={1.75} className="transition-transform duration-300 group-hover:rotate-0" />
            </div>
          </div>
        </div>

        {/* Current phase */}
        <div className="mb-5 pb-5 border-b border-neutral-100">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>
            Fase actual
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-neutral-50 border border-neutral-200/80 text-[10px] text-neutral-600 tabular-nums" style={{ fontWeight: 500 }}>
              {currentPhase.number}
            </span>
            <span className={`text-[13px] truncate ${meta.text}`} style={{ fontWeight: 500 }}>
              {currentPhase.name}
            </span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-400">
              {meta.icon}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>
              Progreso
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
                {Math.round(progress)}
              </span>
              <span className="text-neutral-400 text-[11px]" style={{ fontWeight: 500 }}>%</span>
              <span className="text-neutral-300 text-[11px] mx-1">·</span>
              <span className="text-neutral-500 text-[11px] tabular-nums">
                {completedCount}/{totalPhases} fases
              </span>
            </div>
          </div>
          <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, delay: index * 0.05 + 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: progress === 100 ? '#10b981' : '#0a0a0a' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-1.5">
              {project.auditors.slice(0, 4).map(a => (
                <div
                  key={a.id}
                  title={a.name}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] ring-2 ring-white flex-shrink-0"
                  style={{ background: a.color, fontWeight: 600 }}
                >
                  {a.initials}
                </div>
              ))}
              {project.auditors.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 text-[10px] ring-2 ring-white" style={{ fontWeight: 600 }}>
                  +{project.auditors.length - 4}
                </div>
              )}
            </div>
            <span className="text-neutral-400 text-[11px]">
              {project.auditors.length} auditor{project.auditors.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <span className="text-neutral-400 text-[11px] tabular-nums">
            {startDate}
          </span>
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
              onClick={(e) => { e.stopPropagation(); setShowDeleteModal(false); }} 
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70"
              style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-rose-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>Mover a papelera</h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Estás seguro de que deseas enviar el proyecto <strong>{project.projectName}</strong> a la papelera? Podrás restaurarlo más adelante.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowDeleteModal(false); }} 
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" 
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsDeleting(true);
                    try {
                      await moveToTrash(project.id);
                      toast.success('Proyecto movido a la papelera');
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
    </motion.div>
  );
}
