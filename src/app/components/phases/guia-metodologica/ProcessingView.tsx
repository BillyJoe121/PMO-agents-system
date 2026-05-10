import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ProcessingStep } from './types';

function ProcessingView({
  steps, currentStep, isAdjustment,
}: {
  steps: ProcessingStep[]; currentStep: number; isAdjustment: boolean;
}) {
  const pct = Math.min(100, Math.round((currentStep / steps.length) * 100));
  return (
    <AnimatePresence>
      <motion.div 
        key="processing-overlay"
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center"
      >
        <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5 shadow-sm">
          <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="hidden"
            style={{ borderTopColor: '#5454e9' }}
          />
        </div>

        <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>Procesando</p>
        <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
          {isAdjustment ? 'Revisando la guía' : 'Generando la guía metodológica'}
        </h2>
        <p className="text-[#5454e9] text-[13px] max-w-md text-center leading-relaxed mb-6">
          {isAdjustment
            ? 'El Agente esta incorporando los ajustes del consultor y generando una nueva version extensa. Este proceso puede tardar varios minutos.'
            : 'La guia se esta construyendo de acuerdo al enfoque aprobado en la Fase 6. Este proceso puede tardar varios minutos.'}
        </p>

        <div className="hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Progreso</span>
            <span className="text-neutral-900 text-[12px] tabular-nums" style={{ fontWeight: 500 }}>{pct}%</span>
          </div>
          <div className="h-1 bg-neutral-200/70 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#5454e9' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Step list */}
        <div className="hidden">
          {steps.map((step, idx) => {
            const done = idx < currentStep;
            const active = idx === currentStep;
            if (!done && !active) return null; // Solo mostrar lo completado y lo actual para no saturar el overlay
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${active ? 'bg-white border-neutral-200 shadow-sm' : 'bg-transparent border-transparent opacity-60'}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {done
                    ? <CheckCircle2 size={14} className="text-neutral-900" strokeWidth={1.75} />
                    : <Loader2 size={14} className="animate-spin text-neutral-700" strokeWidth={1.75} />}
                </div>
                <div>
                  <p className="text-[13px]" style={{ fontWeight: active ? 600 : 500, color: '#5454e9' }}>
                    {step.label}
                  </p>
                  {active && (
                    <p className="text-neutral-500 text-[12px] mt-0.5 leading-snug">
                      {step.detail}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        
        <p className="text-neutral-400 text-[10px] mt-8 flex items-center gap-1.5 justify-center uppercase tracking-widest">
          <AlertCircle size={10} strokeWidth={1.75} />
          Seguiremos monitoreando el resultado
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

export { ProcessingView };
