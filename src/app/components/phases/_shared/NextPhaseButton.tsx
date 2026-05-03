import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface NextPhaseButtonProps {
  projectId: string;
  show: boolean;
  /** Si se omite no se muestra el botón "siguiente" (fase final) */
  nextPhase?: number;
  /** Si se omite no se muestra el botón "anterior" (primera fase) */
  prevPhase?: number;
}

/**
 * Barra de navegación inferior que aparece cuando una fase está completada.
 * Muestra "Ver la fase previa" a la izquierda y "Ir a la siguiente fase" a la derecha.
 */
export default function NextPhaseButton({ projectId, show, nextPhase, prevPhase }: NextPhaseButtonProps) {
  const navigate = useNavigate();
  if (!show) return null;
  if (!nextPhase && !prevPhase) return null;

  return (
    <div className="max-w-[1100px] mx-auto px-10 pb-12 print:hidden">
      <div className="flex items-center justify-between pt-8 border-t border-neutral-200/60">

        {/* Botón izquierdo: fase previa */}
        {prevPhase ? (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            onClick={() => {
              navigate(`/dashboard/project/${projectId}/phase/${prevPhase}`);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-neutral-700 text-[13px] bg-white border border-neutral-200/80 transition-all"
            style={{
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.08)',
            }}
          >
            <ArrowLeft size={13} strokeWidth={1.75} />
            Ver la Fase {prevPhase}
          </motion.button>
        ) : (
          /* Placeholder para mantener el justify-between */
          <span />
        )}

        {/* Botón derecho: siguiente fase */}
        {nextPhase ? (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            onClick={() => {
              navigate(`/dashboard/project/${projectId}/phase/${nextPhase}`);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-[13px] transition-all"
            style={{
              background: '#0a0a0a',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)',
            }}
          >
            Ir a la Fase {nextPhase}
            <ArrowRight size={13} strokeWidth={1.75} />
          </motion.button>
        ) : (
          <span />
        )}

      </div>
    </div>
  );
}
