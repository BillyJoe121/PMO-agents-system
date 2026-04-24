// @refresh reset
/**
 * useSoundManager — Gestión centralizada de notificaciones de audio
 * PMO Intelligence Platform
 *
 * ── Eventos gestionados ──────────────────────────────────────────────────
 *  Agent_Success  → playAgentSuccess()   tono de notificación suave
 *  Process_Error  → playProcessError()   tono de alerta descendente
 *  Phase_Complete → playPhaseComplete()  acorde ascendente de celebración
 *
 * ── Implementación ───────────────────────────────────────────────────────
 * Usa la Web Audio API (osciladores) para sintetizar los sonidos en tiempo
 * real, sin necesidad de archivos de audio externos. Esto garantiza que los
 * sonidos funcionen en cualquier entorno sin depender de /public/sounds/.
 *
 * ── Sincronización ───────────────────────────────────────────────────────
 * Múltiples instancias del hook (ej. Sidebar + módulo activo) comparten el
 * estado isMuted vía:
 *   1. CustomEvent 'pmo:mute-change' → mismo window (cross-component)
 *   2. StorageEvent                  → otras pestañas del mismo origen
 *
 * TODO: Reemplazar síntesis por archivos de audio reales desde Supabase
 *       Storage para mayor calidad en producción.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MUTE_STORAGE_KEY = 'pmo_intelligence_sound_muted';
const MUTE_SYNC_EVENT  = 'pmo:mute-change';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Note {
  freq:  number;
  start: number;   // seconds relative to now
  dur:   number;   // seconds
  vol:   number;   // 0.0 – 1.0
  type?: OscillatorType;
}

interface MuteChangeEventDetail {
  muted: boolean;
}

export interface SoundManagerReturn {
  playAgentSuccess:  () => void;
  playProcessError:  () => void;
  playPhaseComplete: () => void;
  isMuted:           boolean;
  toggleMute:        () => void;
  isSupported:       boolean;
}

// ---------------------------------------------------------------------------
// Sound definitions — sequences of synthesized notes
// ---------------------------------------------------------------------------

/** Agent_Success: ping ascendente suave (notificación amigable). */
const NOTES_AGENT_SUCCESS: Note[] = [
  { freq: 660, start: 0.00, dur: 0.18, vol: 0.28, type: 'sine' },
  { freq: 880, start: 0.14, dur: 0.22, vol: 0.22, type: 'sine' },
];

/** Process_Error: descenso disonante (alerta audible). */
const NOTES_PROCESS_ERROR: Note[] = [
  { freq: 380, start: 0.00, dur: 0.18, vol: 0.30, type: 'sawtooth' },
  { freq: 230, start: 0.16, dur: 0.28, vol: 0.28, type: 'sawtooth' },
];

/** Phase_Complete: acorde ascendente C5 → E5 → G5 (celebración). */
const NOTES_PHASE_COMPLETE: Note[] = [
  { freq: 523, start: 0.00, dur: 0.28, vol: 0.28, type: 'sine' },  // C5
  { freq: 659, start: 0.14, dur: 0.28, vol: 0.26, type: 'sine' },  // E5
  { freq: 784, start: 0.28, dur: 0.34, vol: 0.24, type: 'sine' },  // G5
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMuteFromStorage(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeMuteToStorage(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    // localStorage puede estar bloqueado en contextos privados
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSoundManager(): SoundManagerReturn {
  // ── Detección de soporte ─────────────────────────────────────────────────
  const isSupported =
    typeof window !== 'undefined' &&
    (typeof AudioContext !== 'undefined' ||
      typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined');

  // ── Estado de silencio ───────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState<boolean>(() =>
    isSupported ? readMuteFromStorage() : true
  );

  // Ref espejo de isMuted para callbacks estables (evita stale closures)
  const isMutedRef = useRef<boolean>(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // ── AudioContext (creado de forma lazy en el primer play) ─────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Función de síntesis ───────────────────────────────────────────────────
  const playNotes = useCallback(
    (notes: Note[]): void => {
      if (isMutedRef.current || !isSupported) return;
      try {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          const Ctx =
            window.AudioContext ??
            (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => { /* silencioso */ });
        }
        notes.forEach(({ freq, start, dur, vol, type = 'sine' }) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = type;
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur + 0.015);
        });
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'NotSupportedError')
        ) return;
        console.warn('[useSoundManager] Error de síntesis:', (err as Error).message);
      }
    },
    [isSupported]
  );

  // ── Cleanup del AudioContext al desmontar ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => { /* silencioso */ });
      }
    };
  }, []);

  // ── Sincronización cross-component (mismo window) ────────────────────────
  useEffect(() => {
    if (!isSupported) return;
    const handleCustomMute = (e: CustomEvent<MuteChangeEventDetail>) => {
      setIsMuted(e.detail.muted);
      isMutedRef.current = e.detail.muted;
    };
    window.addEventListener(MUTE_SYNC_EVENT, handleCustomMute as EventListener);
    return () => window.removeEventListener(MUTE_SYNC_EVENT, handleCustomMute as EventListener);
  }, [isSupported]);

  // ── Sincronización cross-tab (otras pestañas del mismo origen) ───────────
  useEffect(() => {
    if (!isSupported) return;
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key !== MUTE_STORAGE_KEY) return;
      const next = e.newValue === 'true';
      setIsMuted(next);
      isMutedRef.current = next;
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [isSupported]);

  // ── API pública ───────────────────────────────────────────────────────────
  const playAgentSuccess  = useCallback(() => playNotes(NOTES_AGENT_SUCCESS),  [playNotes]);
  const playProcessError  = useCallback(() => playNotes(NOTES_PROCESS_ERROR),  [playNotes]);
  const playPhaseComplete = useCallback(() => playNotes(NOTES_PHASE_COMPLETE), [playNotes]);

  const toggleMute = useCallback((): void => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      writeMuteToStorage(next);
      window.dispatchEvent(
        new CustomEvent<MuteChangeEventDetail>(MUTE_SYNC_EVENT, { detail: { muted: next } })
      );
      return next;
    });
  }, []);

  return { playAgentSuccess, playProcessError, playPhaseComplete, isMuted, toggleMute, isSupported };
}
