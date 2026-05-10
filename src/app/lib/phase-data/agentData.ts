import { asArray, pickFirst } from './normalize';

type PhaseStateLike = {
  datos?: unknown;
  agentDiagnosis?: unknown;
  estado?: string;
  status?: string;
};

export function getAgentPayload(phaseState: PhaseStateLike | null | undefined) {
  const raw = pickFirst(phaseState?.datos, phaseState?.agentDiagnosis);
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function hasAgentData(phaseState: PhaseStateLike | null | undefined) {
  const payload = getAgentPayload(phaseState);
  if (!payload) return false;
  if (typeof payload === 'string') return payload.trim().length > 0;
  if (Array.isArray(payload)) return payload.length > 0;
  if (typeof payload === 'object') return Object.keys(payload as Record<string, unknown>).length > 0;
  return true;
}

export function summarizeAgentList(value: unknown, limit = 3) {
  return asArray(value).slice(0, limit);
}

