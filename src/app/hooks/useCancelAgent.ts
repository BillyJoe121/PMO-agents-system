/**
 * useCancelAgent
 * 
 * Hook reutilizable para cancelar un agente en ejecución.
 * Revierte la fase de 'procesando' → 'disponible' en Supabase y en el estado local.
 * El edge function, al terminar, detectará que ya no está en 'procesando' y descartará el resultado.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

export function useCancelAgent(projectId: string, phaseNumber: number) {
  const { updatePhaseStatus } = useApp();
  const [isCancelling, setIsCancelling] = useState(false);

  const cancel = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);

    try {
      // 1. Actualizar DB — esto es lo que el edge function revisa antes de guardar
      const { error } = await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'disponible',
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', phaseNumber);

      if (error) throw error;

      // 2. Actualizar estado local (optimistic UI)
      updatePhaseStatus(projectId, phaseNumber, 'disponible');

      toast.info('Ejecución cancelada', {
        description: `El Agente ${phaseNumber} fue detenido. Los datos no fueron guardados.`,
      });

      // Devolver true para que el componente sepa que debe cambiar su vista
      return true;
    } catch (err: any) {
      toast.error('No se pudo cancelar', { description: err.message });
      return false;
    } finally {
      setIsCancelling(false);
    }
  }, [projectId, phaseNumber, isCancelling, updatePhaseStatus]);

  return { cancel, isCancelling };
}
