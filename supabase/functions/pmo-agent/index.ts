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
          datos_consolidados: phaseNumber === 4 || phaseNumber === 9
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
  )}${phase3OutputInstruction}${phase4OutputInstruction}${phase7OutputInstruction}${enforceJsonInstruction}`;

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
  const modelsToTry = getModelCandidates(modelSettings);
  const apiKeys = {
    openai: Deno.env.get("OPENAI_API_KEY") ?? "",
    anthropic: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
    gemini: Deno.env.get("GOOGLE_API_KEY") ?? Deno.env.get("GEMINI_API_KEY") ?? "",
  };
  
  // Invocar el proveedor configurado con fallback cruzado OpenAI <-> Anthropic.
  const providerTimeoutMs =
    phaseNumber === 9 ? 75000 :
    phaseNumber === 7 ? 110000 :
    90000;
  const startTime = Date.now();
  const aiResult = await callAiWithFallback(apiKeys, modelsToTry, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: agentConfig?.temperatura ?? 1,
      maxOutputTokens: phaseNumber === 7 ? 65536 : phaseNumber === 9 ? 16384 : undefined,
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
    (phaseNumber === 4 || phaseNumber === 9) &&
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
      pmoType, predictivaFileUrl, agilFileUrl, comentario_consultor } =
      await req.json();

    // Para fase 5 empaquetamos pmoType y comentario en comments
    const resolvedComments = phaseNumber === 5
      ? { pmoType, comentario_consultor }
      : (comments ?? comentario_consultor ?? null);

    // URLs de archivos extra (fase 5)
    const extraFileUrls: string[] = [predictivaFileUrl, agilFileUrl].filter(Boolean) as string[];

    if (!projectId || !phaseNumber) {
      throw new Error("Faltan parámetros requeridos: projectId y phaseNumber");
    }

    // Inicializar cliente Supabase (con Service Role para saltar RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    if (phaseNumber === 4 || phaseNumber === 9) {
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
          datos_consolidados: (phaseNumber === 4 || phaseNumber === 9) && runId
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
