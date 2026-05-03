import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Trash2, RefreshCcw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

// Tipo ligero para papelera
interface TrashedProject {
  id: string;
  nombre_proyecto: string;
  empresas: { nombre: string } | null;
  created_at: string;
}

export default function Papelera() {
  const navigate = useNavigate();
  const { projects, restoreProject, deleteProject } = useApp();
  
  const trashedProjects = useMemo(() => {
    return projects.filter(p => p.isDeleted).map(p => ({
      id: p.id,
      nombre_proyecto: p.projectName,
      empresas: { nombre: p.companyName },
      created_at: p.startDate
    }));
  }, [projects]);

  // Estados para modales
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; projectId: string; projectName: string }>({ isOpen: false, projectId: '', projectName: '' });
  const [restoreModal, setRestoreModal] = useState<{ isOpen: boolean; projectId: string; projectName: string }>({ isOpen: false, projectId: '', projectName: '' });
  const [deleteInput, setDeleteInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Remove unused effects and fetch functions

  // Remove unused effects and fetch functions
  const isLoading = false;

  const handleRestore = async () => {
    if (!restoreModal.projectId) return;
    setIsProcessing(true);
    try {
      await restoreProject(restoreModal.projectId);
      toast.success(`Proyecto "${restoreModal.projectName}" restaurado con éxito`);
      setRestoreModal({ isOpen: false, projectId: '', projectName: '' });
    } catch (err) {
      console.error('[Papelera] Falló restore:', err);
      toast.error('Error al restaurar proyecto');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteModal.projectId) return;
    
    if (deleteInput !== deleteModal.projectName) {
      toast.error('El nombre no coincide. Eliminación cancelada.');
      return;
    }

    setIsProcessing(true);
    try {
      await deleteProject(deleteModal.projectId);
      toast.success('Proyecto eliminado permanentemente');
      setDeleteModal({ isOpen: false, projectId: '', projectName: '' });
      setDeleteInput('');
    } catch (err) {
      console.error('[Papelera] Falló delete:', err);
      toast.error('Error eliminando el proyecto');
    } finally {
      setIsProcessing(false);
    }
  };

  // if (currentUser?.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#fafaf9] px-10 py-10">
      <div className="max-w-[1000px] mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-900 mb-6 transition-colors"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft size={12} strokeWidth={1.75} /> Volver al dashboard
        </button>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              <Trash2 size={18} className="text-rose-600" strokeWidth={1.75} />
            </div>
            <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
              Papelera de Proyectos
            </h1>
          </div>
          <p className="text-neutral-500 text-[14px] max-w-2xl leading-relaxed">
            Aquí puede restaurar proyectos eliminados o borrarlos de forma permanente. 
            La eliminación permanente borrará todos los datos, encuestas y archivos del proyecto.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : trashedProjects.length === 0 ? (
          <div className="bg-white border border-neutral-200/70 rounded-2xl p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-neutral-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-neutral-900 text-lg mb-1" style={{ fontWeight: 500 }}>Papelera vacía</h3>
            <p className="text-neutral-500 text-[13px]">No hay proyectos eliminados en este momento.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {trashedProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-neutral-200/70 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:border-neutral-300 transition-colors"
              >
                <div>
                  <h3 className="text-neutral-900 text-[15px]" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {project.empresas?.nombre || 'Empresa sin nombre'}
                  </h3>
                  <p className="text-neutral-500 text-[13px] mt-0.5">{project.nombre_proyecto}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRestoreModal({ isOpen: true, projectId: project.id, projectName: project.nombre_proyecto })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] bg-neutral-50 border border-neutral-200/80 hover:bg-neutral-100 hover:text-neutral-900 text-neutral-600 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    <RefreshCcw size={14} /> Restaurar
                  </button>
                  <button
                    onClick={() => {
                      setDeleteModal({ isOpen: true, projectId: project.id, projectName: project.nombre_proyecto });
                      setDeleteInput('');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    <AlertTriangle size={14} /> Eliminar permanentemente
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {/* Modal Restaurar */}
      <AnimatePresence>
        {restoreModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRestoreModal({ isOpen: false, projectId: '', projectName: '' })} 
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70 shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center flex-shrink-0">
                  <RefreshCcw size={16} className="text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500 }}>Restaurar proyecto</h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Deseas restaurar <strong>{restoreModal.projectName}</strong>? Volverá a estar visible y activo en tu dashboard.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setRestoreModal({ isOpen: false, projectId: '', projectName: '' })} 
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" 
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRestore} disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 hover:-translate-y-px transition-all disabled:opacity-70"
                  style={{ background: '#0a0a0a', fontWeight: 500 }}
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Restaurar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Hard Delete */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ isOpen: false, projectId: '', projectName: '' })} 
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70 shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="text-rose-600 mb-1.5 tracking-tight" style={{ fontWeight: 500 }}>Eliminación Permanente</h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    Esta acción es <strong>irreversible</strong>. Se borrarán todas las fases, encuestas, entrevistas y documentos del proyecto.
                  </p>
                </div>
              </div>
              
              <div className="mb-6 p-4 bg-rose-50/50 border border-rose-100/50 rounded-xl">
                <p className="text-[12px] text-neutral-600 mb-2">Para confirmar, escribe el nombre del proyecto:</p>
                <div className="text-[13px] font-mono bg-white border border-rose-100 px-3 py-1.5 rounded-lg mb-3 select-all">
                  {deleteModal.projectName}
                </div>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Nombre del proyecto..."
                  className="w-full text-[13px] border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setDeleteModal({ isOpen: false, projectId: '', projectName: '' })} 
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" 
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handlePermanentDelete} disabled={isProcessing || deleteInput !== deleteModal.projectName}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px"
                  style={{ background: '#e11d48', fontWeight: 500 }}
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Eliminar para siempre'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
