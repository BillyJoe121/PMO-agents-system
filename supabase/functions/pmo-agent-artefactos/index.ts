import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callAiWithFallback,
  DEFAULT_ANTHROPIC_FALLBACK_MODEL,
  DEFAULT_OPENAI_FALLBACK_MODEL,
  getAiModelSettings,
  getModelCandidates,
  type AiAttemptError,
  type AiModelCandidate,
  type AiProvider,
} from "../pmo-agent/_shared/aiModels.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AiTextResult {
  text: string;
  provider: AiProvider;
  model: string;
  attemptedModels: string[];
  errors: AiAttemptError[];
  fallbackUsed: boolean;
}

function logPhase8(event: string, details: Record<string, unknown> = {}) {
  console.info(`[pmo-agent-artefactos][phase8][${event}]`, {
    at: new Date().toISOString(),
    ...details,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista maestra de artefactos PMO
// ─────────────────────────────────────────────────────────────────────────────
const ARTEFACTOS_MAESTROS = [
  "Caso de negocio",
  "Acta de constitución",
  "Matriz de interesados",
  "Enunciado de alcance",
  "Cronograma (Sin formato)",
  "Formato de presupuesto",
  "Matriz de riesgos",
  "Formato de comunicaciones",
  "Formato de incidencias",
  "Formato de entregables y validación",
  "Informe de avance e indicadores",
  "Acta de cierre",
  "Encuesta de satisfacción",
  "Matriz de lecciones aprendidas",
];

const ARTEFACTOS_BASE_RECOMENDADOS = [
  "Acta de constitución",
  "Matriz de interesados",
  "Enunciado de alcance",
  "Cronograma (Sin formato)",
  "Formato de presupuesto",
  "Matriz de riesgos",
  "Formato de comunicaciones",
  "Informe de avance e indicadores",
];

const ARTIFACT_ALIASES: Record<string, string[]> = {
  "Caso de negocio": ["business case", "justificación económica", "justificación estratégica", "viabilidad del proyecto", "beneficios esperados"],
  "Acta de constitución": ["acta de constitución del proyecto", "project charter", "charter", "autorización formal del proyecto", "documento de inicio"],
  "Matriz de interesados": ["matriz de stakeholders", "registro de interesados", "stakeholder register", "gestión de interesados", "mapa de interesados"],
  "Enunciado de alcance": ["declaración de alcance", "scope statement", "gestión del alcance", "límites del proyecto", "entregables del alcance"],
  "Cronograma (Sin formato)": ["cronograma", "schedule", "plan de tiempos", "línea base de cronograma", "hitos", "actividades"],
  "Formato de presupuesto": ["presupuesto", "budget", "control de costos", "línea base de costos", "estimación de costos"],
  "Matriz de riesgos": ["registro de riesgos", "risk register", "gestión de riesgos", "análisis de riesgos", "plan de respuesta a riesgos"],
  "Formato de comunicaciones": ["plan de comunicaciones", "matriz de comunicaciones", "comunicaciones", "gestión de comunicaciones", "reporte a interesados"],
  "Formato de incidencias": ["registro de incidencias", "issue log", "gestión de incidencias", "problemas", "impedimentos"],
  "Formato de entregables y validación": ["validación de entregables", "aceptación de entregables", "control de entregables", "criterios de aceptación", "formato de entregables"],
  "Informe de avance e indicadores": ["informe de avance", "informe de estado", "status report", "indicadores", "kpi", "métricas", "tablero de indicadores", "dashboard"],
  "Acta de cierre": ["cierre del proyecto", "project closure", "acta de finalización", "cierre formal"],
  "Encuesta de satisfacción": ["satisfacción", "encuesta de cliente", "evaluación de satisfacción", "feedback del cliente"],
  "Matriz de lecciones aprendidas": ["lecciones aprendidas", "lessons learned", "retrospectiva", "mejora continua", "conocimiento adquirido"],
};

const ACTIVE_ARTEFACTOS_MAESTROS = [
  "Abastecimiento",
  "Acta de constitucion",
  "Acta de reunion",
  "Caso de negocio",
  "Control de entregables",
  "Cronograma",
  "Declaracion de alcance",
  "Enunciado del alcance",
  "Informe de avance",
  "Lecciones aprendidas",
  "Matriz de interesados",
  "Matriz de requisitos",
  "Plan de direccion de proyectos",
  "Presupuesto general",
  "Presupuesto por hito",
  "Registro de cambios",
  "Registro de incidencias",
  "Registro de riesgos",
];

const ACTIVE_ARTEFACTOS_BASE_RECOMENDADOS = [
  "Acta de constitucion",
  "Caso de negocio",
  "Cronograma",
  "Enunciado del alcance",
  "Informe de avance",
  "Matriz de interesados",
  "Plan de direccion de proyectos",
  "Presupuesto general",
  "Registro de riesgos",
];

const ACTIVE_ARTIFACT_ALIASES: Record<string, string[]> = {
  "Acta de constitucion": ["acta de constitucion", "acta de constitución del proyecto", "project charter", "charter", "documento de inicio"],
  "Acta de reunion": ["acta de reunion", "acta de reunión", "minuta", "meeting minutes"],
  "Declaracion de alcance": ["declaracion de alcance", "declaración de alcance", "declaracion del alcance", "scope statement"],
  "Enunciado del alcance": ["enunciado de alcance", "enunciado del alcance", "scope statement", "gestion del alcance"],
  "Registro de riesgos": ["matriz de riesgos", "registro de riesgos", "risk register", "gestion de riesgos", "analisis de riesgos"],
  "Presupuesto general": ["formato de presupuesto", "presupuesto", "budget", "control de costos", "linea base de costos"],
  "Presupuesto por hito": ["presupuesto por hito", "presupuesto por hitos", "costos por hito"],
  "Matriz de interesados": ["matriz de stakeholders", "registro de interesados", "stakeholder register", "gestion de interesados"],
  "Informe de avance": ["informe de avance e indicadores", "informe de avance", "informe de estado", "status report", "indicadores", "kpi", "metricas", "dashboard"],
  "Registro de incidencias": ["formato de incidencias", "registro de incidencias", "issue log", "gestion de incidencias", "problemas", "impedimentos"],
  "Control de entregables": ["formato de entregables y validacion", "validacion de entregables", "aceptacion de entregables", "control de entregables", "criterios de aceptacion"],
  "Lecciones aprendidas": ["matriz de lecciones aprendidas", "lecciones aprendidas", "lessons learned", "retrospectiva", "mejora continua"],
  "Registro de cambios": ["registro de cambios", "control de cambios", "solicitudes de cambio", "change log"],
  "Matriz de requisitos": ["matriz de requisitos", "requirements matrix", "requisitos", "trazabilidad de requisitos"],
  "Plan de direccion de proyectos": ["plan de direccion de proyectos", "plan de dirección de proyectos", "project management plan", "plan para la direccion"],
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function unwrapFase7Payload(agentData: any): any {
  if (!agentData) return null;
  const parsed = typeof agentData === "string" ? safeJsonParse(agentData) ?? agentData : agentData;
  
  // Si viene con el wrapper de versiones (_current, _versions)
  if (parsed?._current) return parsed._current;
  
  // Fallback para otros formatos posibles
  return parsed?.diagnosis ?? parsed?.data?.diagnosis ?? parsed?.data ?? parsed;
}



function resolveArtifactName(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  for (const artifact of ACTIVE_ARTEFACTOS_MAESTROS) {
    const candidates = [artifact, ...(ACTIVE_ARTIFACT_ALIASES[artifact] ?? ARTIFACT_ALIASES[artifact] ?? [])].map(normalizeText);
    if (candidates.some(candidate => normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized))) {
      return artifact;
    }
  }

  return null;
}

function normalizeArtifactList(values: unknown): string[] {
  const rawValues = Array.isArray(values) ? values : [];
  return [...new Set(rawValues.map(resolveArtifactName).filter((value): value is string => Boolean(value)))];
}

function stringifyGuideValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(stringifyGuideValue).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([_, nestedValue]) => nestedValue !== null && nestedValue !== undefined && nestedValue !== "")
      .map(([key, nestedValue]) => `${key}: ${stringifyGuideValue(nestedValue)}`)
      .join("\n");
  }
  return String(value);
}

function inferRecommendedFromText(text: string): string[] {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];

  return ACTIVE_ARTEFACTOS_MAESTROS.filter(artifact => {
    const candidates = [artifact, ...(ACTIVE_ARTIFACT_ALIASES[artifact] ?? ARTIFACT_ALIASES[artifact] ?? [])].map(normalizeText);
    return candidates.some(candidate => candidate.length > 3 && normalizedText.includes(candidate));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt del sistema para Gemini
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(fase7Content: string, systemPrompt?: string): string {
  if (systemPrompt) {
    if (systemPrompt.includes("${fase7Content}")) {
      return systemPrompt.replaceAll("${fase7Content}", fase7Content);
    }
    return `${systemPrompt}\n\nDOCUMENTO DE LA FASE 7:\n---\n${fase7Content}\n---`;
  }
  return `Eres un experto en gestión de proyectos y oficinas de proyectos (PMO). 
Se te proporciona el documento aprobado de la Fase 7 (Guía Metodológica) de un proyecto de implementación de PMO.

Tu tarea es analizar ese documento y, tomando como base la siguiente lista EXACTA de artefactos disponibles, clasificarlos en dos categorías:

1. **artefactos_recomendados**: Los artefactos de la lista maestra que el documento de la Fase 7 sugiere, menciona, requiere o que claramente se alinean con la metodología descrita.
2. **otros_artefactos**: Los artefactos de la lista maestra que NO están directamente recomendados o que son complementarios / opcionales según el contexto del documento.

LISTA MAESTRA DE ARTEFACTOS (debes usar los nombres EXACTAMENTE como aparecen aquí):
${ACTIVE_ARTEFACTOS_MAESTROS.map((a, i) => `${i + 1}. ${a}`).join("\n")}

REGLAS:
- Cada artefacto de la lista maestra debe aparecer en EXACTAMENTE UNA de las dos listas.
- No inventes ni agregues artefactos que no estén en la lista maestra.
- No cambies el nombre de los artefactos.
- Basa tu clasificación únicamente en el análisis del documento de la Fase 7.
- Si el documento menciona un artefacto con un nombre equivalente, clasifica el nombre exacto de la lista maestra como recomendado.
- Si el documento define procesos de inicio, planificación, ejecución, monitoreo, control o cierre, recomienda los artefactos que sean necesarios para operar esos procesos, aunque no aparezcan con el nombre literal.
- No devuelvas artefactos_recomendados vacío salvo que el documento no contenga absolutamente ninguna práctica, proceso, rol, métrica, riesgo, alcance, cronograma, presupuesto, comunicación, entregable, cierre o lección aprendida.

DOCUMENTO DE LA FASE 7:
---
${fase7Content}
---

Responde ÚNICAMENTE con un JSON válido con la siguiente estructura, sin texto adicional, sin markdown, sin explicaciones:
{
  "artefactos_recomendados": ["nombre exacto del artefacto", ...],
  "otros_artefactos": ["nombre exacto del artefacto", ...]
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Llamada a Gemini API directamente via REST
// ─────────────────────────────────────────────────────────────────────────────
async function callAi(
  prompt: string,
  apiKeys: { openai: string; anthropic: string; gemini?: string },
  candidates: AiModelCandidate[],
  temperature?: number
): Promise<AiTextResult> {
  const result = await callAiWithFallback(apiKeys, candidates, {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: temperature ?? 1,
      responseMimeType: "application/json",
    },
  });

  return {
    text: result.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    provider: result.provider,
    model: result.model,
    attemptedModels: result.attemptedModels,
    errors: result.errors,
    fallbackUsed: result.fallbackUsed,
  };
}

// -----------------------------------------------------------------------------
// Extrae y serializa el contenido de la Fase 7 como texto plano
// -----------------------------------------------------------------------------
function extractFase7Content(agentData: any): string {
  if (!agentData) return "";
  if (typeof agentData === "string") {
    const parsed = safeJsonParse(agentData);
    if (!parsed) return agentData;
    agentData = parsed;
  }

  // Intenta extraer el texto de la guía metodológica aprobada
  const d = unwrapFase7Payload(agentData);

  const parts: string[] = [];

  if (d.titulo) parts.push(`Título: ${d.titulo}`);
  if (d.resumen || d.summary) parts.push(`Resumen: ${d.resumen ?? d.summary}`);
  if (d.introduccion) parts.push(`Introducción: ${d.introduccion}`);
  if (d.descripcion_general) parts.push(`Descripción: ${d.descripcion_general}`);

  // Secciones / capítulos de la guía
  const secciones = d.capitulos ?? d.chapters ?? d.secciones ?? d.guide_content ?? d.diagnosis?.guide_content ?? d.contenido ?? [];
  if (Array.isArray(secciones) && secciones.length > 0) {
    parts.push("\nSecciones de la guía:");
    for (const sec of secciones) {
      if (typeof sec === "string") {
        parts.push(`- ${sec}`);
      } else {
        const titulo = sec.titulo ?? sec.title ?? sec.nombre ?? sec.section_title ?? sec.id ?? sec.section_id ?? "";
        const contenido = sec.contenido ?? sec.content ?? sec.descripcion ?? sec.description ?? sec.enfasis ?? sec.introduccion ?? "";
        parts.push(`- ${titulo}: ${stringifyGuideValue(contenido)}`);

        // Sub-secciones si existen
        const subsecs = sec.subsecciones ?? sec.subsections ?? sec.secciones ?? [];
        if (Array.isArray(subsecs)) {
          for (const sub of subsecs) {
            const stit = sub.titulo ?? sub.title ?? "";
            const scont = sub.contenido ?? sub.content ?? sub.descripcion ?? "";
            if (stit || scont) parts.push(`  · ${stit}: ${stringifyGuideValue(scont)}`);
          }
        }
      }
    }
  } else if (secciones && typeof secciones === "object") {
    parts.push("\nSecciones de la guÃ­a:");
    for (const [key, value] of Object.entries(secciones as Record<string, unknown>)) {
      parts.push(`- ${key}: ${stringifyGuideValue(value)}`);
    }
  }

  // Artefactos que el propio agente 7 haya mencionado
  const artefactos = d.artefactos_recomendados ?? d.artefactos ?? d.artifacts ?? [];
  if (Array.isArray(artefactos) && artefactos.length > 0) {
    parts.push("\nArtefactos mencionados en la guía:");
    for (const art of artefactos) {
      if (typeof art === "string") {
        parts.push(`- ${art}`);
      } else {
        const nombre = art.nombre ?? art.name ?? art.titulo ?? "";
        const desc = art.descripcion ?? art.description ?? "";
        parts.push(`- ${nombre}${desc ? `: ${desc}` : ""}`);
      }
    }
  }

  // Si hay metodología / enfoque
  if (d.metodologia) parts.push(`\nMetodología: ${typeof d.metodologia === "string" ? d.metodologia : JSON.stringify(d.metodologia)}`);
  if (d.enfoque) parts.push(`Enfoque: ${typeof d.enfoque === "string" ? d.enfoque : JSON.stringify(d.enfoque)}`);



  // Fallback: serializar todo el JSON como texto si no se extrajo nada útil
  if (parts.length === 0) {
    return JSON.stringify(agentData, null, 2);
  }

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let projectId = "";
  let supabaseUrl = "";
  let supabaseKey = "";

  try {
    const body = await req.json();
    projectId = body.projectId;
    logPhase8("request_received", { projectId });

    if (!projectId) {
      return new Response(
        JSON.stringify({ success: false, error: "projectId es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKeys = {
      openai: Deno.env.get("OPENAI_API_KEY") || "",
      anthropic: Deno.env.get("ANTHROPIC_API_KEY") || "",
      gemini: Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "",
    };

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 0. Cargar configuración del agente desde la DB ──────────────────────
    const { data: agentConfig } = await supabase
      .from("configuracion_agentes")
      .select("*")
      .eq("fase_numero", 8)
      .single();
    const modelSettings = await getAiModelSettings(supabase);
    const modelsToTry = getModelCandidates(modelSettings);
    logPhase8("model_config_loaded", {
      projectId,
      configuredProvider: modelSettings.provider,
      selectedModel: modelSettings.selected_model,
      attemptedModels: modelsToTry.map((model) => `${model.provider}:${model.model}`),
      hasAgentPrompt: Boolean(agentConfig?.prompt_sistema),
    });

    // ── 1. Marcar fase 8 como procesando ────────────────────────────────────
    await supabase
      .from("fases_estado")
      .update({
        estado_visual: "procesando",
        datos_consolidados: null,
        updated_at: new Date().toISOString(),
      })
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 8);
    logPhase8("marked_processing", { projectId });

    // ── 2. Leer el resultado aprobado de la Fase 7 ───────────────────────────
    const { data: fase7Row, error: fase7Error } = await supabase
      .from("fases_estado")
      .select("datos_consolidados")
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 7)
      .single();

    if (fase7Error || !fase7Row?.datos_consolidados) {
      throw new Error(
        "No se encontró el resultado aprobado de la Fase 7. Asegúrate de haber completado y aprobado la Guía Metodológica."
      );
    }

    // ── 3. Extraer contenido legible de la Fase 7 ────────────────────────────
    const fase7Content = extractFase7Content(fase7Row.datos_consolidados);
    logPhase8("fase7_content_extracted", {
      projectId,
      contentChars: fase7Content.length,
    });

    if (!fase7Content.trim()) {
      throw new Error("El documento de la Fase 7 está vacío o no tiene contenido procesable.");
    }

    // ── 4. Construir prompt y llamar a Gemini ─────────────────────────────────
    const prompt = buildPrompt(fase7Content, agentConfig?.prompt_sistema);
    logPhase8("prompt_start", {
      projectId,
      promptChars: prompt.length,
      contentChars: fase7Content.length,
    });
    const geminiResponse = await callAi(
      prompt,
      apiKeys,
      modelsToTry,
      agentConfig?.temperatura ? Number(agentConfig.temperatura) : 1
    );
    logPhase8("ai_response", {
      projectId,
      provider: geminiResponse.provider,
      model: geminiResponse.model,
      responseChars: geminiResponse.text.length,
      fallbackUsed: geminiResponse.fallbackUsed,
      attemptedModels: geminiResponse.attemptedModels,
      errors: geminiResponse.errors.map((error) => `${error.provider}:${error.model}:${error.message}`),
    });

    // ── 5. Parsear la respuesta JSON ──────────────────────────────────────────
    let resultado: { artefactos_recomendados: string[]; otros_artefactos: string[] };
    try {
      resultado = JSON.parse(geminiResponse.text);
    } catch {
      // Intentar extraer JSON si Gemini puso texto antes/después
      const jsonMatch = geminiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`El proveedor de IA no devolvio JSON valido: ${geminiResponse.text.slice(0, 300)}`);
      }
      resultado = JSON.parse(jsonMatch[0]);
    }

    // ── 6. Normalizar, complementar y validar contra la lista maestra ───────
    logPhase8("json_parsed", {
      projectId,
      aiRecommendedRaw: Array.isArray(resultado.artefactos_recomendados) ? resultado.artefactos_recomendados.length : null,
      aiOtherRaw: Array.isArray(resultado.otros_artefactos) ? resultado.otros_artefactos.length : null,
    });

    const aiRecommended = normalizeArtifactList(resultado.artefactos_recomendados);
    const aiOther = normalizeArtifactList(resultado.otros_artefactos);
    const deterministicRecommended = inferRecommendedFromText(fase7Content);

    const recommendationSource = aiRecommended.length > 0 ? "ai" : deterministicRecommended.length > 0 ? "text_inference" : "base_fallback";
    const recommendedSet = new Set(recommendationSource === "ai" ? aiRecommended : deterministicRecommended);
    const usedFallback = recommendationSource === "base_fallback";
    if (usedFallback) {
      for (const artifact of ACTIVE_ARTEFACTOS_BASE_RECOMENDADOS) {
        recommendedSet.add(artifact);
      }
    }

    const finalRecommended = ACTIVE_ARTEFACTOS_MAESTROS.filter(artifact => recommendedSet.has(artifact));
    const finalOther = ACTIVE_ARTEFACTOS_MAESTROS.filter(artifact => !recommendedSet.has(artifact));

    resultado = {
      artefactos_recomendados: finalRecommended,
      otros_artefactos: finalOther,
    };

    // ── 7. Persistir en fases_estado ─────────────────────────────────────────
    logPhase8("classification_finalized", {
      projectId,
      recommendationSource,
      aiRecommended: aiRecommended.length,
      aiOther: aiOther.length,
      inferredByText: deterministicRecommended.length,
      finalRecommended: finalRecommended.length,
      finalOther: finalOther.length,
    });

    const datosFinales = {
      artefactos_recomendados: resultado.artefactos_recomendados,
      otros_artefactos: resultado.otros_artefactos,
      lista_maestra: ACTIVE_ARTEFACTOS_MAESTROS,
      metadata: {
        timestamp: new Date().toISOString(),
        agent_id: "agente-8",
        fase_origen: 7,
        total_recomendados: resultado.artefactos_recomendados.length,
        total_otros: resultado.otros_artefactos.length,
        ai_recomendados_normalizados: aiRecommended,
        ai_otros_normalizados: aiOther,
        inferidos_por_texto: deterministicRecommended,
        fuente_recomendaciones: recommendationSource,
        uso_fallback_base: usedFallback,
        model_provider_configured: modelSettings.provider,
        model_selected: modelSettings.selected_model,
        model_openai_fallback: DEFAULT_OPENAI_FALLBACK_MODEL,
        model_anthropic_fallback: DEFAULT_ANTHROPIC_FALLBACK_MODEL,
        legacy_gemini_high: modelSettings.high_model,
        legacy_gemini_low: modelSettings.low_model,
        model_provider: geminiResponse.provider,
        model_used: geminiResponse.model,
        model_fallback_used: geminiResponse.fallbackUsed,
        attempted_models: geminiResponse.attemptedModels,
        model_errors: geminiResponse.errors,
      },
    };

    await supabase
      .from("fases_estado")
      .update({
        estado_visual: "disponible",
        datos_consolidados: datosFinales,
        updated_at: new Date().toISOString(),
      })
      .eq("proyecto_id", projectId)
      .eq("numero_fase", 8);
    logPhase8("saved_result", {
      projectId,
      totalRecommended: resultado.artefactos_recomendados.length,
      totalOther: resultado.otros_artefactos.length,
    });

    return new Response(
      JSON.stringify({ success: true, data: datosFinales }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("[pmo-agent-artefactos] Error:", msg);

    // Intentar actualizar la base de datos a estado de error para que la UI se entere
    if (projectId && supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("fases_estado")
          .update({
            estado_visual: "error",
            datos_consolidados: { error: true, message: msg },
            updated_at: new Date().toISOString(),
          })
          .eq("proyecto_id", projectId)
          .eq("numero_fase", 8);
      } catch (dbError) {
        console.error("No se pudo actualizar el estado de error en BD", dbError);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
