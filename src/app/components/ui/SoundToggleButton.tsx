// @refresh reset
/**
 * SoundToggleButton — Botón de silencio/activo para notificaciones de audio
 *
 * Usa useSoundManager() internamente, por lo que cualquier instancia del botón
 * refleja el estado global gracias al sistema de CustomEvent + localStorage.
 *
 * Props:
 *  variant  → 'sidebar'  (icono solo, 72px de ancho, estilo sidebar)
 *           → 'inline'   (icono + label, para headers de módulos)
 *           → 'compact'  (icono solo, pequeño, para headers de módulos)
 */

import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Bell, BellOff } from 'lucide-react';
import { useSoundManager } from '../../hooks/useSoundManager';

type ButtonVariant = 'sidebar' | 'inline' | 'compact';

interface SoundToggleButtonProps {
  variant?: ButtonVariant;
  className?: string;
}

export function SoundToggleButton({
  variant = 'sidebar',
  className = '',
}: SoundToggleButtonProps) {
  const { isMuted, toggleMute, isSupported } = useSoundManager();

  // No renderizar si el navegador no soporta Audio API
  if (!isSupported) return null;

  // ── Variante: sidebar (icono solo, estilo sidebar existente) ─────────────
  if (variant === 'sidebar') {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleMute}
        title={isMuted ? 'Activar notificaciones de audio' : 'Silenciar notificaciones'}
        className={`relative group w-full h-10 rounded-xl flex items-center justify-center transition-all ${
          isMuted
            ? 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
        } ${className}`}
      >
        <AnimatePresence mode="wait">
          {isMuted ? (
            <motion.span
              key="off"
              initial={{ opacity: 0, scale: 0.7, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: 15 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              <VolumeX size={18} />
            </motion.span>
          ) : (
            <motion.span
              key="on"
              initial={{ opacity: 0, scale: 0.7, rotate: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: -15 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              <Volume2 size={18} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Indicador de estado — punto rojo cuando muted */}
        <AnimatePresence>
          {isMuted && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-400 border border-white"
            />
          )}
        </AnimatePresence>

        {/* Tooltip */}
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
          {isMuted ? 'Activar audio' : 'Silenciar audio'}
        </div>
      </motion.button>
    );
  }

  // ── Variante: compact (icono solo, para headers de fase) ─────────────────
  if (variant === 'compact') {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleMute}
        title={isMuted ? 'Activar notificaciones de audio' : 'Silenciar notificaciones'}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isMuted
            ? 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        } ${className}`}
      >
        <AnimatePresence mode="wait">
          {isMuted ? (
            <motion.span
              key="off"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              <VolumeX size={15} />
            </motion.span>
          ) : (
            <motion.span
              key="on"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              <Volume2 size={15} />
            </motion.span>
          )}
        </AnimatePresence>
        {isMuted && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
        )}
      </motion.button>
    );
  }

  // ── Variante: inline (icono + label, para settings o tooltips expandidos) ─
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={toggleMute}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-sm ${
        isMuted
          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      } ${className}`}
      style={{ fontWeight: 500 }}
    >
      <AnimatePresence mode="wait">
        {isMuted ? (
          <motion.span
            key="off"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            <BellOff size={14} />
          </motion.span>
        ) : (
          <motion.span
            key="on"
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            <Bell size={14} />
          </motion.span>
        )}
      </AnimatePresence>
      <span>{isMuted ? 'Audio silenciado' : 'Notificaciones activas'}</span>
    </motion.button>
  );
}
