import { motion } from 'motion/react';
import { CheckCircle2, Clock, Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react';
import type { DocVersion } from './types';

type GuideSidebarProps = {
  versions: DocVersion[];
  currentVersionIdx: number;
  currentVersion: DocVersion | null;
  adjustText: string;
  isAdjusting: boolean;
  isCompleted: boolean;
  completedAt?: string;
  onVersionSelect: (version: DocVersion, index: number) => void;
  onAdjustTextChange: (value: string) => void;
  onRequestAdjustments: () => void;
  onReprocess: () => void;
  onApprove: () => void;
  onGoPhase6: () => void;
  onGoPhase8: () => void;
};

export function GuideSidebar({
  versions,
  currentVersionIdx,
  currentVersion,
  adjustText,
  isAdjusting,
  isCompleted,
  completedAt,
  onVersionSelect,
  onAdjustTextChange,
  onRequestAdjustments,
  onReprocess,
  onApprove,
  onGoPhase6,
  onGoPhase8,
}: GuideSidebarProps) {
  return (
    <div className="min-h-0 flex flex-col bg-[#fbfbff] border-l border-[#5454e9]/15 overflow-hidden print:hidden">
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-[#5454e9] text-white flex items-center justify-center">
            <Clock size={14} strokeWidth={1.85} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#3838b8]" style={{ fontWeight: 850 }}>Historial de versiones</p>
            <p className="text-[11px] text-neutral-500">{versions.length} versiones disponibles</p>
          </div>
          {currentVersion && (
            <span className="ml-auto rounded-full bg-[#e4eb60]/60 px-2.5 py-1 text-[11px] text-neutral-800 tabular-nums" style={{ fontWeight: 850 }}>
              v{currentVersion.number}
            </span>
          )}
        </div>
        <div className="space-y-2 max-h-[190px] overflow-y-auto pr-0.5">
          {versions.map((v, idx) => (
            <button
              key={v.number}
              onClick={() => onVersionSelect(v, idx)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                currentVersionIdx === idx
                  ? 'border-[#5454e9]/25 bg-[#5454e9]/[0.06]'
                  : 'border-neutral-200/70 bg-white hover:border-[#5454e9]/20 hover:bg-[#5454e9]/[0.035]'
              }`}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 tabular-nums"
                style={currentVersionIdx === idx
                  ? { background: '#5454e9', color: '#fff', fontWeight: 850 }
                  : { background: '#f3f4f6', color: '#404040', fontWeight: 750 }}>
                {v.number}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-neutral-900 text-[12px]" style={{ fontWeight: 800 }}>
                  Versión {v.number} · {v.status === 'revisado' ? 'Revisada' : 'Original'}
                </p>
                <p className="text-neutral-500 text-[11px] mt-0.5 tabular-nums">
                  {new Date(v.generatedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                {v.comment && (
                  <p className="text-neutral-500 text-[11px] mt-1 line-clamp-2 italic">"{v.comment}"</p>
                )}
              </div>
              {currentVersionIdx === idx && (
                <CheckCircle2 size={13} className="text-[#5454e9] flex-shrink-0 mt-1" strokeWidth={1.9} />
              )}
            </button>
          ))}
          {versions.length === 0 && (
            <p className="text-neutral-400 text-[12px] text-center py-3 italic">Sin versiones aún</p>
          )}
        </div>
      </div>

      <hr className="border-neutral-200/60 flex-shrink-0" />

      {/* RF-F7-04: Adjustment panel — fills remaining height */}
      <div className="flex-1 px-5 pb-4 flex flex-col overflow-hidden min-h-0">
        {!isCompleted ? (
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-[#865cf0]/10 text-[#6a45d8] flex items-center justify-center">
                <MessageSquare size={14} strokeWidth={1.85} />
              </div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-700" style={{ fontWeight: 850 }}>
                Solicitar ajustes
              </p>
            </div>
            <p className="text-neutral-500 text-[12px] mb-3 leading-relaxed flex-shrink-0">
              Describa los cambios requeridos. El Agente 7 generará una versión revisada. La versión anterior se conserva en el historial.
            </p>
            <textarea
              value={adjustText}
              onChange={e => onAdjustTextChange(e.target.value)}
              placeholder="Ej: En el capítulo 3, amplía las ceremonias ágiles con ejemplos de la industria financiera…"
              className="flex-1 min-h-[180px] w-full px-3 py-2.5 border border-neutral-200/80 rounded-xl text-[13px] outline-none focus:border-[#865cf0]/45 focus:ring-4 focus:ring-[#865cf0]/10 transition-all resize-none leading-relaxed bg-white placeholder:text-neutral-400"
            />
            <p className="text-neutral-400 text-[11px] text-right mt-1 mb-3 flex-shrink-0 tabular-nums">{adjustText.length} caracteres</p>
            <div className="flex gap-2 flex-shrink-0">
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={onRequestAdjustments}
                disabled={isAdjusting || !adjustText.trim()}
                className="flex-1 py-2.5 rounded-xl border border-[#865cf0]/25 text-[#6a45d8] bg-[#865cf0]/[0.06] text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#865cf0]/10 transition-all"
                style={{ fontWeight: 750 }}
              >
                {isAdjusting
                  ? <><Loader2 size={12} className="animate-spin" strokeWidth={1.75} />Enviando…</>
                  : <><Send size={12} strokeWidth={1.75} />Solicitar ajuste</>}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={onReprocess}
                disabled={isAdjusting || !adjustText.trim()}
                className="flex-1 py-2.5 rounded-xl border border-[#5454e9]/30 text-white bg-[#5454e9] text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#4747cf] transition-all"
                style={{ fontWeight: 750, boxShadow: '0 12px 26px -18px rgba(84,84,233,0.75)' }}
              >
                <RotateCcw size={12} strokeWidth={1.75} />
                Reprocesar
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200/70 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <CheckCircle2 size={13} strokeWidth={1.75} />
              </div>
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Fase completada</span>
            </div>
            <p className="text-neutral-700 text-[13px] leading-relaxed">
              La guía fue aprobada y enviada al Agente 8 para generar los artefactos de soporte.
            </p>
            {completedAt && (
              <p className="text-neutral-400 text-[11px] mt-3 tabular-nums">Aprobado el {completedAt}</p>
            )}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-neutral-400 text-[11px] mb-2 leading-relaxed">¿Necesitas generar una nueva versión? Escribe instrucciones y reprocesa.</p>
              <textarea
                value={adjustText}
                onChange={e => onAdjustTextChange(e.target.value)}
                placeholder="Ej: Ajusta el capítulo de implementación para un plazo de 90 días…"
                rows={3}
                className="w-full px-3 py-2.5 border border-neutral-200/80 rounded-xl text-[12px] outline-none focus:border-[#5454e9]/45 focus:ring-4 focus:ring-[#5454e9]/10 transition-all resize-none leading-relaxed bg-white placeholder:text-neutral-400 mb-2"
              />
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={onReprocess}
                disabled={isAdjusting || !adjustText.trim()}
                className="w-full py-2.5 rounded-xl border border-[#5454e9]/30 bg-[#5454e9] text-white text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#4747cf] transition-all"
                style={{ fontWeight: 750 }}
              >
                <RotateCcw size={12} strokeWidth={1.75} />
                Reprocesar guía metodológica
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {!isCompleted && (
        <div className="px-5 pb-5 pt-4 border-t border-[#5454e9]/10 bg-white flex-shrink-0">
          <p className="text-neutral-500 text-[11px] text-center mb-3 leading-relaxed">
            Al aprobar, la Fase 7 se completará y la Fase 8 se desbloqueará.
          </p>
          <motion.button
            whileHover={{ y: -1 }} whileTap={{ y: 0 }}
            onClick={onApprove}
            className="w-full py-3 rounded-xl text-white text-[13px] flex items-center justify-center gap-2 transition-all"
            style={{ background: '#5454e9', fontWeight: 850, boxShadow: '0 14px 28px -18px rgba(84,84,233,0.8)' }}
          >
            <CheckCircle2 size={13} strokeWidth={1.75} />
            Aprobar guía metodológica
          </motion.button>
        </div>
      )}

      {/* Navegación entre fases (flechas) */}
      {isCompleted && (
        <div className="px-5 pb-5 pt-4 border-t border-[#5454e9]/10 bg-white flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={onGoPhase6}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-neutral-700 text-[12px] bg-white border border-neutral-200/80 hover:bg-neutral-50 transition-all"
              style={{ fontWeight: 750, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              ← Fase 6
            </button>
            <button
              onClick={onGoPhase8}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-[12px] transition-all"
              style={{ background: '#5454e9', fontWeight: 750, boxShadow: '0 12px 26px -18px rgba(84,84,233,0.8)' }}
            >
              Fase 8 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
