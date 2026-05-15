export const PHASE_PROCESSING_STALE_MS = 5 * 60 * 1000;

export function hasMeaningfulData(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return true;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

export function createRunId(phaseNumber: number) {
  return `phase-${phaseNumber}-${Date.now()}-${crypto.randomUUID()}`;
}

export function isProcessingStale(updatedAt?: string | null) {
  if (!updatedAt) return true;
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return true;
  return Date.now() - updatedTime > PHASE_PROCESSING_STALE_MS;
}

export function isProcessingMarker(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)._processing === true
  );
}

export function hasCompletedPhaseData(value: unknown) {
  if (!hasMeaningfulData(value)) return false;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const metadata = record.metadata as Record<string, unknown> | undefined;
    if (record._error || record._processing || record.error || metadata?.status === "error") return false;
  }
  return true;
}

export function phaseProcessingPayload(phaseNumber: number, runId: string) {
  return {
    _processing: true,
    _run_id: runId,
    phaseNumber,
    started_at: new Date().toISOString(),
  };
}
