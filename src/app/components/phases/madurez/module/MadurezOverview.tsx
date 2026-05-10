import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import type { useMadurez } from '../../../../hooks/useMadurez';
import MadurezSurveyPanel from '../../_shared/MadurezSurveyPanel';
import type { PmoType } from './types';

type MadurezOverviewProps = {
  pmoType: PmoType;
  totalCount: number;
  doneCount: number;
  allDone: boolean;
  needsPredictiva: boolean;
  needsAgil: boolean;
  predictivaManager: ReturnType<typeof useMadurez>;
  agilManager: ReturnType<typeof useMadurez>;
  onSend: () => void;
};

export function MadurezOverview({
  pmoType,
  totalCount,
  doneCount,
  allDone,
  needsPredictiva,
  needsAgil,
  predictivaManager,
  agilManager,
  onSend,
}: MadurezOverviewProps) {
  return (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · Madurez de la PMO</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Evaluación de madurez {pmoType}
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  Según la clasificación de la Fase 4, su organización tendrá una <span className="text-neutral-900" style={{ fontWeight: 500 }}>PMO {pmoType}</span>. Gestione {totalCount === 2 ? 'ambas encuestas' : 'la encuesta'} para que el Agente 5 procese el diagnóstico de madurez.
                </p>

                <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Tipo de PMO</p>
                    <p className="mt-1.5 text-neutral-900" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {pmoType}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Encuestas</p>
                    <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {doneCount}<span className="text-[12px] text-neutral-400 ml-1">/ {totalCount}</span>
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Estado</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${allDone ? 'bg-neutral-800' : 'bg-neutral-400'}`} />
                      <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                        {allDone ? 'Listo para enviar' : 'En curso'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Survey Panels */}
              <div className="grid gap-8 mb-6">
                {needsPredictiva && (
                  <MadurezSurveyPanel 
                    title="Encuesta de Madurez Predictiva"
                    subtitle="Evaluación de prácticas tradicionales (Inicio, Planificación, Riesgos...)"
                    manager={predictivaManager} 
                  />
                )}
                {needsAgil && (
                  <MadurezSurveyPanel 
                    title="Encuesta de Madurez Ágil"
                    subtitle="Evaluación de prácticas ágiles (Iteraciones, Backlog, Ceremonias...)"
                    manager={agilManager} 
                  />
                )}
              </div>

              {/* Progress indicator (RF-F5-03) */}
              {pmoType === 'Híbrida' && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border mb-6 ${allDone ? 'bg-neutral-900 border-neutral-900' : 'bg-neutral-50 border-neutral-200'}`}>
                  {allDone
                    ? <CheckCircle2 size={14} className="text-white flex-shrink-0" strokeWidth={1.75} />
                    : <AlertCircle size={14} className="text-neutral-400 flex-shrink-0" strokeWidth={1.75} />}
                  <p className="text-[13px]" style={{ fontWeight: 500, color: allDone ? '#ffffff' : '#737373' }}>
                    {allDone
                      ? 'Ambas encuestas tienen datos. Listo para enviar al Agente 5.'
                      : `${doneCount} de ${totalCount} encuestas con datos — ${totalCount - doneCount} pendiente${totalCount - doneCount > 1 ? 's' : ''}`}
                  </p>
                </div>
              )}

              {/* Send to Agent 5 */}
              <div className="flex justify-end">
                <motion.button
                  whileHover={allDone ? { scale: 1.02 } : {}} 
                  whileTap={allDone ? { scale: 0.97 } : {}}
                  onClick={allDone ? onSend : undefined}
                  disabled={!allDone}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-px"
                  style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                  <Send size={15} /> Confirmar encuestas y Enviar al Agente 5
                </motion.button>
              </div>
            </motion.div>
  );
}
