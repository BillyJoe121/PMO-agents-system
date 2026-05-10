import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { PmoType } from './types';

type ProcessingOverlayProps = {
  isReprocessing: boolean;
  pmoType: PmoType;
};

export function ProcessingOverlay({ isReprocessing, pmoType }: ProcessingOverlayProps) {
  return (
            <motion.div 
              key="processing-overlay" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <div 
                className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" 
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
              >
                <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>
                Procesando
              </p>
              <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
                {isReprocessing ? 'Re-procesando diagnóstico' : 'Analizando madurez'}
              </h2>
              <p className="text-[#5454e9] text-[13px] mt-2 max-w-sm text-center">
                {isReprocessing
                  ? 'El Agente está incorporando el comentario del consultor y recalibrando el diagnóstico de madurez…'
                  : `Procesando las encuestas de madurez ${pmoType === 'Híbrida' ? 'Predictiva y Ágil' : pmoType} para determinar el nivel actual…`}
              </p>
            </motion.div>
  );
}
