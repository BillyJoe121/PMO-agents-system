import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

type DocumentacionProcessingOverlayProps = {
  isProcessing: boolean;
};

export function DocumentacionProcessingOverlay({ isProcessing }: DocumentacionProcessingOverlayProps) {
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>Procesando</p>
          <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
            Analizando documentos
          </h2>
          <p className="text-[#5454e9] text-[13px] mt-2">El Agente está evaluando la completitud documental…</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
