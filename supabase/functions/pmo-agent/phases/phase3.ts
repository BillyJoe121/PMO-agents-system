import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

export async function buildPhase3Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, externalFileUrl, now, baseMetadata, ensureFreshUrl, getOrganizationContext } = ctx;
  const { data: respuestas, error } = await supabase
    .from("encuestas_respuestas")
    .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
    .eq("proyecto_id", projectId)
    .eq("tipo_encuesta", "idoneidad");

  if (error) throw new Error(`Error leyendo encuestas: ${error.message}`);

  const { data: questions } = await supabase
    .from("banco_preguntas")
    .select("codigo, categoria, texto_pregunta")
    .eq("tipo_encuesta", "idoneidad");

  const questionByCode = new Map((questions ?? []).map((q: any) => [q.codigo, q]));

  const formattedRespondents = (respuestas ?? []).map((r: any, idx: number) => {
    const parsedAnswers = Array.isArray(r.respuestas) ? r.respuestas : [];

    return {
      respondent_id: `r-${String(idx + 1).padStart(3, "0")}`,
      name: r.nombre_encuestado,
      role: r.cargo_encuestado,
      area: r.area_encuestado || "Sin area",
      answers: parsedAnswers.map((ans: any) => {
        const question = questionByCode.get(ans.codigo);
        return {
          question_id: ans.codigo,
          question_code: ans.codigo,
          question_text: question?.texto_pregunta ?? "No disponible",
          answer_value: ans.valor,
          answer_score: ans.valor,
        };
      }),
    };
  });

  const fileUrls: { url: string; type: string; label?: string }[] = [];
  if (externalFileUrl) {
    const freshExternalUrl = await ensureFreshUrl(externalFileUrl);
    const fileType = fileTypeFromPath(externalFileUrl);
    const fileName = decodeURIComponent(String(externalFileUrl).split("?")[0].split("/").pop() ?? "archivo_externo");
    fileUrls.push({
      url: freshExternalUrl,
      type: fileType,
      label: [
        "Archivo externo de fase 3 - encuesta de idoneidad",
        `input_method: ${formattedRespondents.length > 0 ? "mixed" : "offline_file"}`,
        `file_name: ${fileName}`,
        `file_format: ${fileType === "text/csv" ? "csv" : "pdf"}`,
        "scale: 1-10",
      ].join("\n"),
    });
  }

  return {
    metadata: { ...baseMetadata, agent_id: "asistente-3" },
    payload: {
      organization_context: await getOrganizationContext(),
      input_method: externalFileUrl
        ? formattedRespondents.length > 0 ? "mixed" : "offline_file"
        : "online_survey",
      respondents: formattedRespondents,
      survey_completed_at: now,
    },
    comments,
    __fileUrls: fileUrls,
  };
}
