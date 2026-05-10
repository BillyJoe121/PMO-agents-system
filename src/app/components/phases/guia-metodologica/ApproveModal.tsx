import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';

function ApproveModal({ open, onCancel, onConfirm, isLoading, versionNum }: {
  open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean; versionNum: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Aprobar Guía Metodológica</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Está a punto de aprobar la <strong>Versión {versionNum}</strong> de la Guía Metodológica.
                  La Fase 7 quedará <strong>completada</strong> y la Fase 8 se desbloqueará automáticamente.
                  Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#5454e9', fontWeight: 600 }}>
                {isLoading ? <><Loader2 size={14} className="animate-spin" />Aprobando…</> : <><CheckCircle2 size={14} />Aprobar guía</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { ApproveModal };
