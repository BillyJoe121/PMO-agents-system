import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

export async function buildPhase9Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata, ensureFreshUrl } = ctx;

  const { data: fase1Estado } = await supabase
    .from("fases_estado")
    .select("datos_consolidados")
    .eq("proyecto_id", projectId)
    .eq("numero_fase", 1)
    .single();

  const dc = fase1Estado?.datos_consolidados as any;
  const agent3Diagnosis = dc?.diagnosis ?? dc ?? null;

  const { data: docs } = await supabase
    .from("documentos")
    .select("id, storage_path, categoria, nombre_personalizado, metadatos, created_at")
    .eq("proyecto_id", projectId);

  const fileUrls: { url: string; type: string }[] = [];
  for (const d of docs ?? []) {
    if (d.storage_path) {
      const freshUrl = await ensureFreshUrl(d.storage_path);
      fileUrls.push({ url: freshUrl, type: fileTypeFromPath(d.storage_path) });
    }
  }

  return {
    metadata: { ...baseMetadata, phase: "3.1", agent_id: "agente-3-1" },
    payload: {
      agent3_diagnosis: agent3Diagnosis,
    },
    comments,
    __fileUrls: fileUrls,
  };
}

