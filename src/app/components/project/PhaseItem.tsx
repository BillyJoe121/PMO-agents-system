import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Lock,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { PhaseStatus, Phase } from '../../context/AppContext';

interface PhaseItemProps {
  phase: Phase;
  projectId: string;
  onRetry?: (phaseNumber: number) => void;
}

const phaseConfig: Record<PhaseStatus, {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  cursor: string;
  opacity: string;
}> = {
  bloqueado: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-400',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-500',
    label: 'Bloqueada',
    cursor: 'cursor-not-allowed',
    opacity: 'opacity-50',
  },
  disponible: {
    bg: 'bg-white',
    border: 'border-zinc-800',
    iconBg: 'bg-zinc-100',
    iconColor: 'text-zinc-700',
    badgeBg: 'bg-zinc-100',
    badgeText: 'text-zinc-800',
    label: 'Disponible',
    cursor: 'cursor-pointer',
    opacity: 'opacity-100',
  },
  procesando: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    label: 'En proceso',
    cursor: 'cursor-wait',
    opacity: 'opacity-100',
  },
  completado: {
    bg: 'bg-white',
    border: 'border-green-400',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-700',
    label: 'Completada',
    cursor: 'cursor-pointer',
    opacity: 'opacity-100',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    label: 'Error',
    cursor: 'cursor-pointer',
    opacity: 'opacity-100',
  },
};

function PhaseIcon({ status }: { status: PhaseStatus }) {
  switch (status) {
    case 'bloqueado': return <Lock size={20} />;
    case 'disponible': return <Play size={20} />;
    case 'procesando': return <Loader2 size={20} className="animate-spin" />;
    case 'completado': return <CheckCircle2 size={20} />;
    case 'error': return <AlertTriangle size={20} />;
  }
}

export default function PhaseItem({ phase, projectId, onRetry }: PhaseItemProps) {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);
  const cfg = phaseConfig[phase.status];

  const handleClick = () => {
    if (phase.status === 'bloqueado' || phase.status === 'procesando') return;
    if (phase.number <= 3) {
      navigate(`/dashboard/project/${projectId}/phase/${phase.number}`);
    } else {
      // TODO: Navigate to generic phase module for phases 4-8
      navigate(`/dashboard/project/${projectId}/phase/${phase.number}`);
    }
  };

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: (phase.number - 1) * 0.07 }}
        whileHover={phase.status !== 'bloqueado' && phase.status !== 'procesando' ? { scale: 1.01, x: 4 } : {}}
        onClick={handleClick}
        onMouseEnter={() => phase.status === 'bloqueado' && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative flex items-center gap-5 p-5 rounded-xl border-2 shadow-sm transition-all
          ${cfg.bg} ${cfg.border} ${cfg.cursor} ${cfg.opacity}
          ${phase.status === 'disponible' ? 'hover:shadow-md' : ''}
          ${phase.status === 'completado' ? 'hover:shadow-md' : ''}
        `}
      >
        {/* Phase number */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.iconBg} ${cfg.iconColor}`}>
            <PhaseIcon status={phase.status} />
          </div>
          <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>
            F{phase.number}
          </span>
        </div>

        {/* Phase info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-gray-900 truncate" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              {phase.name}
            </h3>
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs ${cfg.badgeBg} ${cfg.badgeText}`} style={{ fontWeight: 500 }}>
              {cfg.label}
            </span>
          </div>

          {phase.status === 'procesando' && (
            <p className="text-amber-600 text-xs flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              El Agente de IA está procesando los datos...
            </p>
          )}

          {phase.status === 'completado' && phase.completedAt && (
            <p className="text-gray-400 text-xs flex items-center gap-1.5">
              <Calendar size={11} />
              Completada el {phase.completedAt}
            </p>
          )}

          {phase.status === 'disponible' && (
            <p className="text-zinc-600 text-xs" style={{ fontWeight: 500 }}>
              Haga clic para iniciar esta fase →
            </p>
          )}

          {phase.status === 'bloqueado' && (
            <p className="text-gray-400 text-xs">
              Complete las fases anteriores para desbloquear
            </p>
          )}

          {phase.status === 'error' && (
            <p className="text-red-500 text-xs">
              Se produjo un error durante el procesamiento. Verifique los datos e intente nuevamente.
            </p>
          )}

          {/* Agent diagnosis preview */}
          {phase.status === 'completado' && phase.agentDiagnosis && (
            <p className="text-gray-500 text-xs mt-1.5 line-clamp-1 italic">
              "{phase.agentDiagnosis.slice(0, 80)}..."
            </p>
          )}
        </div>

        {/* Right actions */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {phase.status === 'error' && onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(phase.number); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs hover:bg-red-200 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <RotateCcw size={12} />
              Reintentar
            </button>
          )}
          {(phase.status === 'disponible' || phase.status === 'completado') && (
            <ChevronRight size={18} className="text-gray-400" />
          )}
        </div>
      </motion.div>

      {/* Tooltip for locked phases */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute left-1/2 -translate-x-1/2 -top-10 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10 shadow-lg"
          >
            Completa las fases anteriores primero
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connector line */}
      {phase.number < 8 && (
        <div className="absolute left-[2.75rem] top-full w-0.5 h-4 bg-gray-200" style={{ marginLeft: '1.5rem' }} />
      )}
    </div>
  );
}