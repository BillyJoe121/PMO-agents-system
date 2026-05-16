import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./_shared/cors.ts";
import { attachModelMetadata, callAiWithFallback, getAiModelSettings, getModelCandidates } from "./_shared/aiModels.ts";
import { createRunId, hasCompletedPhaseData, hasMeaningfulData, isProcessingMarker, isProcessingStale, phaseProcessingPayload } from "./_shared/processing.ts";
import { getPayloadForPhase } from "./_shared/phasePayloads.ts";
import { withCompletedPhase3Items } from "./_shared/phase3Completion.ts";

function extractCommentText(comments: unknown): string | null {
  if (typeof comments === "string" && comments.trim()) return comments.trim();
  if (comments && typeof comments === "object") {
    const record = comments as Record<string, unknown>;
    const value = record.comments ?? record.comment ?? record.comentario_consultor;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractCurrentGuideForRevision(comments: unknown): any | null {
  if (!comments || typeof comments !== "object") return null;
  const record = comments as Record<string, unknown>;
  return (record.current_guide_for_revision ?? record.previous_guide ?? record.current_guide ?? null) as any;
}

function normalizeMethodologyType(value: unknown) {
  const token = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (token.includes("agil")) return "Agil";
  if (token.includes("predict")) return "Predictivo";
  return "Hibrido";
}

function normalizePhase4Envelope(value: unknown, inputEnvelope: any, processingTimeSeconds: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const record = value as Record<string, any>;
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata
    : {};
  const diagnosis = record.diagnosis && typeof record.diagnosis === "object" && !Array.isArray(record.diagnosis)
    ? record.diagnosis
    : null;

  const normalized: Record<string, any> = {
    metadata: {
      project_id: inputEnvelope?.metadata?.project_id ?? metadata.project_id ?? "",
      phase: 4,
      agent_id: "asistente-4",
      timestamp: new Date().toISOString(),
      iteration: inputEnvelope?.metadata?.iteration ?? metadata.iteration ?? 1,
      status: record.error ? "error" : (metadata.status ?? "success"),
      processing_time_seconds: Number(processingTimeSeconds.toFixed(2)),
    },
    diagnosis,
    error: record.error ?? null,
  };

  if (diagnosis) {
    const rawPmoType = diagnosis.pmo_type ?? diagnosis.pmoType;
    if (rawPmoType !== undefined && rawPmoType !== null) {
      diagnosis.pmo_type = normalizeMethodologyType(rawPmoType);
    }
    if (diagnosis.type_breakdown && typeof diagnosis.type_breakdown === "object") {
      const agile = Number(diagnosis.type_breakdown.agile_weight);
      const predictive = Number(diagnosis.type_breakdown.predictive_weight);
      if (Number.isFinite(agile) && Number.isFinite(predictive) && agile + predictive !== 100) {
        const agileWeight = Math.max(0, Math.min(100, Math.round(agile)));
        diagnosis.type_breakdown.agile_weight = agileWeight;
        diagnosis.type_breakdown.predictive_weight = 100 - agileWeight;
      }
      if (diagnosis.pmo_type !== "Hibrido") {
        diagnosis.type_breakdown.hybrid_rationale = "";
      }
    }
    if (Array.isArray(diagnosis.supporting_evidence)) {
      diagnosis.supporting_evidence = diagnosis.supporting_evidence.slice(0, 8);
    }
  }

  return normalized;
}

function normalizePhase5Envelope(value: unknown, inputEnvelope: any, processingTimeSeconds: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const record = value as Record<string, any>;
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata
    : {};

  return {
    ...record,
    metadata: {
      ...metadata,
      project_id: inputEnvelope?.metadata?.project_id ?? metadata.project_id ?? "",
      phase: 5,
      agent_id: "asistente-5",
      timestamp: metadata.timestamp ?? new Date().toISOString(),
      iteration: inputEnvelope?.metadata?.iteration ?? metadata.iteration ?? 1,
      status: record.error ? "error" : (metadata.status ?? "success"),
      processing_time_seconds: Number(processingTimeSeconds.toFixed(2)),
    },
  };
}

function normalizePhase6Envelope(value: unknown, inputEnvelope: any, processingTimeSeconds: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const record = value as Record<string, any>;
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata
    : {};

  return {
    ...record,
    metadata: {
      ...metadata,
      project_id: inputEnvelope?.metadata?.project_id ?? metadata.project_id ?? "",
      phase: 6,
      agent_id: "agente-6",
      timestamp: metadata.timestamp ?? new Date().toISOString(),
      iteration: inputEnvelope?.metadata?.iteration ?? metadata.iteration ?? 1,
      status: record.error ? "error" : (metadata.status ?? "success"),
      processing_time_seconds: Number(processingTimeSeconds.toFixed(2)),
    },
  };
}

const PHASE7_PROMPT_PART_1 = 7;
const PHASE7_PROMPT_PART_2 = 10;

function parseJsonIfString(value: unknown): any {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return [];
}

function pickFirst(...values: unknown[]) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
  });
}

function formatGuideSectionTitle(key: string) {
  const known: Record<string, string> = {
    S1_introduccion: "Introduccion",
    S2_objetivo: "Objetivo",
    S3_alcance: "Alcance",
    S4_responsables_guia: "Responsables de la guia",
    S5_marco_conceptual: "Marco conceptual",
    S6_marco_de_referencia: "Marco de referencia",
    S7_politicas: "Politicas",
    S8_roles_y_responsabilidades: "Roles y responsabilidades",
    S9_comites: "Comites",
    S10_flujos_de_procesos: "Flujos de procesos",
    S11_indicadores_de_gestion: "Indicadores de gestion",
    S12_documentos_generados: "Documentos generados",
  };
  if (known[key]) return known[key];
  return key
    .replace(/^S(\d+)_?/, "S$1 ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sectionIdFromGuideKey(key: string) {
  return key.match(/^S\d+/)?.[0] ?? key;
}

function guideContentToArray(value: unknown) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).map(([key, contenido]) => ({
    section_id: sectionIdFromGuideKey(key),
    section_key: key,
    section_title: formatGuideSectionTitle(key),
    contenido,
  }));
}

function candidateGuideContainers(value: unknown) {
  const parsed = parseJsonIfString(value);
  const root = asRecord(parsed) ?? {};
  return [
    root,
    root.diagnosis,
    root.guia_metodologica,
    root.guiaMetodologica,
    root.guia,
    root.documento,
    root.resultado,
    root.result,
    root.data,
  ].map(parseJsonIfString).filter(Boolean);
}

function extractGuideContent(value: unknown) {
  for (const candidate of candidateGuideContainers(value)) {
    const record = asRecord(candidate);
    const guideContent = pickFirst(
      record?.guide_content,
      record?.guideContent,
      record?.contenido_guia,
      record?.contenido?.guide_content
    );
    const normalized = guideContentToArray(guideContent);
    if (normalized.length > 0) return normalized;
  }
  return [];
}

function extractGuideChapters(value: unknown) {
  for (const candidate of candidateGuideContainers(value)) {
    const record = asRecord(candidate);
    const chapters = pickFirst(
      record?.capitulos,
      record?.chapters,
      record?.contenido?.capitulos,
      record?.estructura?.capitulos
    );
    if (Array.isArray(chapters) && chapters.length > 0) return chapters;
  }
  return [];
}

function extractGuideTitle(value: unknown) {
  for (const candidate of candidateGuideContainers(value)) {
    const record = asRecord(candidate);
    const title = pickFirst(record?.titulo, record?.title, record?.nombre_documento, record?.document_title);
    if (title) return String(title);
  }
  return "Guia metodologica de gestion de proyectos";
}

function extractGuideSummary(value: unknown) {
  for (const candidate of candidateGuideContainers(value)) {
    const record = asRecord(candidate);
    const summary = pickFirst(record?.resumen_ejecutivo, record?.resumen, record?.summary, record?.introduccion);
    if (summary) return String(summary);
  }
  return "";
}

function mergeStringArrays(key: string, ...sources: unknown[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const source of sources) {
    for (const candidate of candidateGuideContainers(source)) {
      const record = asRecord(candidate);
      const values = asArray(record?.[key]);
      for (const value of values) {
        const text = typeof value === "string" ? value.trim() : JSON.stringify(value);
        if (text && !seen.has(text)) {
          seen.add(text);
          merged.push(text);
        }
      }
    }
  }
  return merged;
}

function assemblePhase7Guide(part1: unknown, part2: unknown) {
  const guideContent = [...extractGuideContent(part1), ...extractGuideContent(part2)];
  if (guideContent.length > 0) {
    return {
      titulo: extractGuideTitle(part1) || extractGuideTitle(part2),
      resumen_ejecutivo: [extractGuideSummary(part1), extractGuideSummary(part2)].filter(Boolean).join("\n\n"),
      guide_content: guideContent,
      diagnosis: {
        guide_content: guideContent,
      },
      artefactos_recomendados: mergeStringArrays("artefactos_recomendados", part1, part2),
      criterios_implementacion: mergeStringArrays("criterios_implementacion", part1, part2),
      riesgos_adopcion: mergeStringArrays("riesgos_adopcion", part1, part2),
      metricas_seguimiento: mergeStringArrays("metricas_seguimiento", part1, part2),
    };
  }

  const chapters = [...extractGuideChapters(part1), ...extractGuideChapters(part2)]
    .map((chapter, index) => ({
      ...(asRecord(chapter) ?? { contenido: chapter }),
      numero: index + 1,
    }));

  if (chapters.length > 0) {
    return {
      titulo: extractGuideTitle(part1) || extractGuideTitle(part2),
      resumen_ejecutivo: [extractGuideSummary(part1), extractGuideSummary(part2)].filter(Boolean).join("\n\n"),
      capitulos: chapters,
      artefactos_recomendados: mergeStringArrays("artefactos_recomendados", part1, part2),
      criterios_implementacion: mergeStringArrays("criterios_implementacion", part1, part2),
      riesgos_adopcion: mergeStringArrays("riesgos_adopcion", part1, part2),
      metricas_seguimiento: mergeStringArrays("metricas_seguimiento", part1, part2),
    };
  }

  return {
    titulo: extractGuideTitle(part1) || extractGuideTitle(part2),
    resumen_ejecutivo: [extractGuideSummary(part1), extractGuideSummary(part2)].filter(Boolean).join("\n\n"),
    capitulos: [
      {
        numero: 1,
        titulo: "Parte 7.1",
        introduccion: "Contenido generado por el primer prompt de la fase 7.",
        secciones: [{ titulo: "Contenido", contenido: JSON.stringify(part1) }],
      },
      {
        numero: 2,
        titulo: "Parte 7.2",
        introduccion: "Contenido generado por el segundo prompt de la fase 7.",
        secciones: [{ titulo: "Contenido", contenido: JSON.stringify(part2) }],
      },
    ],
  };
}

function phase7ProcessingPayload(
  runId: string,
  stage: string,
  previousGuide: unknown,
  comments: unknown,
  iteration: number,
  parts: Record<string, unknown> = {},
  message?: string
) {
  const previousRecord = asRecord(previousGuide);
  return {
    _processing: true,
    _run_id: runId,
    phaseNumber: 7,
    split_mode: "7.1_7.2",
    stage,
    started_at: new Date().toISOString(),
    iteration,
    comment: extractCommentText(comments),
    _previous_current: previousRecord?._current ?? previousRecord?.diagnosis ?? previousGuide ?? null,
    _previous_versions: Array.isArray(previousRecord?._versions) ? previousRecord?._versions : [],
    _parts: parts,
    message,
  };
}

async function getAgentConfigForPrompt(supabase: any, promptPhaseNumber: number) {
  const { data: agentConfig, error } = await supabase
    .from("configuracion_agentes")
    .select("*")
    .eq("fase_numero", promptPhaseNumber)
    .single();

  if (error || !agentConfig) {
    throw new Error(`Sin configuracion para el prompt ${promptPhaseNumber}. Verifica configuracion_agentes.fase_numero=${promptPhaseNumber}. Error: ${error?.message}`);
  }
  if (!agentConfig.prompt_sistema) {
    throw new Error(`La configuracion del prompt ${promptPhaseNumber} existe pero prompt_sistema esta vacio.`);
  }
  return agentConfig;
}

async function callJsonPrompt(
  supabase: any,
  promptPhaseNumber: number,
  inputEnvelope: unknown,
  extraInstruction: string,
) {
  const agentConfig = await getAgentConfigForPrompt(supabase, promptPhaseNumber);
  const fullPrompt = `${agentConfig.prompt_sistema}\n\nJSON DE ENTRADA:\n${JSON.stringify(inputEnvelope, null, 2)}${extraInstruction}

IMPORTANTE: DEBES DEVOLVER UNICAMENTE UN OBJETO JSON VALIDO.
Tu respuesta DEBE empezar con '{' y terminar con '}'. Sin markdown, sin texto extra.`;

  const modelSettings = await getAiModelSettings(supabase);
  const modelsToTry = getModelCandidates(modelSettings, agentConfig?.modelo);
  const apiKeys = {
    openai: Deno.env.get("OPENAI_API_KEY") ?? "",
    anthropic: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
    gemini: Deno.env.get("GOOGLE_API_KEY") ?? Deno.env.get("GEMINI_API_KEY") ?? "",
  };

  const startTime = Date.now();
  const aiResult = await callAiWithFallback(apiKeys, modelsToTry, {
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: agentConfig?.temperatura ?? 1,
      maxOutputTokens: 65536,
      providerTimeoutMs: 110000,
      responseMimeType: "application/json",
    },
  });

  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const candidate = aiResult.data?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const rawContent = candidate?.content?.parts?.[0]?.text || "";

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      `El modelo ${aiResult.provider}:${aiResult.model} corto el prompt ${promptPhaseNumber} por limite de tokens antes de completar el JSON.`
    );
  }

  let cleaned = rawContent.trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  }

  let diagnosis: unknown;
  try {
    diagnosis = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `La IA devolvio un JSON invalido en el prompt ${promptPhaseNumber}. Tiempo: ${processingTime}s. Respuesta original: ${rawContent.substring(0, 150)}...`
    );
  }

  return {
    diagnosis: attachModelMetadata(diagnosis, aiResult, modelSettings),
    processingTime,
    aiResult,
    modelSettings,
  };
}

async function getPhase7State(supabase: any, projectId: string) {
  const { data } = await supabase
    .from("fases_estado")
    .select("estado_visual, datos_consolidados, updated_at")
    .eq("proyecto_id", projectId)
    .eq("numero_fase", 7)
    .maybeSingle();
  return data;
}

async function isActivePhase7Run(supabase: any, projectId: string, runId: string) {
  const state = await getPhase7State(supabase, projectId);
  const data = state?.datos_consolidados as any;
  return state?.estado_visual === "procesando" && data?._processing === true && data?._run_id === runId;
}

async function savePhase7Error(
  supabase: any,
  projectId: string,
  runId: string,
  stage: string,
  error: unknown,
  extra: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Error desconocido ejecutando fase 7";
  const state = await getPhase7State(supabase, projectId);
  const current = (state?.datos_consolidados as any) ?? {};
  if (current?._run_id && current._run_id !== runId) return;

  await supabase
    .from("fases_estado")
    .update({
      estado_visual: "error",
      datos_consolidados: {
        _error: true,
        phaseNumber: 7,
        split_mode: "7.1_7.2",
        stage,
        _run_id: runId,
        message,
        timestamp: new Date().toISOString(),
        _current: current?._previous_current ?? null,
        _versions: current?._previous_versions ?? [],
        _latest_version: Array.isArray(current?._previous_versions) ? current._previous_versions.length : 0,
        _previous_current: current?._previous_current ?? null,
        _previous_versions: current?._previous_versions ?? [],
        _parts: current?._parts ?? {},
        ...extra,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("proyecto_id", projectId)
      .eq("numero_fase", 7);
}

function phase7Part1Instruction() {
  return `

REQUISITO DE ORQUESTACION PARA FASE 7.1:
Estas ejecutando el ASISTENTE 7.1 - FUNDAMENTOS DE LA GUIA METODOLOGICA. El JSON DE ENTRADA usa payload.approved_phase4_diagnosis, payload.approved_phase5_diagnosis, payload.approved_phase6_diagnosis, payload.business_rules y payload.comments.
Genera exclusivamente S1 a S9: introduccion, objetivo, alcance, responsables de la guia, marco conceptual, marco de referencia, politicas, roles y comites. No produzcas flujos, indicadores, artefactos, plantillas ni recomendaciones finales.
Devuelve exclusivamente el contrato JSON de 7.1 con metadata.phase="7.1", metadata.agent_id="asistente-fundamentos-guia", diagnosis.guide_content.S1_introduccion a diagnosis.guide_content.S9_comites y error=null si es exitoso.`;
}

function phase7Part2Instruction() {
  return `

REQUISITO DE ORQUESTACION PARA FASE 7.2:
Estas ejecutando el ASISTENTE 7.2 - FLUJOS DE PROCESOS, INDICADORES Y DOCUMENTOS GENERADOS. El JSON DE ENTRADA incluye payload.approved_phase71_output con la primera parte ya generada.
Genera exclusivamente S10 a S12: flujos de procesos, indicadores de gestion y documentos generados. No repitas ni redefinas introduccion, objetivo, alcance, responsables, marco conceptual, marco de referencia, politicas, roles ni comites.
Usa los cargos exactos de payload.approved_phase71_output.guide_content.S8_roles_y_responsabilidades y las politicas/comites de S7/S9 como fuente de coherencia. Devuelve exclusivamente el contrato JSON de 7.2 con metadata.phase="7.2", metadata.agent_id="asistente-operativo-guia", diagnosis.guide_content.S10_flujos_de_procesos a diagnosis.guide_content.S12_documentos_generados y error=null si es exitoso.`;
}

function normalizePhase71OutputForPart2(part1Data: unknown) {
  const record = asRecord(parseJsonIfString(part1Data)) ?? {};
  const diagnosis = asRecord(record.diagnosis) ?? record;
  const rawGuideContent = diagnosis.guide_content ?? {};
  const guideContent = Array.isArray(rawGuideContent)
    ? Object.fromEntries(rawGuideContent.map((section: any, index: number) => {
      const key = section?.section_key ?? section?.section_id ?? `S${index + 1}`;
      return [key, section?.contenido ?? section?.content ?? section];
    }))
    : rawGuideContent;
  return {
    pmo_type: diagnosis.pmo_type ?? "",
    primary_framework: diagnosis.primary_framework ?? "",
    secondary_framework: diagnosis.secondary_framework ?? "",
    overall_maturity_label: diagnosis.overall_maturity_label ?? "",
    target_audience: Array.isArray(diagnosis.target_audience) ? diagnosis.target_audience : [],
    tone: diagnosis.tone ?? "",
    guide_content: guideContent,
  };
}

async function runPhase7Part1(
  supabase: any,
  projectId: string,
  runId: string,
  iteration: number,
  comments: unknown,
) {
  try {
    if (!(await isActivePhase7Run(supabase, projectId, runId))) return;

    const envelopeData = await getPayloadForPhase(supabase, projectId, 7, iteration, comments);
    const inputEnvelope = {
      ...envelopeData,
      metadata: {
        ...((envelopeData as any).metadata ?? {}),
        phase: "7.1",
        agent_id: "asistente-fundamentos-guia",
        iteration,
      },
      payload: {
        ...((envelopeData as any).payload ?? {}),
      },
    };

    const part1 = await callJsonPrompt(supabase, PHASE7_PROMPT_PART_1, inputEnvelope, phase7Part1Instruction());
    if (!(await isActivePhase7Run(supabase, projectId, runId))) return;

    const currentState = await getPhase7State(supabase, projectId);
    const currentData = (currentState?.datos_consolidados as any) ?? {};
    const parts = {
      ...(currentData?._parts ?? {}),
      part_1: {
        status: "success",
        prompt_phase: PHASE7_PROMPT_PART_1,
        processing_time_seconds: Number(part1.processingTime),
        generated_at: new Date().toISOString(),
        data: part1.diagnosis,
      },
    };

    await supabase
      .from("fases_estado")
      .update({
        estado_visual: "procesando",
        datos_consolidados: {
          ...currentData,
          stage: "part_2_queued",
          _parts: parts,
          message: "La parte 7.1 finalizo. Iniciando el prompt 7.2.",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 7);

    // Invoke Part 2 as a separate Edge Function execution. Do not await the
    // response here: Part 2 can take a long time and must own its runtime budget.
    scheduleBackground(
      supabase.functions.invoke("pmo-agent", {
        body: { projectId, phaseNumber: 7, phase7Stage: "part2", runId, iteration, comments },
      }).then((invokeResult: any) => {
        if (invokeResult.error) {
          console.error("[pmo-agent] Error invocando Fase 7.2:", invokeResult.error);
        }
      })
    );
  } catch (error) {
    console.error("[pmo-agent] Error Fase 7.1:", error);
    await savePhase7Error(supabase, projectId, runId, "error_part_1", error);
  }
}

async function runPhase7Part2(
  supabase: any,
  projectId: string,
  runId: string,
  iteration: number,
  comments: unknown,
) {
  try {
    if (!(await isActivePhase7Run(supabase, projectId, runId))) return;
    const currentState = await getPhase7State(supabase, projectId);
    const currentData = (currentState?.datos_consolidados as any) ?? {};
    const part1Data = currentData?._parts?.part_1?.data;
    if (!part1Data) throw new Error("No se encontro la salida de 7.1 para iniciar 7.2.");

    await supabase
      .from("fases_estado")
      .update({
        estado_visual: "procesando",
        datos_consolidados: {
          ...currentData,
          stage: "part_2",
          message: "La parte 7.2 esta en ejecucion.",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 7);

    const envelopeData = await getPayloadForPhase(supabase, projectId, 7, iteration, comments);
    const inputEnvelope = {
      ...envelopeData,
      metadata: {
        ...((envelopeData as any).metadata ?? {}),
        phase: "7.2",
        agent_id: "asistente-operativo-guia",
        iteration,
      },
      payload: {
        ...((envelopeData as any).payload ?? {}),
        approved_phase71_output: normalizePhase71OutputForPart2(part1Data),
        business_rules: {
          flujos: {},
          indicadores: {},
          documentos_generados: {},
        },
      },
    };

    const part2 = await callJsonPrompt(supabase, PHASE7_PROMPT_PART_2, inputEnvelope, phase7Part2Instruction());
    if (!(await isActivePhase7Run(supabase, projectId, runId))) return;

    const latestState = await getPhase7State(supabase, projectId);
    const latestData = (latestState?.datos_consolidados as any) ?? currentData;
    const latestPart1 = latestData?._parts?.part_1?.data ?? part1Data;
    const assembled = assemblePhase7Guide(latestPart1, part2.diagnosis);

    const previousVersions = Array.isArray(latestData?._previous_versions) ? latestData._previous_versions : [];
    const versionNumber = previousVersions.length + 1;
    const generatedAt = new Date().toISOString();
    const commentText = extractCommentText(comments);
    const parts = {
      ...(latestData?._parts ?? {}),
      part_2: {
        status: "success",
        prompt_phase: PHASE7_PROMPT_PART_2,
        processing_time_seconds: Number(part2.processingTime),
        generated_at: generatedAt,
        data: part2.diagnosis,
      },
    };

    const versionEntry = {
      number: versionNumber,
      generatedAt,
      status: versionNumber > 1 ? "revisado" : "generado",
      comment: commentText,
      data: assembled,
      split_generation: {
        prompts: [PHASE7_PROMPT_PART_1, PHASE7_PROMPT_PART_2],
        parts,
      },
    };

    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: 7,
          estado_visual: "disponible",
          datos_consolidados: {
            _current: assembled,
            _versions: [...previousVersions, versionEntry],
            _latest_version: versionNumber,
            _generated_at: generatedAt,
            _last_comment: commentText,
            _split_generation: {
              mode: "7.1_7.2",
              run_id: runId,
              prompts: [PHASE7_PROMPT_PART_1, PHASE7_PROMPT_PART_2],
              parts,
            },
          },
          updated_at: generatedAt,
        },
        { onConflict: "proyecto_id,numero_fase" }
      );
  } catch (error) {
    console.error("[pmo-agent] Error Fase 7.2:", error);
    await savePhase7Error(supabase, projectId, runId, "error_part_2", error);
  }
}

function scheduleBackground(job: Promise<unknown>) {
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(job);
  } else {
    job.catch((error) => console.error("[pmo-agent] Background job error:", error));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Permite llamadas desde el Frontend React
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verifica si las fases 1, 2 y 3 están completadas y si es así,
 * dispara automáticamente el agente de la Fase 4.
 */
async function checkAndTriggerPhase4(
  supabase: any,
  projectId: string
) {
  const { data: fases } = await supabase
    .from("fases_estado")
    .select("numero_fase, estado_visual")
    .eq("proyecto_id", projectId)
    .in("numero_fase", [1, 2, 3]);

  const allCompleted = (fases ?? []).length === 3 && (fases ?? []).every(
    (f: { estado_visual: string }) => f.estado_visual === "completado"
  );

  if (!allCompleted) return;

  const { data: phase4 } = await supabase
    .from("fases_estado")
    .select("estado_visual, datos_consolidados, updated_at")
    .eq("proyecto_id", projectId)
    .eq("numero_fase", 4)
    .maybeSingle();

  if (hasCompletedPhaseData(phase4?.datos_consolidados)) return;

  const alreadyProcessing =
    phase4?.estado_visual === "procesando" &&
    !isProcessingStale(phase4?.updated_at);

  if (alreadyProcessing) return;

  const runId = createRunId(4);

  // Llamar al agente 4
  try {
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: 4,
          estado_visual: "procesando",
          datos_consolidados: phaseProcessingPayload(4, runId),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proyecto_id,numero_fase" }
      );

    await runAgent(supabase, projectId, 4, 1, null, undefined, undefined, runId);
  } catch (error) {
    console.error("Error en auto-trigger Fase 4:", error);
    const message = error instanceof Error ? error.message : "Error desconocido ejecutando Fase 4";
    await supabase
      .from("fases_estado")
      .update({
        estado_visual: "error",
        datos_consolidados: {
          _error: true,
          message,
          phaseNumber: 4,
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 4);
  }
}

/**
 * Núcleo del orquestador: invoca la API de Gemini y guarda el resultado en Supabase.
 * Usa fetch nativo para soportar contenido multimodal (PDF/CSV via inlineData).
 */
async function runAgent(
  supabase: any,
  projectId: string,
  phaseNumber: number,
  iteration: number,
  comments: unknown | null,
  externalFileUrl?: string,
  extraFileUrls?: string[],
  runId?: string
) {
  // Obtener config del agente
  const { data: agentConfig, error: configError } = await supabase
    .from("configuracion_agentes")
    .select("*")
    .eq("fase_numero", phaseNumber)
    .single();

  if (configError || !agentConfig) {
    throw new Error(`Sin configuración para fase ${phaseNumber}. Verifica que existe una fila en configuracion_agentes con fase_numero=${phaseNumber}. Error: ${configError?.message}`);
  }

  if (!agentConfig.prompt_sistema) {
    throw new Error(`La configuración para fase ${phaseNumber} existe pero prompt_sistema está vacío. Actualiza el prompt en la tabla configuracion_agentes.`);
  }

  // ── Auto-gestión de estado: marcar 'procesando' en la BD ──────────────────
  // La Edge Function gestiona su propio estado de forma autónoma.
  // Esto garantiza que el check de cancelación posterior siempre encuentre
  // el estado correcto, sin importar el estado previo de la fila en la BD.
  // Fase 3 se auto-completa directamente y omite este paso.
  if (phaseNumber !== 3) {
    const activeRunId = runId ?? createRunId(phaseNumber);
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
          datos_consolidados: phaseNumber === 4 || phaseNumber === 5 || phaseNumber === 6 || phaseNumber === 9
            ? phaseProcessingPayload(phaseNumber, activeRunId)
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proyecto_id,numero_fase" }
      );
    runId = activeRunId;
  }

  // Construir payload específico de la fase
  const envelopeData = await getPayloadForPhase(
    supabase,
    projectId,
    phaseNumber,
    iteration,
    comments,
    externalFileUrl,
    extraFileUrls
  );

  const { __fileUrls, ...inputEnvelope } = envelopeData as any;

  // Ensamblar prompt completo
  const phase3OutputInstruction = phaseNumber === 3 ? `

REQUISITO ESTRICTO PARA FASE 3:
El objeto diagnosis.resultados_por_item DEBE incluir un elemento por CADA item valido de idoneidad encontrado en el JSON de entrada y/o CSV adjunto.
No resumas esta lista. No incluyas solo ejemplos. Deben estar los codigos C01-C10, E01-E06 y P01-P05 presentes en los datos recibidos, con promedio numerico, minimo, maximo, desviacion_estandar, dimension y zona.
La escala de zonas es estrictamente: 1.0-3.0 agil, 3.1-6.9 transicion, 7.0-10.0 predictivo. Si existen los 21 items esperados, resultados_por_item debe tener exactamente 21 objetos.` : "";

  const phase4OutputInstruction = phaseNumber === 4 ? `

REQUISITO ESTRICTO PARA FASE 4:
El JSON DE ENTRADA ya viene consolidado con metadata, payload.phase1_diagnosis, payload.phase2_diagnosis, payload.phase3_diagnosis y comments. No uses documentos crudos ni inventes fuentes.
Devuelve exclusivamente el objeto JSON del contrato de salida del Asistente 4. metadata.agent_id debe ser "asistente-4"; diagnosis.pmo_type debe ser "Agil", "Hibrido" o "Predictivo"; confidence_label debe ser "Alto", "Medio" o "Bajo".
diagnosis.justification debe tener minimo 80 palabras con evidencia explicita por fuente disponible y razonamiento de ponderacion. Si pmo_type es "Hibrido", type_breakdown.hybrid_rationale debe tener minimo 50 palabras; si no, debe ser "".
type_breakdown.agile_weight + type_breakdown.predictive_weight debe sumar exactamente 100. supporting_evidence debe tener maximo 8 strings y referenciar la fuente. No evalues madurez y no incluyas recomendaciones.` : "";

  const phase5OutputInstruction = phaseNumber === 5 ? `

REQUISITO ESTRICTO PARA FASE 5:
Debes actuar como el Asistente 5 de Evaluacion de Madurez en Gestion de Proyectos. Usa exclusivamente el JSON DE ENTRADA y los CSV adjuntos, si existen, para calcular todos los scores desde respuestas crudas en escala 1 a 5. No inventes respuestas ni promedios.
El campo payload.approved_pmo_type solo puede ser "Hibrido", "Predictivo" o "Agil". Si es "Predictivo", analiza solo maturity_surveys.predictive y marca agile_maturity.aplica=false. Si es "Agil", analiza solo maturity_surveys.agile y marca predictive_maturity.aplica=false. Si es "Hibrido", analiza ambos por separado y activa analisis_cruzado.aplica=true.
Usa esta escala unica para todos los niveles: 1.00-1.49 Informal nivel 1, 1.50-2.49 Basico nivel 2, 2.50-3.49 Estandar nivel 3, 3.50-4.49 Avanzado nivel 4, 4.50-5.00 Excelencia nivel 5. No uses Inicial, Repetible, Definido, Gestionado ni Optimizado como etiquetas de salida.
Para Hibrido, overall_maturity_score es el unico campo donde puedes combinar enfoques: score_predictivo * predictive_weight/100 + score_agil * agile_weight/100 usando payload.approved_phase4_weights. Si los pesos faltan o no suman 100, registra advertencia y usa promedio simple. Mantén score_global predictivo y agil separados.
Mapea y calcula predictive_maturity por dominio y por fase con las preguntas del prompt del Asistente 5; calcula agile_maturity por factor con C1-C6, E7-E11, P12-P19, I20-I26, V27-V33 y A34-A43. Registra en advertencias_de_entrada toda pregunta ausente, encuesta requerida vacia, valor fuera de 1-5, patron uniforme o aquiescencia.
Mapeo predictivo por dominio: gobernanza=G1-01,G1-02,G1-03,G2-04,G2-05,G2-06,G2-07,G2-08,G3-09,G3-10,G3-11,G3-12,G4-13,G4-14,G4-15,G5-16,G5-17,G5-18; alcance=A2-19,A2-20,A2-21,A2-22,A2-23,A2-24,A4-25,A4-26,A4-27; cronograma=C2-28,C2-29,C2-30,C2-31,C4-32,C4-33,C4-34,C4-35; financiero=F2-36,F2-37,F2-38,F4-39,F4-40,F4-41,F4-42,F5-43; interesados=I1-44,I2-45,I2-46,I3-47,I3-48,I4-49,I4-50,I4-51; recursos=R2-52,R3-53,R3-54,R3-55,R4-56,R4-57,R5-58; riesgos=K2-59,K2-60,K2-61,K3-62,K3-63,K4-64,K4-65.
Mapeo predictivo por fase: inicio=G1-01,G1-02,G1-03; planeacion=G2-04,G2-05,G2-06,G2-07,G2-08,A2-19,A2-20,A2-21,A2-22,A2-23,A2-24,C2-28,C2-29,C2-30,C2-31,F2-36,F2-37,F2-38,I2-45,I2-46,R2-52,K2-59,K2-60,K2-61; ejecucion=G3-09,G3-10,G3-11,G3-12,G4-13,G4-14,G4-15,A4-25,A4-26,A4-27,I3-47,I3-48,R3-53,R3-54,R3-55,K3-62,K3-63; monitoreo_y_control=G5-16,G5-17,G5-18,C4-32,C4-33,C4-34,C4-35,F4-39,F4-40,F4-41,F4-42,I1-44,I4-49,I4-50,I4-51,R4-56,R4-57,K4-64,K4-65; cierre=G3-10,F5-43,R5-58.
Mapeo agil por factor: cultura=C1,C2,C3,C4,C5,C6; equipo=E7,E8,E9,E10,E11; producto=P12,P13,P14,P15,P16,P17,P18,P19; interesados=I20,I21,I22,I23,I24,I25,I26; valor=V27,V28,V29,V30,V31,V32,V33; adaptabilidad=A34,A35,A36,A37,A38,A39,A40,A41,A42,A43.
Incluye en brechas todos los dominios, fases o factores en Informal o Basico. No reportes fortalezas salvo Avanzado o Excelencia. Menciona brechas relativas solo en patrones_estructurales, no en brechas.
Los campos narrativos deben ser claros, concretos y seguros para JSON: usa frases compactas, sin saltos de linea dentro de strings y sin markdown. Limita patrones_estructurales, impactos, sintesis, relaciones, tensiones y recomendaciones a 1 o 2 frases cada uno. Prioriza JSON completo y valido por encima de extension narrativa.
Devuelve exclusivamente el JSON del contrato del Asistente 5 con metadata.agent_id="asistente-5", diagnosis, error=null en exito, top_gaps maximo 5 y recommendations maximo 6. La respuesta completa no debe exceder 12000 caracteres. Si no hay datos suficientes, devuelve la plantilla de error con codigo adecuado.` : "";

  const phase6OutputInstruction = phaseNumber === 6 ? `

REQUISITO ESTRICTO PARA FASE 6:
El JSON DE ENTRADA contiene exclusivamente payload.approved_phase4_diagnosis, payload.approved_phase5_diagnosis y comments. No uses documentos crudos ni outputs de fases 1, 2 o 3.
No redactes la guia metodologica, no reclasifiques el tipo de PMO y no recalcules scores de madurez.
Devuelve exclusivamente el contrato JSON corto del Agente 6: metadata.agent_id="agente-6", metadata.phase=6, diagnosis.summary, diagnosis.guide_approach, diagnosis.secciones, diagnosis.critical_weaknesses, diagnosis.parametros_construccion, diagnosis.advertencias_de_entrada, diagnosis.insumos_base_utilizados y error=null en exito.
Incluye siempre las 10 secciones base, maximo 8 critical_weaknesses y solo secciones adicionales justificadas por Fase 4 o Fase 5. Si faltan Fase 4 o Fase 5, devuelve la plantilla de error del prompt con codigo MISSING_PHASE4_DIAGNOSIS, MISSING_PHASE5_DIAGNOSIS, INVALID_FORMAT, INVALID_PMO_TYPE o INSUFFICIENT_DATA.` : "";

  const phase7OutputInstruction = phaseNumber === 7 ? `

REQUISITO ESTRICTO PARA FASE 7:
Debes generar una guia metodologica extensa, detallada y profesional, con extension equivalente a MINIMO 20 paginas A4 en el visor de la plataforma. No entregues un resumen ni una estructura ligera.
Si el JSON DE ENTRADA incluye mandatory_consultant_instructions, esos comentarios del consultor tienen prioridad maxima. Debes aplicarlos como requerimientos obligatorios de reprocesamiento, hacer visible el cambio en el documento final y no tratarlos como observaciones opcionales.
La guia debe incluir al menos 10 capitulos sustantivos. Cada capitulo debe tener una introduccion de minimo 120 palabras y minimo 3 secciones desarrolladas.
Cada seccion debe contener minimo 2 parrafos narrativos de mas de 70 palabras cada uno, items accionables con mas de 70 palabras por item y, cuando aplique, una tabla con encabezados claros y minimo 4 filas de datos concretos.
Cada capitulo debe desarrollar el tema con profundidad consultiva y cada seccion debe contener explicaciones amplias, accionables y contextualizadas para la organizacion evaluada.
Debes preservar y desarrollar toda la informacion relevante recibida en el JSON de entrada: hallazgos, brechas, riesgos, metricas, scores, dimensiones, fases, actividades, entradas, salidas, roles, responsabilidades, criterios, dependencias, artefactos, KPIs, formulas, umbrales, responsables, recomendaciones y acciones. No omitas datos utiles para el cliente ni los compactes en una frase general.
Puedes excluir campos tecnicos, metadatos de ejecucion, identificadores internos, timestamps, nombres de llaves JSON, trazas de versionado y cualquier dato que solo sirva para procesamiento del sistema. Todo contenido de negocio, diagnostico, gestion, metodologia o implementacion debe quedar visible y organizado en el informe.
Cada parrafo, item y subitem debe superar las 70 palabras. En cada uno explica que significa, por que es importante, como se aplica en la PMO, que decisiones habilita y que riesgos reduce.
Si produces listas dentro de items, subitems, riesgos, artefactos, criterios, roles, procesos, metricas o recomendaciones, cada elemento de esa lista tambien debe superar las 70 palabras y debe leerse como un parrafo profesional completo.
Evita frases genericas, definiciones cortas, placeholders y bullets de una sola linea. El resultado total debe tener una extension grande y un nivel de detalle propio de una guia metodologica corporativa lista para revision ejecutiva.
Antes de entregar el JSON, verifica internamente que la respuesta cumple: minimo 20 paginas equivalentes, minimo 10 capitulos, minimo 3 secciones por capitulo, minimo 2 parrafos por seccion y tablas con datos cuando correspondan.` : "";

  const enforceJsonInstruction = `

IMPORTANTE: DEBES DEVOLVER ÚNICAMENTE UN OBJETO JSON VÁLIDO.
Tu respuesta DEBE empezar con '{' y terminar con '}'. Sin markdown, sin texto extra.`;
  const fullPrompt = `${agentConfig.prompt_sistema}\n\nJSON DE ENTRADA:\n${JSON.stringify(
    inputEnvelope,
    null,
    2
  )}${phase3OutputInstruction}${phase4OutputInstruction}${phase5OutputInstruction}${phase6OutputInstruction}${phase7OutputInstruction}${enforceJsonInstruction}`;

  // Preparar contenido multimodal
  let parts: any[] = [{ text: fullPrompt }];
  const hasFiles = __fileUrls && __fileUrls.length > 0;
  const csvTextsForPhase3: string[] = [];
  
  if (hasFiles) {
    // Descargar y convertir archivos a base64
    const filePromises = __fileUrls.map(async (fileData: {url: string, type: string, label?: string}) => {
      try {
        const res = await fetch(fileData.url);
        if (!res.ok) {
          console.error(`[pmo-agent] fetch archivo fallido: ${res.status} ${res.statusText} — URL: ${fileData.url.substring(0, 120)}`);
          return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        
        // Chunked btoa to avoid "Maximum call stack size exceeded" on large PDFs
        const bytes = new Uint8Array(arrayBuffer);
        
        if (fileData.type === 'text/csv') {
          const decoder = new TextDecoder('utf-8');
          const textContent = decoder.decode(bytes);
          if (phaseNumber === 3) csvTextsForPhase3.push(textContent);
          return [
            {
              text: `\n\n--- METADATOS DE ARCHIVO ADJUNTO ---\n${fileData.label ?? "Archivo CSV adjunto"}\n`
            },
            {
            text: `\n\n--- INICIO CONTENIDO DE ARCHIVO CSV ADJUNTO ---\n${textContent}\n--- FIN CONTENIDO DE ARCHIVO CSV ADJUNTO ---\nPor favor, ten muy en cuenta los datos de este archivo CSV para tu análisis.\n`
            }
          ];
        }

        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        
        // Formato nativo de la API de Gemini (solo PDFs o imágenes lo soportan de forma nativa en parts)
        return [
          {
            text: `\n\n--- METADATOS DE ARCHIVO ADJUNTO ---\n${fileData.label ?? "Archivo PDF adjunto"}\n--- EL SIGUIENTE PDF CORRESPONDE A LOS METADATOS ANTERIORES ---\n`
          },
          {
            inlineData: {
              mimeType: fileData.type,
              data: base64,
              sourceUrl: fileData.url,
              filename: fileData.label ?? `archivo-adjunto.${fileData.type === "text/csv" ? "csv" : "pdf"}`
            }
          }
        ];
      } catch (e) {
        console.error("Error fetching file", e);
        return null;
      }
    });

    const fileParts = (await Promise.all(filePromises)).flat().filter(Boolean);
    parts.push(...fileParts);
  }

  // Respetar el modelo configurado en la base de datos (configuracion_agentes)
  const modelSettings = await getAiModelSettings(supabase);
  const modelsToTry = getModelCandidates(modelSettings, agentConfig?.modelo);
  const apiKeys = {
    openai: Deno.env.get("OPENAI_API_KEY") ?? "",
    anthropic: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
    gemini: Deno.env.get("GOOGLE_API_KEY") ?? Deno.env.get("GEMINI_API_KEY") ?? "",
  };
  
  // Invocar el proveedor configurado con fallback cruzado OpenAI <-> Anthropic.
  const hasAttachedFiles = __fileUrls && __fileUrls.length > 0;
  const providerTimeoutMs =
    phaseNumber === 9 ? 75000 :
    phaseNumber === 7 ? 110000 :
    phaseNumber === 6 ? 90000 :
    (phaseNumber === 5 && hasAttachedFiles) ? 110000 :
    90000;
  const startTime = Date.now();
  const aiResult = await callAiWithFallback(apiKeys, modelsToTry, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: agentConfig?.temperatura ?? 1,
      maxOutputTokens: phaseNumber === 7 ? 65536 : phaseNumber === 5 ? 65536 : phaseNumber === 9 ? 16384 : 16384,
      providerTimeoutMs,
      responseMimeType: "application/json",
    }
  });

  const geminiData = aiResult.data;
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Extraer y validar el JSON de la respuesta
  let diagnosis: unknown;
  const candidate = geminiData.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const rawContent = candidate?.content?.parts?.[0]?.text || "";

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      `El modelo ${aiResult.provider}:${aiResult.model} corto la respuesta por limite de tokens antes de completar el JSON. Aumenta maxOutputTokens o divide la fase en partes mas pequenas.`
    );
  }

  let cleaned = rawContent.trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  try {
    diagnosis = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `La IA devolvio un JSON invalido. Tiempo: ${processingTime}s. Respuesta original: ${rawContent.substring(0, 150)}...`
    );
  }

  // Verificar si la fase fue cancelada durante el procesamiento ──────────
  // El usuario puede cancelar desde el frontend actualizando estado_visual a 'disponible'.
  // Si ya no está en 'procesando', saltamos el guardado para no sobreescribir la cancelación.
  const { data: currentState } = await supabase
    .from("fases_estado")
    .select("estado_visual, datos_consolidados")
    .eq("proyecto_id", projectId)
    .eq("numero_fase", phaseNumber)
    .single();

  const currentData = currentState?.datos_consolidados as any;
  const runMismatch =
    (phaseNumber === 4 || phaseNumber === 5 || phaseNumber === 6 || phaseNumber === 9) &&
    runId &&
    isProcessingMarker(currentData) &&
    currentData._run_id !== runId;

  if (currentState?.estado_visual !== "procesando" || runMismatch) {
    console.log(`Fase ${phaseNumber} cancelada por el usuario durante el procesamiento. Resultado descartado.`);
    return { diagnosis: null, processingTime, cancelled: true };
  }

  const commentText = extractCommentText(comments);
  let diagnosisToSave = phaseNumber === 3
    ? withCompletedPhase3Items(diagnosis, inputEnvelope, csvTextsForPhase3)
    : diagnosis;

  if (phaseNumber === 7) {
    const previousFromRequest = extractCurrentGuideForRevision(comments);
    const { data: previousPhase7 } = await supabase
      .from("fases_estado")
      .select("datos_consolidados")
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 7)
      .maybeSingle();

    const previous = previousFromRequest ?? (previousPhase7?.datos_consolidados as any);
    const previousVersions = Array.isArray(previous?._versions) ? previous._versions : [];
    const versionNumber = previousVersions.length + 1;
    const generatedAt = new Date().toISOString();

    const versionEntry = {
      number: versionNumber,
      generatedAt,
      status: versionNumber > 1 ? "revisado" : "generado",
      comment: commentText,
      data: diagnosis,
    };

    diagnosisToSave = {
      _current: diagnosis,
      _versions: [...previousVersions, versionEntry],
      _latest_version: versionNumber,
      _generated_at: generatedAt,
      _last_comment: commentText,
    };
  }

  if (phaseNumber === 4) {
    diagnosisToSave = normalizePhase4Envelope(diagnosisToSave, inputEnvelope, Number(processingTime));
  } else if (phaseNumber === 5) {
    diagnosisToSave = attachModelMetadata(
      normalizePhase5Envelope(diagnosisToSave, inputEnvelope, Number(processingTime)),
      aiResult,
      modelSettings
    );
  } else if (phaseNumber === 6) {
    diagnosisToSave = attachModelMetadata(
      normalizePhase6Envelope(diagnosisToSave, inputEnvelope, Number(processingTime)),
      aiResult,
      modelSettings
    );
  } else {
    diagnosisToSave = attachModelMetadata(diagnosisToSave, aiResult, modelSettings);
  }

  const agentReturnedError = Boolean(
    diagnosisToSave &&
    typeof diagnosisToSave === "object" &&
    !Array.isArray(diagnosisToSave) &&
    ((diagnosisToSave as any).error || (diagnosisToSave as any).metadata?.status === "error")
  );

  // Guardar en fases_estado
  const { error: saveError } = await supabase
    .from("fases_estado")
    .upsert(
      {
        proyecto_id: projectId,
        numero_fase: phaseNumber,
        estado_visual: agentReturnedError
          ? "error"
          : (phaseNumber === 3 || phaseNumber === 9) ? "completado" : "disponible", // Phase 3 & 9 auto-complete
        datos_consolidados: diagnosisToSave,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "proyecto_id,numero_fase" }
    );

  if (saveError) throw new Error(`Error guardando diagnóstico: ${saveError.message}`);

  return { diagnosis: diagnosisToSave, processingTime, cancelled: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVIDOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectId, phaseNumber, iteration = 1, comments = null, externalFileUrl,
      phase7Stage = null, runId: requestedRunId = null,
      pmoType, predictivaFileUrl, agilFileUrl, predictivaFileUrls, agilFileUrls, comentario_consultor } =
      await req.json();

    // Para fase 5 empaquetamos pmoType y comentario en comments
    const resolvedComments = phaseNumber === 5
      ? { pmoType, comentario_consultor }
      : (comments ?? comentario_consultor ?? null);

    // URLs de archivos extra (fase 5)
    const extraFileUrls: string[] = [
      predictivaFileUrl,
      agilFileUrl,
      ...(Array.isArray(predictivaFileUrls) ? predictivaFileUrls : []),
      ...(Array.isArray(agilFileUrls) ? agilFileUrls : []),
    ].filter(Boolean) as string[];

    if (!projectId || !phaseNumber) {
      throw new Error("Faltan parámetros requeridos: projectId y phaseNumber");
    }

    // Inicializar cliente Supabase (con Service Role para saltar RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (phaseNumber === 7) {
      if (phase7Stage === "part2") {
        if (!requestedRunId) throw new Error("Falta runId para iniciar la Fase 7.2.");
        // Run Part 2 synchronously within this dedicated invocation.
        // This invocation has its own 150s budget so we can await safely.
        await runPhase7Part2(supabase, projectId, requestedRunId, iteration, resolvedComments);
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            stage: "part2_completed",
            inProgress: false,
            processingTime: "0.00",
            data: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (phase7Stage === "part1") {
        if (!requestedRunId) throw new Error("Falta runId para iniciar la Fase 7.1.");
        // Run Part 1 synchronously within this dedicated invocation.
        // When Part 1 completes, it will invoke a new edge function for Part 2.
        await runPhase7Part1(supabase, projectId, requestedRunId, iteration, resolvedComments);
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            stage: "part1_completed",
            inProgress: true,
            processingTime: "0.00",
            data: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingPhase7 } = await supabase
        .from("fases_estado")
        .select("estado_visual, datos_consolidados, updated_at")
        .eq("proyecto_id", projectId)
        .eq("numero_fase", 7)
        .maybeSingle();

      const existingData = existingPhase7?.datos_consolidados as any;
      const hasExistingGuide =
        (existingPhase7?.estado_visual === "disponible" || existingPhase7?.estado_visual === "completado") &&
        hasCompletedPhaseData(existingData);

      if (!resolvedComments && hasExistingGuide) {
        console.log("[pmo-agent] Fase 7 ya tiene guia guardada; se omite reproceso sin comentarios.");
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingData,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const alreadyProcessing =
        existingPhase7?.estado_visual === "procesando" &&
        existingData?._processing === true &&
        !isProcessingStale(existingPhase7?.updated_at);

      if (alreadyProcessing) {
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingData,
            inProgress: true,
            stage: existingData?.stage ?? "processing",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let commentsForAgent: unknown = resolvedComments;
      if (resolvedComments && hasMeaningfulData(existingData) && !existingData?._error) {
        commentsForAgent = {
          comments: extractCommentText(resolvedComments),
          current_guide_for_revision: existingData,
          latest_version: existingData?._latest_version ?? null,
        };
      }

      const phase7RunId = createRunId(7);
      const processingPayload = phase7ProcessingPayload(
        phase7RunId,
        "part_1_queued",
        existingData,
        commentsForAgent,
        iteration,
        {},
        "La fase 7 inicio en modo dividido: primero se ejecuta 7.1 y luego 7.2."
      );

      await supabase
        .from("fases_estado")
        .upsert(
          {
            proyecto_id: projectId,
            numero_fase: 7,
            estado_visual: "procesando",
            datos_consolidados: processingPayload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "proyecto_id,numero_fase" }
        );

      // Invoke Part 1 as a SEPARATE edge function execution.
      // scheduleBackground was unreliable — the runtime could shut down before
      // Part 1 completed. A fresh invocation gets its own 150s budget.
      scheduleBackground(
        supabase.functions.invoke("pmo-agent", {
          body: { projectId, phaseNumber: 7, phase7Stage: "part1", runId: phase7RunId, iteration, comments: commentsForAgent },
        }).then((invokeResult: any) => {
          if (invokeResult.error) {
            console.error("[pmo-agent] Error disparando Fase 7.1:", invokeResult.error);
          }
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          phaseNumber,
          processingTime: "0.00",
          data: processingPayload,
          inProgress: true,
          stage: "part1",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener el modelo configurado para esta fase
    const { data: agentConfig } = await supabase
      .from("configuracion_agentes")
      .select("modelo, temperatura")
      .eq("fase_numero", phaseNumber)
      .single();

    // El modelo se inicializa dentro de runAgent ahora para decidir si forzar multimodal.

    if (phaseNumber === 7 && !resolvedComments) {
      const { data: existingPhase7 } = await supabase
        .from("fases_estado")
        .select("estado_visual, datos_consolidados")
        .eq("proyecto_id", projectId)
        .eq("numero_fase", 7)
        .maybeSingle();

      const existingData = existingPhase7?.datos_consolidados as any;
      const hasExistingGuide =
        (existingPhase7?.estado_visual === "disponible" || existingPhase7?.estado_visual === "completado") &&
        hasMeaningfulData(existingData) &&
        !existingData?._error;

      if (hasExistingGuide) {
        console.log("[pmo-agent] Fase 7 ya tiene guia guardada; se omite reproceso sin comentarios.");
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingData,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let commentsForAgent: unknown = resolvedComments;

    if (phaseNumber === 7 && resolvedComments) {
      const { data: existingPhase7 } = await supabase
        .from("fases_estado")
        .select("datos_consolidados")
        .eq("proyecto_id", projectId)
        .eq("numero_fase", 7)
        .maybeSingle();

      const existingGuide = existingPhase7?.datos_consolidados as any;
      if (hasMeaningfulData(existingGuide) && !existingGuide?._error) {
        commentsForAgent = {
          comments: extractCommentText(resolvedComments),
          current_guide_for_revision: existingGuide,
          latest_version: existingGuide?._latest_version ?? null,
        };
      }
    }

    let runId: string | undefined;

    if (phaseNumber === 4 && iteration <= 1 && !resolvedComments) {
      const { data: existingPhase4 } = await supabase
        .from("fases_estado")
        .select("estado_visual, datos_consolidados, updated_at")
        .eq("proyecto_id", projectId)
        .eq("numero_fase", 4)
        .maybeSingle();

      if (hasCompletedPhaseData(existingPhase4?.datos_consolidados)) {
        console.log("[pmo-agent] Fase 4 ya tiene diagnostico guardado; se omite disparo duplicado.");
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingPhase4?.datos_consolidados,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const freshProcessing =
        existingPhase4?.estado_visual === "procesando" &&
        !isProcessingStale(existingPhase4?.updated_at);

      if (freshProcessing) {
        console.log("[pmo-agent] Fase 4 ya esta procesando; se evita disparo duplicado.");
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingPhase4?.datos_consolidados ?? null,
            inProgress: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (phaseNumber === 6 && iteration <= 1 && !resolvedComments) {
      const { data: existingPhase6 } = await supabase
        .from("fases_estado")
        .select("estado_visual, datos_consolidados, updated_at")
        .eq("proyecto_id", projectId)
        .eq("numero_fase", 6)
        .maybeSingle();

      const existingData = existingPhase6?.datos_consolidados as any;
      const hasExistingDiagnosis =
        (existingPhase6?.estado_visual === "disponible" || existingPhase6?.estado_visual === "completado") &&
        hasCompletedPhaseData(existingData);

      if (hasExistingDiagnosis) {
        console.log("[pmo-agent] Fase 6 ya tiene diagnostico guardado; se omite disparo duplicado.");
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingData,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const freshProcessing =
        existingPhase6?.estado_visual === "procesando" &&
        isProcessingMarker(existingData) &&
        !isProcessingStale(existingPhase6?.updated_at);

      if (freshProcessing) {
        console.log("[pmo-agent] Fase 6 ya esta procesando; se evita disparo duplicado.");
        return new Response(
          JSON.stringify({
            success: true,
            phaseNumber,
            processingTime: "0.00",
            data: existingData,
            inProgress: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (phaseNumber === 4 || phaseNumber === 5 || phaseNumber === 6 || phaseNumber === 9) {
      runId = createRunId(phaseNumber);
    }

    // Marcar fase como "procesando" en la UI
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
          datos_consolidados: (phaseNumber === 4 || phaseNumber === 5 || phaseNumber === 6 || phaseNumber === 9) && runId
            ? phaseProcessingPayload(phaseNumber, runId)
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proyecto_id,numero_fase" }
      );

    // Ejecutar el agente
    let diagnosis, processingTime;
    try {
      const result = await runAgent(
        supabase,
        projectId,
        phaseNumber,
        iteration,
        commentsForAgent,
        externalFileUrl,
        extraFileUrls,
        runId
      );
      diagnosis = result.diagnosis;
      processingTime = result.processingTime;
    } catch (agentError) {
      const errorMessage = agentError instanceof Error ? agentError.message : "Error desconocido ejecutando el agente";

      // Persistir el error para que el frontend no quede con un mensaje genérico.
      await supabase
        .from("fases_estado")
        .update({
          estado_visual: "error",
          datos_consolidados: {
            _error: true,
            message: errorMessage,
            phaseNumber,
            timestamp: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("proyecto_id", projectId)
        .eq("numero_fase", phaseNumber);
        
      throw agentError; // relanzar para que lo atrape el catch global
    }

    // Si termina la fase 3, verificar si disparar la 4 automáticamente
    if (phaseNumber === 3) {
      const phase4Job = checkAndTriggerPhase4(supabase, projectId);
      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(phase4Job);
      } else {
        await phase4Job;
      }
    }

    // Si termina la fase 1 (Agente 3 — Documentación), disparar el Agente 9 en paralelo
    if (phaseNumber === 1) {
      const agent9Job = (async () => {
        try {
          const agent9RunId = createRunId(9);
          await supabase.from("fases_estado").upsert(
            {
              proyecto_id: projectId,
              numero_fase: 9,
              estado_visual: "procesando",
              datos_consolidados: phaseProcessingPayload(9, agent9RunId),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "proyecto_id,numero_fase" }
          );
          await runAgent(supabase, projectId, 9, 1, null, undefined, undefined, agent9RunId);
        } catch (e) {
          console.error("[pmo-agent] Error auto-trigger Agente 9:", e);
          await supabase.from("fases_estado")
            .update({
              estado_visual: "error",
              datos_consolidados: {
                _error: true,
                message: e instanceof Error ? e.message : "Error desconocido ejecutando Agente 9",
                phaseNumber: 9,
                timestamp: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq("proyecto_id", projectId)
            .eq("numero_fase", 9);
        }
      })();

      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(agent9Job);
      } else {
        agent9Job.catch(e => console.error("Agente 9 background error:", e));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        phaseNumber,
        processingTime,
        data: diagnosis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("PMO Agent Error:", msg);

    return new Response(
      JSON.stringify({
        success: false,
        error: msg,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
