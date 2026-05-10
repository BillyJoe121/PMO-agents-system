export type PhaseStatusTone = 'completed' | 'processing' | 'blocked' | 'ready' | 'idle';

export function getPhaseStatusTone(status: unknown): PhaseStatusTone {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'completada', 'done', 'approved', 'aprobada'].includes(normalized)) return 'completed';
  if (['processing', 'procesando', 'running', 'in_progress'].includes(normalized)) return 'processing';
  if (['blocked', 'bloqueada', 'error', 'failed'].includes(normalized)) return 'blocked';
  if (['ready', 'lista', 'available', 'pendiente'].includes(normalized)) return 'ready';
  return 'idle';
}

export function isPhaseCompleted(status: unknown) {
  return getPhaseStatusTone(status) === 'completed';
}

