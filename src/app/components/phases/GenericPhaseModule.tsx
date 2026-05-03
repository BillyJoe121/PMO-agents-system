import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Loader2, AlertTriangle, CheckCircle2, Sparkles, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseHeader from './_shared/PhaseHeader';

function ConfirmModal({ open, phaseName, onCancel, onConfirm, isLoading }: {
  open: boolean; phaseName: string; onCancel: () => void; onConfirm: () => void; isLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70"
            style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
                  Aprobar {phaseName}
                </h3>
                <p className="text-neutral-500 text-[13px] leading-relaxed">
                  Al confirmar, esta fase será marcada como completada y se enviará al agente de análisis correspondiente. Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 hover:-translate-y-px transition-all"
                style={{ background: '#0a0a0a', fontWeight: 500 }}>
                {isLoading ? <><Loader2 size={13} className="animate-spin" /> Procesando…</> : <><Send size={13} /> Confirmar y aprobar</>}
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
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={pNum}
        phaseName={phase.name}
        eyebrow={isCompleted ? 'Completada' : 'Activa'}
      />

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
            </div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Procesando</p>
            <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              Analizando {phase.name}
            </h2>
            <p className="text-neutral-500 text-[13px] mt-2">El agente de IA está trabajando en sus datos…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>
              Fase {pNum}
            </p>
            <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {phase.name}
            </h1>
            {isCompleted && (
              <div className="inline-flex items-center gap-1.5 mt-3 text-emerald-700 text-[12px]" style={{ fontWeight: 500 }}>
                <CheckCircle2 size={13} /> Fase completada
              </div>
            )}
          </div>
          {!isCompleted && !isProcessing && (
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ y: 0 }}
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[13px] transition-all flex-shrink-0"
              style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              <Send size={13} strokeWidth={1.75} />
              Aprobar fase
            </motion.button>
          )}
        </div>

        {isCompleted ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-neutral-200/70 bg-white p-7"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <Sparkles size={13} strokeWidth={1.75} />
              </div>
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>
                Diagnóstico del agente IA
              </span>
            </div>
            <p className="text-neutral-700 text-[14px] leading-relaxed">{phase.agentDiagnosis}</p>
            {phase.completedAt && (
              <p className="text-neutral-400 text-[11px] mt-5 flex items-center gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-500" />
                Completada el {phase.completedAt}
              </p>
            )}
          </motion.div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200/70 p-7" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <FileEdit size={14} className="text-neutral-500" strokeWidth={1.75} />
              <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>Notas y observaciones</h3>
            </div>
            <p className="text-neutral-500 text-[13px] mb-5">
              Documente los hallazgos, observaciones y datos relevantes para esta fase antes de procesar con el agente de IA.
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`Ingrese las observaciones para ${phase.name}…`}
              rows={12}
              className="w-full px-4 py-3 border border-neutral-200/80 rounded-xl text-[13px] outline-none focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 transition-all resize-y leading-relaxed bg-white placeholder:text-neutral-400"
            />
            <p className="text-neutral-400 text-[11px] text-right mt-2 tabular-nums">{notes.length} caracteres</p>
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
