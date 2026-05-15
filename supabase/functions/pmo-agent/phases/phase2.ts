import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

export async function buildPhase2Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata, ensureFreshUrl, getOrganizationContext } = ctx;
  const { data: entData, error } = await supabase
    .from("entrevistas")
    .select("id, nombre, cargo, area, notas, created_at, storage_path, file_name")
    .eq("proyecto_id", projectId);

  if (error) throw new Error(`Error leyendo entrevistas: ${error.message}`);

  const fileUrls: { url: string; type: string; label?: string }[] = [];

  const interviews = await Promise.all((entData ?? []).map(async (e: Record<string, any>, idx: number) => {
    const interviewId = `int-${String(idx + 1).padStart(3, "0")}`;
    const fileType = e.storage_path ? fileTypeFromPath(e.storage_path) : null;
    const attachmentReference = e.storage_path
      ? {
        file_name: e.file_name ?? "Archivo adjunto sin nombre",
        file_format: fileType === "text/csv" ? "csv" : "pdf",
        traceability_note: `El contenido del archivo adjunto corresponde a la entrevista ${interviewId}.`,
      }
      : null;

    if (e.storage_path) {
      const urlToUse = await ensureFreshUrl(e.storage_path);
      fileUrls.push({
        url: urlToUse,
        type: fileType ?? "application/pdf",
        label: [
          "Archivo adjunto de entrevista",
          `interview_id: ${interviewId}`,
          `interviewee_name: ${e.nombre ?? "No disponible"}`,
          `interviewee_role: ${e.cargo ?? "No disponible"}`,
          `interviewee_area: ${e.area ?? "No disponible"}`,
          `file_name: ${e.file_name ?? "No disponible"}`,
        ].join("\n"),
      });
    }

    return {
      interview_id: interviewId,
      interviewee_name: e.nombre,
      interviewee_role: e.cargo || e.area,
      interviewee_area: e.area,
      interview_date: e.created_at,
      attachment: attachmentReference,
      answers: [
        {
          question_id: "q-general",
          question_text: "Notas de la entrevista libre",
          answer_text: e.storage_path
            ? [
              `(Ver archivo adjunto asociado a ${interviewId}: ${e.file_name}).`,
              e.notas || "No se registraron notas textuales adicionales para esta entrevista.",
            ].join(" ")
            : e.notas,
        },
      ],
    };
  }));

  return {
    metadata: { ...baseMetadata, agent_id: "asistente-2" },
    payload: {
      organization_context: await getOrganizationContext(),
      interviews,
      total_interviews: interviews.length,
    },
    comments,
    __fileUrls: fileUrls,
  };
}
