import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

function normalizePmoType(value: unknown) {
  const token = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (token.includes("agil")) return "Agil";
  if (token.includes("predict")) return "Predictivo";
  return "Hibrido";
}

function extractPhase4Diagnosis(value: unknown) {
  const record = value as any;
  return record?.diagnosis && typeof record.diagnosis === "object"
    ? record.diagnosis
    : record;
}

function extractPhase4Weights(phase4Diagnosis: any, pmoType: string) {
  const breakdown = phase4Diagnosis?.type_breakdown ?? phase4Diagnosis?.typeBreakdown ?? {};
  const agile = Number(breakdown.agile_weight ?? breakdown.agileWeight);
  const predictive = Number(breakdown.predictive_weight ?? breakdown.predictiveWeight);

  if (Number.isFinite(agile) && Number.isFinite(predictive)) {
    return { agile_weight: agile, predictive_weight: predictive };
  }

  if (pmoType === "Agil") return { agile_weight: 100, predictive_weight: 0 };
  if (pmoType === "Predictivo") return { agile_weight: 0, predictive_weight: 100 };

  return { agile_weight: 0, predictive_weight: 0 };
}

function coerceNumericAnswer(rawVal: unknown) {
  if (typeof rawVal === "number") return rawVal;
  if (typeof rawVal === "string" && rawVal.trim() !== "") {
    const parsed = Number(rawVal);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractOpenQuestion(row: any) {
  const direct = row?.open_question ?? row?.pregunta_abierta ?? row?.respuesta_abierta ?? row?.comentario_abierto ?? row?.comentarios;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const answers = Array.isArray(row?.respuestas) ? row.respuestas : [];
  const openAnswer = answers.find((ans: any) => {
    const code = String(ans?.codigo ?? ans?.id ?? ans?.pregunta_id ?? ans?.pregunta_codigo ?? ans?.pregunta ?? "").toLowerCase();
    return code.includes("open") || code.includes("abierta") || code.includes("comentario");
  });

  const value = openAnswer?.valor ?? openAnswer?.respuesta ?? openAnswer?.texto ?? openAnswer?.comentario;
  return typeof value === "string" ? value.trim() : "";
}

function formatMaturityAnswers(rows: any[]) {
  return (rows ?? []).map((r: any, idx: number) => {
    const rawResponses = r?.respuestas;
    const entries = Array.isArray(rawResponses)
      ? rawResponses.map((ans: any, ansIdx: number) => {
        const code = String(ans?.codigo || ans?.id || ans?.pregunta_id || ans?.pregunta_codigo || ans?.pregunta || `Pregunta_${ansIdx + 1}`);
        const rawVal = ans?.valor !== undefined ? ans.valor : ans?.respuesta !== undefined ? ans.respuesta : ans?.value;
        return [code, coerceNumericAnswer(rawVal)] as [string, number | null];
      })
      : rawResponses && typeof rawResponses === "object"
        ? Object.entries(rawResponses).map(([code, rawVal]) => [code, coerceNumericAnswer(rawVal)] as [string, number | null])
        : [];

    return {
      respondent_id: r?.respondent_id ?? r?.id ?? `r-${String(idx + 1).padStart(3, "0")}`,
      name: r?.nombre_encuestado ?? r?.name ?? "",
      role: r?.cargo_encuestado ?? r?.role ?? "",
      responses: Object.fromEntries(
        entries.filter(([code, val]) => {
          const normalizedCode = String(code ?? "").trim().toLowerCase();
          return normalizedCode !== "" &&
            normalizedCode !== "undefined" &&
            normalizedCode !== "null" &&
            !normalizedCode.includes("open") &&
            !normalizedCode.includes("abierta") &&
            !normalizedCode.includes("comentario") &&
            val !== null;
        })
      ),
      open_question: extractOpenQuestion(r),
    };
  });
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

  const phase4Diagnosis = extractPhase4Diagnosis(fase4?.datos_consolidados);
  const pmoTypeResolved = normalizePmoType((comments as any)?.pmoType ?? phase4Diagnosis?.pmo_type ?? phase4Diagnosis?.pmoType ?? "Hibrido");
  const phase4Weights = extractPhase4Weights(phase4Diagnosis, pmoTypeResolved);

  const fileUrls: { url: string; type: string }[] = [];
  for (const url of [externalFileUrl, ...(extraFileUrls ?? [])].filter(Boolean)) {
    const freshUrl = await ensureFreshUrl(url as string);
    fileUrls.push({ url: freshUrl, type: fileTypeFromPath(url as string) });
  }

  return {
    metadata: { ...baseMetadata, agent_id: "asistente-5" },
    payload: {
      approved_pmo_type: pmoTypeResolved,
      approved_phase4_weights: phase4Weights,
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
