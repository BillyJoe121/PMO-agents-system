import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

function formatMaturityAnswers(rows: any[]) {
  return (rows ?? []).map((r: any, idx: number) => ({
    respondent_id: `r-${String(idx + 1).padStart(3, "0")}`,
    name: r.nombre_encuestado,
    role: r.cargo_encuestado,
    responses: Object.fromEntries(
      (Array.isArray(r.respuestas) ? r.respuestas : [])
        .map((ans: any, ansIdx: number) => {
          const code = String(ans.codigo || ans.id || ans.pregunta_id || ans.pregunta_codigo || ans.pregunta || `Pregunta_${ansIdx + 1}`);
          const rawVal = ans.valor !== undefined ? ans.valor : ans.respuesta !== undefined ? ans.respuesta : 0;
          const val = typeof rawVal === "number" ? rawVal : Number(rawVal) || 0;
          return [code, val];
        })
        .filter(([code]: [string, number]) => code !== "undefined" && code !== "null" && code !== "")
    ),
    open_question: "",
  }));
}

export async function buildPhase5Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, externalFileUrl, extraFileUrls, baseMetadata, ensureFreshUrl } = ctx;

  const { data: fase4 } = await supabase
    .from("fases_estado")
    .select("datos_consolidados")
    .eq("proyecto_id", projectId)
    .eq("numero_fase", 4)
    .single();

  const { data: respPredictiva } = await supabase
    .from("encuestas_respuestas")
    .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
    .eq("proyecto_id", projectId)
    .eq("tipo_encuesta", "predictiva");

  const { data: respAgil } = await supabase
    .from("encuestas_respuestas")
    .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
    .eq("proyecto_id", projectId)
    .eq("tipo_encuesta", "agil");

  const pmoTypeResolved = (comments as any)?.pmoType ?? "Hibrido";

  const fileUrls: { url: string; type: string }[] = [];
  for (const url of [externalFileUrl, ...(extraFileUrls ?? [])].filter(Boolean)) {
    const freshUrl = await ensureFreshUrl(url as string);
    fileUrls.push({ url: freshUrl, type: fileTypeFromPath(url as string) });
  }

  return {
    metadata: { ...baseMetadata, agent_id: "agente-5" },
    payload: {
      approved_pmo_type: pmoTypeResolved,
      maturity_surveys: {
        predictive: {
          survey_type: "predictive",
          input_method: (respPredictiva ?? []).length > 0 ? "online_survey" : "bulk_upload",
          answers: formatMaturityAnswers(respPredictiva ?? []),
        },
        agile: {
          survey_type: "agile",
          input_method: (respAgil ?? []).length > 0 ? "online_survey" : "bulk_upload",
          answers: formatMaturityAnswers(respAgil ?? []),
        },
      },
      fase4_diagnostico_referencia: (fase4?.datos_consolidados as any)?.diagnosis || fase4?.datos_consolidados || null,
    },
    comments: (comments as any)?.comentario_consultor ?? null,
    __fileUrls: fileUrls,
  };
}
