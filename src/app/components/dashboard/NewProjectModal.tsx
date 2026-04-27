import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { MOCK_AUDITORS, Auditor } from '../../context/AppContext';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { companyName: string; projectName: string; auditors: Auditor[]; startDate: string }) => void;
}

export default function NewProjectModal({ open, onClose, onSubmit }: NewProjectModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = 'El nombre de la empresa es requerido.';
    if (!projectName.trim()) e.projectName = 'El nombre del proyecto es requerido.';
    if (selectedAuditors.length === 0) e.auditors = 'Seleccione al menos un auditor.';
    if (!startDate) e.startDate = 'La fecha de inicio es requerida.';
    return e;
  };

  const toggleAuditor = (id: string) => {
    setSelectedAuditors(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    if (errors.auditors) setErrors(prev => ({ ...prev, auditors: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length > 0) { setErrors(e2); return; }

    setIsLoading(true);
    // TODO: Mutación insert en public.proyectos y public.fases_estado
    await new Promise(r => setTimeout(r, 900));
    const auditors = MOCK_AUDITORS.filter(c => selectedAuditors.includes(c.id));
    onSubmit({ companyName, projectName, auditors, startDate });
    setIsLoading(false);
    handleClose();
  };

  const handleClose = () => {
    setCompanyName(''); setProjectName(''); setSelectedAuditors([]); setStartDate(''); setErrors({});
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-gray-900" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                  Nuevo Proyecto
                </h2>
                <p className="text-gray-500 text-sm">Complete los datos para crear un nuevo proyecto de auditoría</p>
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
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

              {/* Auditores */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>Auditores asignados *</label>
                <div className={`border rounded-lg p-3 flex flex-wrap gap-2 min-h-[52px]
                  ${errors.auditors ? 'border-red-400' : 'border-gray-200'}
                `}>
                  {MOCK_AUDITORS.map(c => {
                    const selected = selectedAuditors.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleAuditor(c.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border
                          ${selected ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-gray-50 hover:border-gray-300'}
                        `}
                        style={selected ? { background: c.color, fontWeight: 500 } : { fontWeight: 400 }}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                          style={{ background: c.color, fontSize: '0.6rem', fontWeight: 700 }}
                        >
                          {c.initials}
                        </div>
                        {c.name}
                        {selected && <Plus size={10} className="rotate-45" />}
                      </button>
                    );
                  })}
                </div>
                {errors.auditors && (
                  <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {errors.auditors}</p>
                )}
              </div>

              {/* Start Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>Fecha estimada de inicio *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setErrors(prev => ({ ...prev, startDate: '' })); }}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white
                    ${errors.startDate ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
                  `}
                />
                {errors.startDate && (
                  <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {errors.startDate}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-lg text-white text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{ background: '#030213', fontWeight: 600 }}
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Creando...</>
                  ) : (
                    <><Plus size={14} /> Crear Proyecto</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}