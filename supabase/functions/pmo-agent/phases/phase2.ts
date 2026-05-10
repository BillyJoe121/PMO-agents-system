import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

export async function buildPhase2Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata, ensureFreshUrl, getOrganizationContext } = ctx;
  const { data: entData, error } = await supabase
    .from("entrevistas")
    .select("id, nombre, cargo, area, notas, created_at, storage_path, file_name")
    .eq("proyecto_id", projectId);

  if (error) throw new Error(`Error leyendo entrevistas: ${error.message}`);

  const fileUrls: { url: string; type: string }[] = [];

  const interviews = await Promise.all((entData ?? []).map(async (e: Record<string, any>, idx: number) => {
    if (e.storage_path) {
      const urlToUse = await ensureFreshUrl(e.storage_path);
      fileUrls.push({ url: urlToUse, type: fileTypeFromPath(e.storage_path) });
    }

    return {
      interview_id: `int-${String(idx + 1).padStart(3, "0")}`,
      interviewee_name: e.nombre,
      interviewee_role: e.cargo || e.area,
      interview_date: e.created_at,
      answers: [
        {
          question_id: "q-general",
          question_text: "Notas de la entrevista libre",
          answer_text: e.storage_path ? `(Ver archivo adjunto: ${e.file_name}) ` + e.notas : e.notas,
        },
      ],
    };
  }));

  return {
    metadata: { ...baseMetadata, agent_id: "agente-1" },
    payload: {
      organization_context: await getOrganizationContext(),
      interviews,
      total_interviews: interviews.length,
    },
    comments,
    __fileUrls: fileUrls,
  };
}

