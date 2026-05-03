import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Lock,
  Play,
  Loader2,
  Check,
  AlertTriangle,
  ArrowUpRight,
  RotateCcw,
  Square,
} from 'lucide-react';
import { PhaseStatus, Phase } from '../../context/AppContext';
import { useCancelAgent } from '../../hooks/useCancelAgent';

interface PhaseItemProps {
  phase: Phase;
  projectId: string;
  onRetry?: (phaseNumber: number) => void;
  isLast?: boolean;
  indexInGroup?: number;
}

const STATUS: Record<PhaseStatus, {
  label: string;
  dot: string;
  text: string;
  iconWrap: string;
  icon: React.ReactNode;
  cursor: string;
  interactive: boolean;
}> = {
  bloqueado: {
    label: 'Bloqueada',
    dot: 'bg-neutral-300',
    text: 'text-neutral-400',
    iconWrap: 'bg-neutral-50 border-neutral-200/70 text-neutral-400',
    icon: <Lock size={14} strokeWidth={1.75} />,
    cursor: 'cursor-not-allowed',
    interactive: false,
  },
  disponible: {
    label: 'Disponible',
    dot: 'bg-neutral-900',
    text: 'text-neutral-900',
    iconWrap: 'bg-neutral-900 border-neutral-900 text-white',
    icon: <Play size={13} strokeWidth={2} fill="currentColor" />,
    cursor: 'cursor-pointer',
    interactive: true,
  },
  procesando: {
    label: 'En proceso',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    iconWrap: 'bg-amber-50 border-amber-200 text-amber-600',
    icon: <Loader2 size={14} className="animate-spin" strokeWidth={2} />,
    cursor: 'cursor-pointer',   // ← ahora sí se puede entrar
    interactive: true,          // ← ahora sí se puede entrar
  },
  completado: {
    label: 'Completada',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    iconWrap: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    icon: <Check size={14} strokeWidth={2.25} />,
    cursor: 'cursor-pointer',
    interactive: true,
  },
  error: {
    label: 'Error',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    iconWrap: 'bg-rose-50 border-rose-200 text-rose-600',
    icon: <AlertTriangle size={14} strokeWidth={2} />,
    cursor: 'cursor-pointer',
    interactive: true,
  },
};

// ── Sub-componente: botón cancelar inline ────────────────────────────────────
function CancelButton({ projectId, phaseNumber }: { projectId: string; phaseNumber: number }) {
  const { cancel, isCancelling } = useCancelAgent(projectId, phaseNumber);
  const [confirm, setConfirm] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // no navegar al hacer click en el botón
    if (!confirm) { setConfirm(true); return; }
    cancel();
    setConfirm(false);
  };

  const handleBlur = () => setTimeout(() => setConfirm(false), 200);

  return (
    <button
      onClick={handleClick}
      onBlur={handleBlur}
      disabled={isCancelling}
      title={confirm ? 'Click de nuevo para confirmar' : 'Detener agente'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border transition-all ${
        confirm
          ? 'bg-red-600 border-red-600 text-white'
          : 'bg-white border-amber-200 text-amber-700 hover:border-red-300 hover:text-red-600'
      }`}
      style={{ fontWeight: 500 }}
    >
      {isCancelling
        ? <Loader2 size={10} className="animate-spin" />
        : <Square size={9} fill="currentColor" strokeWidth={0} />
      }
      {isCancelling ? 'Cancelando…' : confirm ? '¿Confirmar?' : 'Detener'}
    </button>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function PhaseItem({ phase, projectId, onRetry, isLast, indexInGroup = 0 }: PhaseItemProps) {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const meta = STATUS[phase.status];

  const handleClick = () => {
    if (!meta.interactive) return;
    navigate(`/dashboard/project/${projectId}/phase/${phase.number}`);
  };

  const description = (() => {
    switch (phase.status) {
      case 'procesando': return 'El agente de IA está procesando. Puedes entrar o detenerlo.';
      case 'completado': return phase.completedAt ? `Completada el ${phase.completedAt}` : 'Completada';
      case 'disponible': return 'Lista para iniciar';
      case 'bloqueado': return 'Complete las fases anteriores para desbloquear';
      case 'error': return 'Se produjo un error durante el procesamiento';
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: indexInGroup * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleClick}
      onMouseEnter={() => phase.status === 'bloqueado' && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`group relative flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${meta.cursor} ${
        meta.interactive ? 'hover:bg-neutral-50' : ''
      } ${!isLast ? 'border-b border-neutral-100' : ''} ${phase.status === 'bloqueado' ? 'opacity-60' : ''}`}
    >
      {/* Phase number + icon */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] tabular-nums text-neutral-400 w-6 text-right" style={{ fontWeight: 500 }}>
          F{phase.number}
        </span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${meta.iconWrap}`}>
          {meta.icon}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <h3 className="text-neutral-900 truncate tracking-tight" style={{ fontWeight: 500, fontSize: '0.9375rem', letterSpacing: '-0.005em' }}>
            {phase.name}
          </h3>
          <span className={`inline-flex items-center gap-1.5 text-[11px] ${meta.text}`} style={{ fontWeight: 500 }}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
        <p className="text-[12px] text-neutral-500 truncate">
          {description}
        </p>
        {phase.status === 'completado' && phase.agentDiagnosis && (
          <p className="text-[12px] text-neutral-400 italic truncate mt-1">
            "{phase.agentDiagnosis.slice(0, 110)}{phase.agentDiagnosis.length > 110 ? '…' : ''}"
          </p>
        )}
      </div>

      {/* Right action */}
      <div className="flex-shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {/* Botón cancelar — solo en procesando */}
        {phase.status === 'procesando' && (
          <CancelButton projectId={projectId} phaseNumber={phase.number} />
        )}

        {/* Botón reintentar — solo en error */}
        {phase.status === 'error' && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowResetModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-[12px] hover:bg-rose-100 transition-colors border border-rose-100"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw size={11} strokeWidth={2} />
            Reintentar
          </button>
        )}

        {/* Botón reprocesar — solo en completado */}
        {phase.status === 'completado' && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowResetModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-50 text-neutral-600 text-[12px] hover:bg-neutral-100 hover:text-neutral-900 transition-colors border border-neutral-200/80"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw size={11} strokeWidth={2} />
            Reprocesar
          </button>
        )}

        {/* Flecha navegar */}
        {meta.interactive && (
          <div className="w-8 h-8 rounded-full border border-neutral-200/70 flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:border-neutral-900 group-hover:text-white transition-all">
            <ArrowUpRight size={13} strokeWidth={1.75} />
          </div>
        )}
      </div>

      {/* Locked tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-4 -top-9 bg-neutral-900 text-white text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap z-10"
            style={{ fontWeight: 500 }}
          >
            Complete las fases anteriores primero
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación personalizado de Reprocesar */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); setShowResetModal(false); }}
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70"
              style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                  <RotateCcw size={16} className="text-amber-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
                    Confirmar reinicio de fase
                  </h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Estás seguro de que deseas reiniciar la <strong>Fase {phase.number}: {phase.name}</strong>? Se restablecerán los datos de esta fase y todas las fases posteriores serán bloqueadas nuevamente.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowResetModal(false); }}
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRetry) onRetry(phase.number);
                    setShowResetModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] hover:-translate-y-px transition-all"
                  style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                >
                  Sí, reiniciar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
