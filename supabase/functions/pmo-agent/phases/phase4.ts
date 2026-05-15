import { unwrapDiagnosis, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

function usableDiagnosis(value: unknown) {
  const diagnosis = unwrapDiagnosis(value) as any;
  if (!diagnosis || typeof diagnosis !== "object" || Array.isArray(diagnosis)) return null;
  if (diagnosis._processing || diagnosis._error || diagnosis.error) return null;
  if (diagnosis.metadata?.status === "error") return null;
  return diagnosis;
}

export async function buildPhase4Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata } = ctx;

  const { data: prevFases, error } = await supabase
    .from("fases_estado")
    .select("numero_fase, datos_consolidados")
    .eq("proyecto_id", projectId)
    .in("numero_fase", [1, 2, 3]);

  if (error) throw new Error(`Error leyendo fases previas: ${error.message}`);

  const faseMap: Record<number, unknown> = {};
  for (const f of prevFases ?? []) {
    faseMap[f.numero_fase] = usableDiagnosis(f.datos_consolidados);
  }

  return {
    metadata: { ...baseMetadata, agent_id: "asistente-4" },
    payload: {
      phase1_diagnosis: faseMap[3] ?? null,
      phase2_diagnosis: faseMap[2] ?? null,
      phase3_diagnosis: faseMap[1] ?? null,
    },
    comments: comments ?? null,
  };
}
