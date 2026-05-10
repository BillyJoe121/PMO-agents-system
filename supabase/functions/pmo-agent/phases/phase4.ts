import { fileTypeFromPath, unwrapDiagnosis, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

export async function buildPhase4Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata, ensureFreshUrl } = ctx;

  const { data: prevFases, error } = await supabase
    .from("fases_estado")
    .select("numero_fase, datos_consolidados")
    .eq("proyecto_id", projectId)
    .in("numero_fase", [1, 2, 3]);

  if (error) throw new Error(`Error leyendo fases previas: ${error.message}`);

  const faseMap: Record<number, unknown> = {};
  for (const f of prevFases ?? []) {
    faseMap[f.numero_fase] = unwrapDiagnosis(f.datos_consolidados);
  }

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

  const { data: entrevistas } = await supabase
    .from("entrevistas")
    .select("id, nombre, cargo, area, notas, created_at, file_name")
    .eq("proyecto_id", projectId);

  const { data: encuestas } = await supabase
    .from("encuestas_respuestas")
    .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
    .eq("proyecto_id", projectId);

  const rawContext = {
    documentos_registrados: (docs ?? []).map((d: Record<string, any>) => ({
      nombre: d.nombre_personalizado ?? d.storage_path,
      categoria: d.categoria,
      fecha: d.created_at,
    })),
    entrevistas_registradas: (entrevistas ?? []).map((e: Record<string, any>) => ({
      nombre: e.nombre,
      cargo: e.cargo,
      area: e.area,
      notas: e.notas,
      fecha: e.created_at,
    })),
    encuestas_registradas: (encuestas ?? []).map((r: Record<string, any>) => ({
      nombre: r.nombre_encuestado,
      cargo: r.cargo_encuestado,
      area: r.area_encuestado,
      respuestas: r.respuestas,
    })),
  };

  return {
    metadata: { ...baseMetadata, agent_id: "agente-4" },
    payload: {
      phase1_diagnosis: faseMap[3] ?? null,
      phase2_diagnosis: faseMap[2] ?? null,
      phase3_diagnosis: faseMap[1] ?? null,
      raw_context: rawContext,
    },
    comments,
    __fileUrls: fileUrls,
  };
}

