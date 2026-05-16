import { unwrapDiagnosis, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

function unwrapPhaseOutput(value: unknown) {
  const record = value as any;
  return record?._current ?? record?.diagnosis ?? record?.data?.diagnosis ?? record?.data ?? unwrapDiagnosis(value);
}

export async function buildPhase6Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata } = ctx;
  const { data: prevFases } = await supabase
    .from("fases_estado")
    .select("numero_fase, datos_consolidados")
    .eq("proyecto_id", projectId)
    .in("numero_fase", [4, 5]);

  const faseMap: Record<number, any> = {};
  for (const f of prevFases ?? []) {
    faseMap[f.numero_fase] = unwrapPhaseOutput(f.datos_consolidados);
  }

  return {
    metadata: { ...baseMetadata, agent_id: "agente-6" },
    payload: {
      approved_phase4_diagnosis: faseMap[4] ?? null,
      approved_phase5_diagnosis: faseMap[5] ?? null,
    },
    comments,
  };
}
