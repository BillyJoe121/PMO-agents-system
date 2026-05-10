import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

export async function buildPhase3Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, externalFileUrl, now, baseMetadata, ensureFreshUrl, getOrganizationContext } = ctx;
  const { data: respuestas, error } = await supabase
    .from("encuestas_respuestas")
    .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
    .eq("proyecto_id", projectId);

  if (error) throw new Error(`Error leyendo encuestas: ${error.message}`);

  const formattedRespondents = (respuestas ?? []).map((r: any, idx: number) => {
    const parsedAnswers = Array.isArray(r.respuestas) ? r.respuestas : [];

    return {
      respondent_id: `r-${idx + 1}`,
      name: r.nombre_encuestado,
      role: r.cargo_encuestado,
      area: r.area_encuestado || "Sin area",
      answers: parsedAnswers.map((ans: any) => ({
        question_code: ans.codigo,
        answer_score: ans.valor,
      })),
    };
  });

  const fileUrls: { url: string; type: string }[] = [];
  if (externalFileUrl) {
    const freshExternalUrl = await ensureFreshUrl(externalFileUrl);
    fileUrls.push({ url: freshExternalUrl, type: fileTypeFromPath(externalFileUrl) });
  }

  return {
    metadata: { ...baseMetadata, agent_id: "agente-3" },
    payload: {
      organization_context: await getOrganizationContext(),
      input_method: externalFileUrl ? "online_and_offline" : "online_survey",
      respondents: formattedRespondents,
      survey_completed_at: now,
    },
    comments,
    __fileUrls: fileUrls,
  };
}
