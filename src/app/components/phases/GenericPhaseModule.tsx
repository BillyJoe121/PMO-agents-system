import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, X, Send, Loader2, AlertTriangle, CheckCircle2, Brain, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';

function ConfirmModal({ open, phaseName, onCancel, onConfirm, isLoading }: {
  open: boolean; phaseName: string; onCancel: () => void; onConfirm: () => void; isLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Aprobar {phaseName}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Al confirmar, esta fase será marcada como completada y se enviará al agente de análisis correspondiente. Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#030213', fontWeight: 600 }}>
                {isLoading ? <><Loader2 size={14} className="animate-spin" /> Procesando...</> : <><Send size={14} /> Confirmar y Aprobar</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function GenericPhaseModule() {
  // useParams() extrae :id y :phaseNum desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId, phaseNum: phaseNumber } = useParams<{ id: string; phaseNum: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();

  const pNum = parseInt(phaseNumber || '4');
  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === pNum);

  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!project || !phase) return null;

  const isCompleted = phase.status === 'completado';

  const handleConfirm = async () => {
    setIsSending(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSending(false);
    setShowConfirm(false);
    setIsProcessing(true);
    updatePhaseStatus(projectId!, pNum, 'procesando');

    setTimeout(() => {
      setIsProcessing(false);
      updatePhaseStatus(projectId!, pNum, 'completado',
        `Análisis completado para ${phase.name}. Los hallazgos han sido procesados y documentados exitosamente.`
      );
      toast.success(`¡Fase ${pNum} completada!`, { description: `${phase.name} ha sido aprobada.` });
    }, 3500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              {project.companyName}
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs" style={{ background: '#030213', fontWeight: 700 }}>{pNum}</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>{phase.name}</span>
            </div>
          </div>
          <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-blue-100 flex items-center justify-center mx-auto mb-5">
              <Loader2 size={36} className="text-blue-600 animate-spin" />
            </div>
            <h2 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.25rem' }}>Procesando fase</h2>
            <p className="text-gray-500 text-sm">El agente de IA está analizando los datos de {phase.name}...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            {isCompleted && (
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={16} className="text-green-500" />
                <span className="text-green-600 text-sm" style={{ fontWeight: 600 }}>Fase completada</span>
              </div>
            )}
            <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
              Fase {pNum}: {phase.name}
            </h1>
          </div>
          {!isCompleted && !isProcessing && (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm shadow-sm hover:shadow-md"
              style={{ background: '#030213', fontWeight: 600 }}
            >
              <Send size={14} />
              Aprobar Fase Definitivamente
            </motion.button>
          )}
        </div>

        {isCompleted ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border-2 shadow-sm p-6" style={{ borderColor: '#030213', background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: '#030213' }}>
                <Brain size={14} />
              </div>
              <span className="text-sm" style={{ fontWeight: 700, color: '#030213' }}>Diagnóstico del Agente IA</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">{phase.agentDiagnosis}</p>
            {phase.completedAt && (
              <p className="text-gray-400 text-xs mt-4 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" />
                Completada el {phase.completedAt}
              </p>
            )}
          </motion.div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileEdit size={16} className="text-gray-500" />
              <h3 className="text-gray-800" style={{ fontWeight: 600 }}>Notas y Observaciones</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Documente los hallazgos, observaciones y datos relevantes para esta fase antes de procesar con el agente de IA.
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`Ingrese las observaciones para ${phase.name}...`}
              rows={12}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed bg-white"
            />
            <p className="text-gray-400 text-xs text-right mt-2">{notes.length} caracteres</p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showConfirm}
        phaseName={phase.name}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        isLoading={isSending}
      />
    </div>
  );
}