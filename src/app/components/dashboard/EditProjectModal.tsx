import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import type { Project } from '../../context/AppContext';
import { useAdminUsers } from '../../hooks/useAdmin';

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { companyName: string; projectName: string; auditorId: string }) => void;
  project: Project | null;
}

const AVATAR_COLORS = ['#030213', '#059669', '#7c3aed', '#dc2626', '#d97706', '#0284c7', '#be185d'];

export default function EditProjectModal({ open, onClose, onSubmit, project }: EditProjectModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedAuditor, setSelectedAuditor] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const { users: allUsers, isLoading: loadingAuditors } = useAdminUsers();
  const auditorList = allUsers.filter(u => u.role === 'auditor');

  useEffect(() => {
    if (project && open) {
      setCompanyName(project.companyName || '');
      setProjectName(project.projectName || '');
      setSelectedAuditor(project.auditors?.[0]?.id || '');
      setErrors({});
    }
  }, [project, open]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = 'El nombre de la empresa es requerido.';
    if (!projectName.trim()) e.projectName = 'El nombre del proyecto es requerido.';
    if (!selectedAuditor) e.auditors = 'Seleccione un auditor.';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length > 0) { setErrors(e2); return; }

    setIsLoading(true);
    onSubmit({ companyName, projectName, auditorId: selectedAuditor });
    setIsLoading(false);
    handleClose();
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && project && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleClose();
            }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 select-none"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-gray-900" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                  Editar Proyecto
                </h2>
                <p className="text-gray-500 text-sm">Modifique los datos del proyecto de auditoría</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleClose(); }} 
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
              {/* Company Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>Empresa cliente *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => { setCompanyName(e.target.value); setErrors(prev => ({ ...prev, companyName: '' })); }}
                  placeholder="Ej: TechCorp Colombia S.A.S."
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white
                    ${errors.companyName ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
                  `}
                />
                {errors.companyName && (
                  <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {errors.companyName}</p>
                )}
              </div>

              {/* Project Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>Nombre del proyecto *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => { setProjectName(e.target.value); setErrors(prev => ({ ...prev, projectName: '' })); }}
                  placeholder="Ej: Diagnóstico PMO 2024"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white
                    ${errors.projectName ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
                  `}
                />
                {errors.projectName && (
                  <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {errors.projectName}</p>
                )}
              </div>

              {/* Auditor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>Auditor asignado *</label>
                <div className={`border rounded-lg p-3 min-h-[52px]
                  ${errors.auditors ? 'border-red-400' : 'border-gray-200'}
                `}>
                  {loadingAuditors ? (
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <Loader2 size={12} className="animate-spin" /> Cargando auditores...
                    </div>
                  ) : auditorList.length === 0 ? (
                    <p className="text-gray-400 text-xs">No hay auditores registrados.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {auditorList.map((user, idx) => {
                        const selected = selectedAuditor === user.id;
                        const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                        const initials = user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedAuditor(user.id); setErrors(prev => ({ ...prev, auditors: '' })); }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                              ${selected ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-gray-50 hover:border-gray-300'}
                            `}
                            style={selected ? { background: color, fontWeight: 500 } : { fontWeight: 400 }}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                              style={{ background: color, fontSize: '0.6rem', fontWeight: 700 }}
                            >
                              {initials}
                            </div>
                            {user.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {errors.auditors && (
                  <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {errors.auditors}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleClose(); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || loadingAuditors}
                  className="flex-1 py-2.5 rounded-lg text-white text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{ background: '#030213', fontWeight: 600 }}
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                  ) : (
                    <><Save size={14} /> Guardar cambios</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
