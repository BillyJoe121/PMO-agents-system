import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatGoogleGenerativeAI } from "npm:@langchain/google-genai@0.0.21";

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Permite llamadas desde el Frontend React
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye el payload correcto para cada agente según su fase.
 * Cada fase lee de una tabla diferente en Supabase.
 */
async function getPayloadForPhase(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  phaseNumber: number,
  iteration: number,
  comments: unknown | null,
  externalFileUrl?: string,
  extraFileUrls?: string[]
) {
  const ensureFreshUrl = async (url: string) => {
    if (!url) return url;
    try {
      let relPath = url;
      // Si es una URL completa de Supabase, extraemos el path relativo
      if (url.includes('documentos-pmo/')) {
        const pathMatch = url.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
        if (pathMatch) relPath = decodeURIComponent(pathMatch[1]);
      }
      
      // Si la URL es absoluta pero NO es de nuestro bucket de Supabase, la dejamos tal cual
      if (url.startsWith('http') && !url.includes('documentos-pmo/')) return url;

      const { data, error } = await supabase.storage.from('documentos-pmo').createSignedUrl(relPath, 3600);
      if (error || !data?.signedUrl) return url;
      return data.signedUrl;
    } catch (e) {
      console.error("[ensureFreshUrl] Error re-signing URL:", e);
      return url;
    }
  };

  const now = new Date().toISOString();
  const baseMetadata = {
    project_id: projectId,
    phase: phaseNumber,
    agent_id: `agente-${phaseNumber}`,
    timestamp: now,
    iteration,
  };

  // Fase 1 — Registro documental: Lee de la tabla 'documentos'
  if (phaseNumber === 1) {
    const { data: docs, error } = await supabase
      .from("documentos")
      .select("id, storage_path, categoria, nombre_personalizado, metadatos, created_at")
      .eq("proyecto_id", projectId);

    if (error) throw new Error(`Error leyendo documentos: ${error.message}`);

    const fileUrls: {url: string, type: string}[] = [];
    const documents = await Promise.all((docs ?? []).map(async (d: Record<string, unknown>, idx: number) => {
      const rawStoragePath = String(d.storage_path ?? '');
      const ext = rawStoragePath.split('?')[0].split('.').pop()?.toLowerCase() ?? 'pdf';

      if (rawStoragePath) {
        const urlToUse = await ensureFreshUrl(rawStoragePath);
        fileUrls.push({ url: urlToUse, type: ext === 'csv' ? 'text/csv' : 'application/pdf' });
      }

      const categoryMapping: Record<string, string> = {
        'D01': 'Organigrama',
        'D02': 'Artefactos de Gestión de proyectos',
        'D03': 'Plataformas y Sistemas',
        'D04': 'Listado de Proyectos',
        'D05': 'Proyecto mejor documentado',
        'D06': 'Resultados Estratégicos',
        'D07': 'Mapa de Procesos',
        'D08': 'Arquitectura Organizacional/TI',
        'D09': 'Metodología de Proyectos',
        'D10': 'Portafolio de Productos/Servicios',
        'D11': 'Otros'
      };

      const categoryCode = String(d.categoria ?? 'D11');
      const isPredefined = categoryCode.startsWith('D') && categoryCode !== 'D11';

      return {
        document_id: `doc-${String(idx + 1).padStart(3, "0")}`,
        document_name: d.nombre_personalizado ?? d.storage_path,
        document_type: isPredefined ? "predefined" : "custom",
        category: categoryCode,
        category_label: categoryMapping[categoryCode] ?? 'Otro',
        file_format: ext,
        file_size_kb: (d.metadatos as Record<string, number>)?.size_kb ?? 0,
        uploaded_at: d.created_at,
      };
    }));

    return {
      metadata: { ...baseMetadata, agent_id: "agente-3" },
      payload: { documents, total_documents: documents.length },
      comments,
      __fileUrls: fileUrls,
    };
  }

  // Fase 2 — Registro de entrevistas: Lee de la tabla 'entrevistas'
  if (phaseNumber === 2) {
    const { data: entData, error } = await supabase
      .from("entrevistas")
      .select("id, nombre, cargo, area, notas, created_at, storage_path, file_name")
      .eq("proyecto_id", projectId);

    if (error) throw new Error(`Error leyendo entrevistas: ${error.message}`);

    const fileUrls: {url: string, type: string}[] = [];

    const interviews = await Promise.all((entData ?? []).map(async (e: Record<string, any>, idx: number) => {
      let finalUrl = e.storage_path;
      if (e.storage_path) {
        const urlToUse = await ensureFreshUrl(e.storage_path);
        const relPath = e.storage_path.split('?')[0];
        const ext = relPath.split('.').pop()?.toLowerCase() === 'csv' ? 'text/csv' : 'application/pdf';
        fileUrls.push({ url: urlToUse, type: ext });
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
          }
        ]
      };
    }));

    return {
      metadata: { ...baseMetadata, agent_id: "agente-1" },
      payload: {
        interviews,
        total_interviews: interviews.length,
      },
      comments,
      __fileUrls: fileUrls,
    };
  }

  // Fase 3 — Encuestas de idoneidad: Lee de 'encuestas_respuestas'
  if (phaseNumber === 3) {
    const { data: respuestas, error } = await supabase
      .from("encuestas_respuestas")
      .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
      .eq("proyecto_id", projectId);

    if (error) throw new Error(`Error leyendo encuestas: ${error.message}`);

    const formattedRespondents = (respuestas ?? []).map((r, idx) => {
      // r.respuestas is a JSONB array: [{ pregunta_id, codigo, valor }]
      const parsedAnswers = Array.isArray(r.respuestas) ? r.respuestas : [];
      
      return {
        respondent_id: `r-${idx + 1}`,
        name: r.nombre_encuestado,
        role: r.cargo_encuestado,
        area: r.area_encuestado || "Sin área",
        answers: parsedAnswers.map((ans: any) => ({
          question_code: ans.codigo,
          answer_score: ans.valor
        }))
      };
    });

    const fileUrls: {url: string, type: string}[] = [];
    if (externalFileUrl) {
      const freshExternalUrl = await ensureFreshUrl(externalFileUrl);
      const ext = String(externalFileUrl).split("?")[0].split(".").pop()?.toLowerCase() === 'csv' ? 'text/csv' : 'application/pdf';
      fileUrls.push({ url: freshExternalUrl, type: ext });
    }

    return {
      metadata: { ...baseMetadata, agent_id: "agente-2" },
      payload: {
        input_method: externalFileUrl ? "online_and_offline" : "online_survey",
        respondents: formattedRespondents,
        survey_completed_at: now,
      },
      comments,
      __fileUrls: fileUrls
    };
  }

  // Fase 4 — Diagnóstico de idoneidad: Consolida outputs de fases 1, 2 y 3
  // Incluye tanto los diagnósticos de los agentes como los datos crudos originales
  if (phaseNumber === 4) {
    // 1. Leer diagnósticos de agentes previos
    const { data: prevFases, error } = await supabase
      .from("fases_estado")
      .select("numero_fase, datos_consolidados")
      .eq("proyecto_id", projectId)
      .in("numero_fase", [1, 2, 3]);

    if (error) throw new Error(`Error leyendo fases previas: ${error.message}`);

    const faseMap: Record<number, unknown> = {};
    for (const f of prevFases ?? []) {
      const dc = f.datos_consolidados as any;
      // Extraer solo la parte de diagnóstico si viene envuelta
      faseMap[f.numero_fase] = dc?.diagnosis ? dc.diagnosis : dc;
    }

    // 2. Leer datos crudos originales para contexto completo
    // Documentos (Fase 1) - Necesitamos generar signed URLs para que el Agente 4 pueda leerlos
    const { data: docs } = await supabase
      .from("documentos")
      .select("id, storage_path, categoria, nombre_personalizado, metadatos, created_at")
      .eq("proyecto_id", projectId);

    const fileUrls: { url: string; type: string }[] = [];
    if (docs && docs.length > 0) {
      for (const d of docs) {
        if (d.storage_path) {
          const freshUrl = await ensureFreshUrl(d.storage_path);
          const ext = String(d.storage_path).split('?')[0].split('.').pop()?.toLowerCase();
          fileUrls.push({ 
            url: freshUrl, 
            type: ext === 'csv' ? 'text/csv' : 'application/pdf' 
          });
        }
      }
    }

    // Entrevistas (Fase 2)
    const { data: entrevistas } = await supabase
      .from("entrevistas")
      .select("id, nombre, cargo, area, notas, created_at, file_name")
      .eq("proyecto_id", projectId);

    // Encuestas de idoneidad (Fase 3)
    const { data: encuestas } = await supabase
      .from("encuestas_respuestas")
      .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
      .eq("proyecto_id", projectId);

    // 3. Formatear datos crudos como contexto adicional
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
        phase1_diagnosis: faseMap[3] ?? null, // Idoneidad (Agente 2)
        phase2_diagnosis: faseMap[2] ?? null, // Entrevistas (Agente 1)
        phase3_diagnosis: faseMap[1] ?? null, // Documentación (Agente 3)
        raw_context: rawContext,
      },
      comments,
      __fileUrls: fileUrls
    };
  }

  // Fases 5 — Madurez de la PMO: Lee respuestas de encuestas por tipo
  if (phaseNumber === 5) {
    // 1. Leer diagnóstico de Fase 4 como contexto
    const { data: fase4 } = await supabase
      .from("fases_estado")
      .select("datos_consolidados")
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 4)
      .single();

    // 2. Leer respuestas de madurez predictiva
    const { data: respPredictiva } = await supabase
      .from("encuestas_respuestas")
      .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
      .eq("proyecto_id", projectId)
      .eq("tipo_encuesta", "predictiva");

    // 3. Leer respuestas de madurez agil
    const { data: respAgil } = await supabase
      .from("encuestas_respuestas")
      .select("id, nombre_encuestado, cargo_encuestado, area_encuestado, respuestas")
      .eq("proyecto_id", projectId)
      .eq("tipo_encuesta", "agil");

    // Convierte filas de DB al formato que espera el agente:
    // answers[].responses = { "G1-01": 3, "G1-02": 4, ... }
    const formatAnswers = (rows: any[]) =>
      (rows ?? []).map((r: any, idx: number) => ({
        respondent_id: `r-${String(idx + 1).padStart(3, "0")}`,
        name: r.nombre_encuestado,
        role: r.cargo_encuestado,
        responses: Object.fromEntries(
          (Array.isArray(r.respuestas) ? r.respuestas : [])
            .map((ans: any, ansIdx: number) => {
              const code = String(ans.codigo || ans.id || ans.pregunta_id || ans.pregunta_codigo || ans.pregunta || `Pregunta_${ansIdx + 1}`);
              const rawVal = ans.valor !== undefined ? ans.valor : ans.respuesta !== undefined ? ans.respuesta : 0;
              const val = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0;
              return [code, val];
            })
            .filter(([code]) => code !== "undefined" && code !== "null" && code !== "")
        ),
        open_question: "",
      }));

    const pmoTypeResolved = (comments as any)?.pmoType ?? "Hibrido";

    const fileUrls: {url: string, type: string}[] = [];
    for (const url of [externalFileUrl, ...(extraFileUrls ?? [])].filter(Boolean)) {
      const freshUrl = await ensureFreshUrl(url as string);
      const ext = String(url).split("?")[0].split(".").pop()?.toLowerCase();
      fileUrls.push({ url: freshUrl, type: ext === "csv" ? "text/csv" : "application/pdf" });
    }

    return {
      metadata: { ...baseMetadata, agent_id: "agente-5" },
      payload: {
        approved_pmo_type: pmoTypeResolved,
        maturity_surveys: {
          predictive: {
            survey_type: "predictive",
            input_method: (respPredictiva ?? []).length > 0 ? "online_survey" : "bulk_upload",
            answers: formatAnswers(respPredictiva ?? []),
          },
          agile: {
            survey_type: "agile",
            input_method: (respAgil ?? []).length > 0 ? "online_survey" : "bulk_upload",
            answers: formatAnswers(respAgil ?? []),
          },
        },
        fase4_diagnostico_referencia: (fase4?.datos_consolidados as any)?.diagnosis || fase4?.datos_consolidados || null,
      },
      comments: (comments as any)?.comentario_consultor ?? null,
      __fileUrls: fileUrls,
    };
  }

  // Fase 6 — Enfoque para Guía Metodológica: lee diagnósticos aprobados de Fases 4 y 5
  if (phaseNumber === 6) {
    const { data: prevFases } = await supabase
      .from("fases_estado")
      .select("numero_fase, datos_consolidados")
      .eq("proyecto_id", projectId)
      .in("numero_fase", [4, 5]);

    const faseMap: Record<number, any> = {};
    for (const f of prevFases ?? []) {
      const dc = f.datos_consolidados as any;
      faseMap[f.numero_fase] = dc?.diagnosis ? dc.diagnosis : dc;
    }

    return {
      metadata: { ...baseMetadata, agent_id: "agente-6" },
      payload: {
        approved_phase4_diagnosis: faseMap[4] ?? null,
        approved_phase5_diagnosis: faseMap[5] ?? null,
      },
      comments,
    };
  }

  // Fase 9 — Generador de preguntas de entrevista (Agente 3.1)
  // Recibe el diagnóstico del Agente 3 (fase 1 en fases_estado) + los documentos originales
  if (phaseNumber === 9) {
    // 1. Leer el diagnóstico ya generado por el Agente 3 (guardado en fase 1)
    const { data: fase1Estado } = await supabase
      .from("fases_estado")
      .select("datos_consolidados")
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 1)
      .single();

    const dc = fase1Estado?.datos_consolidados as any;
    const agent3Diagnosis = dc?.diagnosis ?? dc ?? null;

    // 2. Leer documentos y generar signed URLs frescas (igual que Fase 1)
    const { data: docs } = await supabase
      .from("documentos")
      .select("id, storage_path, categoria, nombre_personalizado, metadatos, created_at")
      .eq("proyecto_id", projectId);

    const fileUrls: { url: string; type: string }[] = [];
    for (const d of docs ?? []) {
      if (d.storage_path) {
        const freshUrl = await ensureFreshUrl(d.storage_path);
        const ext = String(d.storage_path).split('?')[0].split(".").pop()?.toLowerCase();
        fileUrls.push({ url: freshUrl, type: ext === "csv" ? "text/csv" : "application/pdf" });
      }
    }

    return {
      metadata: { ...baseMetadata, phase: "3.1", agent_id: "agente-3-1" },
      payload: {
        agent3_diagnosis: agent3Diagnosis,
      },
      comments,
      __fileUrls: fileUrls,
    };
  }

  // Fases 7–8: Estructura base para expandir
  return {
    metadata: baseMetadata,
    payload: {},
    comments,
  };
}

/**
 * Verifica si las fases 1, 2 y 3 están completadas y si es así,
 * dispara automáticamente el agente de la Fase 4.
 */
async function checkAndTriggerPhase4(
  supabase: ReturnType<typeof createClient>,
  projectId: string
) {
  const { data: fases } = await supabase
    .from("fases_estado")
    .select("numero_fase, estado_visual")
    .eq("proyecto_id", projectId)
    .in("numero_fase", [1, 2, 3]);

  const allCompleted = (fases ?? []).every(
    (f: { estado_visual: string }) => f.estado_visual === "completado"
  );

  if (!allCompleted) return;

  // Marcar fase 4 como "procesando"
  await supabase
    .from("fases_estado")
    .update({ estado_visual: "procesando", updated_at: new Date().toISOString() })
    .eq("proyecto_id", projectId)
    .eq("numero_fase", 4);

  // Llamar al agente 4
  try {
    await runAgent(supabase, projectId, 4, 1, null);
  } catch (error) {
    console.error("Error en auto-trigger Fase 4:", error);
    // Revertir a disponible si falla el auto-trigger
    await supabase
      .from("fases_estado")
      .update({ estado_visual: "disponible", updated_at: new Date().toISOString() })
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 4);
  }
}

/**
 * Núcleo del orquestador: llama a LangChain + Gemini y guarda el resultado.
 */
async function runAgent(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  phaseNumber: number,
  iteration: number,
  comments: unknown | null,
  externalFileUrl?: string,
  extraFileUrls?: string[]
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
  const enforceJsonInstruction = `

IMPORTANTE: DEBES DEVOLVER ÚNICAMENTE UN OBJETO JSON VÁLIDO.
RECORDATORIO CRÍTICO: El array 'resultados_por_item' DEBE contener exactamente 21 elementos (uno por cada factor individual: C01-C07, E01-E07, P01-P07). NO resumas los datos en solo 3 puntos de dimensiones generales. Queremos ver el desglose completo en el radar.

Tu respuesta DEBE empezar con '{' y terminar con '}'. Sin markdown, sin texto extra.`;
  const fullPrompt = `${agentConfig.prompt_sistema}\n\nJSON DE ENTRADA:\n${JSON.stringify(
    inputEnvelope,
    null,
    2
  )}${enforceJsonInstruction}`;

  // Preparar contenido multimodal
  let parts: any[] = [{ text: fullPrompt }];
  const hasFiles = __fileUrls && __fileUrls.length > 0;
  
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

  // IMPORTANTE: Usar siempre gemini-flash-lite-latest.
  const modelName = "gemini-flash-lite-latest";
  const apiKey = Deno.env.get("GOOGLE_API_KEY") ?? "";
  
  // Invocar Gemini a través de API REST nativa (para soportar PDF inlineData sin problemas de LangChain)
  const startTime = Date.now();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const geminiResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: agentConfig?.temperatura ?? 0.2,
      }
    })
  });

  const geminiData = await geminiResponse.json();
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!geminiResponse.ok) {
    throw new Error(`Error de Gemini API: ${geminiData.error?.message || JSON.stringify(geminiData)}`);
  }

  // Extraer y validar el JSON de la respuesta
  let diagnosis: unknown;
  const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Limpiar posibles bloques de markdown y extraer solo el objeto JSON (desde { hasta })
  let cleaned = rawContent.trim();
  
  // Si Gemini todavía devuelve texto, intentamos extraer el bloque JSON
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    // Fallback: remover markdown básico si por casualidad es un array [] u otro formato
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
      `La IA devolvió un JSON inválido. Tiempo: ${processingTime}s. Respuesta original: ${rawContent.substring(0, 150)}...`
    );
  }

  // ── Verificar si la fase fue cancelada durante el procesamiento ──────────
  // El usuario puede cancelar desde el frontend actualizando estado_visual a 'disponible'.
  // Si ya no está en 'procesando', saltamos el guardado para no sobreescribir la cancelación.
  const { data: currentState } = await supabase
    .from("fases_estado")
    .select("estado_visual")
    .eq("proyecto_id", projectId)
    .eq("numero_fase", phaseNumber)
    .single();

  if (currentState?.estado_visual !== "procesando") {
    console.log(`Fase ${phaseNumber} cancelada por el usuario durante el procesamiento. Resultado descartado.`);
    return { diagnosis: null, processingTime, cancelled: true };
  }

  // Guardar en fases_estado
  const { error: saveError } = await supabase
    .from("fases_estado")
    .upsert(
      {
        proyecto_id: projectId,
        numero_fase: phaseNumber,
        estado_visual: (phaseNumber === 3 || phaseNumber === 9) ? "completado" : "disponible", // Phase 3 & 9 auto-complete
        datos_consolidados: diagnosis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "proyecto_id,numero_fase" }
    );

  if (saveError) throw new Error(`Error guardando diagnóstico: ${saveError.message}`);

  return { diagnosis, processingTime, cancelled: false };
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

    // Marcar fase como "procesando" en la UI
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
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
        extraFileUrls
      );
      diagnosis = result.diagnosis;
      processingTime = result.processingTime;
    } catch (agentError) {
      // Revertir la fase a disponible en caso de error
      await supabase
        .from("fases_estado")
        .update({ estado_visual: "disponible", updated_at: new Date().toISOString() })
        .eq("proyecto_id", projectId)
        .eq("numero_fase", phaseNumber);
        
      throw agentError; // relanzar para que lo atrape el catch global
    }

    // Si termina la fase 3, verificar si disparar la 4 automáticamente
    if (phaseNumber === 3) {
      // No usar await para no bloquear la respuesta de la fase 3
      checkAndTriggerPhase4(supabase, projectId).catch(e => console.error("Auto trigger Phase 4 error:", e));
    }

    // Si termina la fase 1 (Agente 3 — Documentación), disparar el Agente 9 en paralelo
    if (phaseNumber === 1) {
      (async () => {
        try {
          await supabase.from("fases_estado").upsert(
            { proyecto_id: projectId, numero_fase: 9, estado_visual: "procesando", updated_at: new Date().toISOString() },
            { onConflict: "proyecto_id,numero_fase" }
          );
          await runAgent(supabase, projectId, 9, 1, null);
        } catch (e) {
          console.error("[pmo-agent] Error auto-trigger Agente 9:", e);
          await supabase.from("fases_estado")
            .update({ estado_visual: "disponible", updated_at: new Date().toISOString() })
            .eq("proyecto_id", projectId)
            .eq("numero_fase", 9);
        }
      })().catch(e => console.error("Agente 9 background error:", e));
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
