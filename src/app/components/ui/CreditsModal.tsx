import { motion, AnimatePresence } from 'motion/react';
import { X, Award, Users, Code, Info } from 'lucide-react';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function CreditsModal({ isOpen, onClose }: CreditsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-[101] overflow-hidden border border-neutral-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
              <div>
                <h2 className="text-neutral-900 text-[15px]" style={{ fontWeight: 600 }}>Créditos del Proyecto</h2>
                <p className="text-neutral-500 text-[12px] mt-0.5">PMO Intelligence Platform</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Content */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="p-6 space-y-7"
            >
              {/* Lider de Proyecto */}
              <motion.div variants={itemVariants} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 flex-shrink-0 mt-0.5">
                  <Award size={15} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-1" style={{ fontWeight: 600 }}>Líder de Proyecto</h3>
                  <p className="text-neutral-800 text-[13px]" style={{ fontWeight: 500 }}>Ingrid Lucía Muñoz</p>
                </div>
              </motion.div>

              {/* Metodología de Negocio */}
              <motion.div variants={itemVariants} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 flex-shrink-0 mt-0.5">
                  <Users size={15} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-1" style={{ fontWeight: 600 }}>Metodología de Negocio</h3>
                  <p className="text-neutral-800 text-[13px] leading-relaxed" style={{ fontWeight: 500 }}>Melissa Ramos, Ana Restrepo, Miguel Angel Martinez</p>
                </div>
              </motion.div>

              {/* Arquitectura y Desarrollo */}
              <motion.div variants={itemVariants} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 flex-shrink-0 mt-0.5">
                  <Code size={15} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-1" style={{ fontWeight: 600 }}>Arquitectura y Desarrollo</h3>
                  <p className="text-neutral-800 text-[13px]" style={{ fontWeight: 500 }}>Joseph Verdesoto Velez</p>
                </div>
              </motion.div>

              {/* Agradecimientos Especiales */}
              <motion.div variants={itemVariants} className="pt-6 border-t border-neutral-100">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={14} className="text-neutral-400" strokeWidth={1.75} />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 600 }}>Agradecimientos Especiales</span>
                </div>
                <p className="text-neutral-600 text-[12px] leading-relaxed pl-6">
                  A la <span className="text-neutral-800" style={{ fontWeight: 500 }}>Facultad Barberi de Ingeniería, Diseño y Ciencias Aplicadas</span> y a su director <span className="text-neutral-800" style={{ fontWeight: 500 }}>Hugo Arboleda</span>.
                </p>
              </motion.div>
            </motion.div>

            {/* Footer */}
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-center">
              <p className="text-[10px] text-neutral-400 font-medium">© 2026 PMO Intelligence Platform. Todos los derechos reservados.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
