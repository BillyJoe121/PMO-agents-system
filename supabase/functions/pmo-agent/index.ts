import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./_shared/cors.ts";
import { attachModelMetadata, callAiWithFallback, getAiModelSettings, getModelCandidates } from "./_shared/aiModels.ts";
import { createRunId, hasCompletedPhaseData, hasMeaningfulData, isProcessingMarker, isProcessingStale, phaseProcessingPayload } from "./_shared/processing.ts";
import { getPayloadForPhase } from "./_shared/phasePayloads.ts";
import { withCompletedPhase3Items } from "./_shared/phase3Completion.ts";

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
  // Fases 3 y 9 se auto-completan directamente y omiten este paso.
  if (phaseNumber !== 3 && phaseNumber !== 9) {
    const activeRunId = runId ?? createRunId(phaseNumber);
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
          datos_consolidados: phaseNumber === 4
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
El objeto diagnosis.resultados_por_item DEBE incluir un elemento por CADA pregunta de idoneidad encontrada en el JSON de entrada y/o CSV adjunto.
No resumas esta lista. No incluyas solo ejemplos. Deben estar todos los codigos Cxx, Exx y Pxx con promedio numerico, minimo, maximo, desviacion_estandar, dimension y zona.
Si existen 23 preguntas en los datos de entrada, resultados_por_item debe tener exactamente 23 objetos.` : "";

  const phase7OutputInstruction = phaseNumber === 7 ? `

REQUISITO ESTRICTO PARA FASE 7:
Debes generar una guia metodologica extensa, detallada y profesional. No entregues un resumen ni una estructura ligera.
Cada capitulo debe desarrollar el tema con profundidad consultiva y cada seccion debe contener explicaciones amplias, accionables y contextualizadas para la organizacion evaluada.
Debes preservar y desarrollar toda la informacion relevante recibida en el JSON de entrada: hallazgos, brechas, riesgos, metricas, scores, dimensiones, fases, actividades, entradas, salidas, roles, responsabilidades, criterios, dependencias, artefactos, KPIs, formulas, umbrales, responsables, recomendaciones y acciones. No omitas datos utiles para el cliente ni los compactes en una frase general.
Puedes excluir campos tecnicos, metadatos de ejecucion, identificadores internos, timestamps, nombres de llaves JSON, trazas de versionado y cualquier dato que solo sirva para procesamiento del sistema. Todo contenido de negocio, diagnostico, gestion, metodologia o implementacion debe quedar visible y organizado en el informe.
Cada parrafo, item y subitem debe superar las 40 palabras. En cada uno explica que significa, por que es importante, como se aplica en la PMO, que decisiones habilita y que riesgos reduce.
Si produces listas dentro de items, subitems, riesgos, artefactos, criterios, roles, procesos, metricas o recomendaciones, cada elemento de esa lista tambien debe superar las 40 palabras y debe leerse como un parrafo profesional completo.
Evita frases genericas, definiciones cortas y bullets de una sola linea. El resultado total debe tener una extension grande y un nivel de detalle propio de una guia metodologica corporativa lista para revision ejecutiva.` : "";

  const enforceJsonInstruction = `

IMPORTANTE: DEBES DEVOLVER ÚNICAMENTE UN OBJETO JSON VÁLIDO.
Tu respuesta DEBE empezar con '{' y terminar con '}'. Sin markdown, sin texto extra.`;
  const fullPrompt = `${agentConfig.prompt_sistema}\n\nJSON DE ENTRADA:\n${JSON.stringify(
    inputEnvelope,
    null,
    2
  )}${phase3OutputInstruction}${phase7OutputInstruction}${enforceJsonInstruction}`;

  // Preparar contenido multimodal
  let parts: any[] = [{ text: fullPrompt }];
  const hasFiles = __fileUrls && __fileUrls.length > 0;
  const csvTextsForPhase3: string[] = [];
  
  if (hasFiles) {
    // Descargar y convertir archivos a base64
    const filePromises = __fileUrls.map(async (fileData: {url: string, type: string}) => {
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
          return {
            text: `\n\n--- INICIO CONTENIDO DE ARCHIVO CSV ADJUNTO ---\n${textContent}\n--- FIN CONTENIDO DE ARCHIVO CSV ADJUNTO ---\nPor favor, ten muy en cuenta los datos de este archivo CSV para tu análisis.\n`
          };
        }

        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        
        // Formato nativo de la API de Gemini (solo PDFs o imágenes lo soportan de forma nativa en parts)
        return {
          inlineData: {
            mimeType: fileData.type,
            data: base64
          }
        };
      } catch (e) {
        console.error("Error fetching file", e);
        return null;
      }
    });

    const fileParts = (await Promise.all(filePromises)).filter(Boolean);
    parts.push(...fileParts);
  }

  // Respetar el modelo configurado en la base de datos (configuracion_agentes)
  const modelSettings = await getAiModelSettings(supabase);
  const modelsToTry = getModelCandidates(modelSettings);
  const apiKeys = {
    gemini: Deno.env.get("GOOGLE_API_KEY") ?? "",
    kimi: Deno.env.get("MOONSHOT_API_KEY") ?? Deno.env.get("KIMI_API_KEY") ?? "",
  };
  
  // Invocar Gemini a traves de API REST nativa (para soportar PDF inlineData sin problemas de LangChain)
  const startTime = Date.now();
  const geminiResult = await callAiWithFallback(apiKeys, modelsToTry, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: agentConfig?.temperatura ?? 1,
      maxOutputTokens: phaseNumber === 7 ? 32768 : undefined,
      responseMimeType: "application/json",
    }
  });

  const geminiData = geminiResult.data;
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Extraer y validar el JSON de la respuesta
  let diagnosis: unknown;
  const candidate = geminiData.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const rawContent = candidate?.content?.parts?.[0]?.text || "";

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      `El modelo ${geminiResult.provider}:${geminiResult.model} corto la respuesta por limite de tokens antes de completar el JSON. Aumenta maxOutputTokens o divide la fase en partes mas pequenas.`
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
    phaseNumber === 4 &&
    runId &&
    isProcessingMarker(currentData) &&
    currentData._run_id !== runId;

  if (currentState?.estado_visual !== "procesando" || runMismatch) {
    console.log(`Fase ${phaseNumber} cancelada por el usuario durante el procesamiento. Resultado descartado.`);
    return { diagnosis: null, processingTime, cancelled: true };
  }

  let diagnosisToSave = phaseNumber === 3
    ? withCompletedPhase3Items(diagnosis, inputEnvelope, csvTextsForPhase3)
    : diagnosis;

  if (phaseNumber === 7) {
    const { data: previousPhase7 } = await supabase
      .from("fases_estado")
      .select("datos_consolidados")
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 7)
      .maybeSingle();

    const previous = previousPhase7?.datos_consolidados as any;
    const previousVersions = Array.isArray(previous?._versions) ? previous._versions : [];
    const versionNumber = previousVersions.length + 1;
    const generatedAt = new Date().toISOString();

    const versionEntry = {
      number: versionNumber,
      generatedAt,
      status: versionNumber > 1 ? "revisado" : "generado",
      comment: typeof comments === "string" ? comments : null,
      data: diagnosis,
    };

    diagnosisToSave = {
      _current: diagnosis,
      _versions: [...previousVersions, versionEntry],
      _latest_version: versionNumber,
      _generated_at: generatedAt,
      _last_comment: typeof comments === "string" ? comments : null,
    };
  }

  diagnosisToSave = attachModelMetadata(diagnosisToSave, geminiResult, modelSettings);

  // Guardar en fases_estado
  const { error: saveError } = await supabase
    .from("fases_estado")
    .upsert(
      {
        proyecto_id: projectId,
        numero_fase: phaseNumber,
        estado_visual: (phaseNumber === 3 || phaseNumber === 9) ? "completado" : "disponible", // Phase 3 & 9 auto-complete
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

    if (phaseNumber === 4) {
      runId = createRunId(4);
    }

    // Marcar fase como "procesando" en la UI
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
          datos_consolidados: phaseNumber === 4 && runId
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
        resolvedComments,
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
          await supabase.from("fases_estado").upsert(
            { proyecto_id: projectId, numero_fase: 9, estado_visual: "procesando", datos_consolidados: null, updated_at: new Date().toISOString() },
            { onConflict: "proyecto_id,numero_fase" }
          );
          await runAgent(supabase, projectId, 9, 1, null);
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
