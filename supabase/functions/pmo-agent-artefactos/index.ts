import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  for (const artifact of ARTEFACTOS_MAESTROS) {
    const candidates = [artifact, ...(ARTIFACT_ALIASES[artifact] ?? [])].map(normalizeText);
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

function inferRecommendedFromText(text: string): string[] {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];

  return ARTEFACTOS_MAESTROS.filter(artifact => {
    const candidates = [artifact, ...(ARTIFACT_ALIASES[artifact] ?? [])].map(normalizeText);
    return candidates.some(candidate => candidate.length > 3 && normalizedText.includes(candidate));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt del sistema para Gemini
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(fase7Content: string, systemPrompt?: string): string {
  if (systemPrompt) {
    return `${systemPrompt}\n\nDOCUMENTO DE LA FASE 7:\n---\n${fase7Content}\n---`;
  }
  return `Eres un experto en gestión de proyectos y oficinas de proyectos (PMO). 
Se te proporciona el documento aprobado de la Fase 7 (Guía Metodológica) de un proyecto de implementación de PMO.

Tu tarea es analizar ese documento y, tomando como base la siguiente lista EXACTA de artefactos disponibles, clasificarlos en dos categorías:

1. **artefactos_recomendados**: Los artefactos de la lista maestra que el documento de la Fase 7 sugiere, menciona, requiere o que claramente se alinean con la metodología descrita.
2. **otros_artefactos**: Los artefactos de la lista maestra que NO están directamente recomendados o que son complementarios / opcionales según el contexto del documento.

LISTA MAESTRA DE ARTEFACTOS (debes usar los nombres EXACTAMENTE como aparecen aquí):
${ARTEFACTOS_MAESTROS.map((a, i) => `${i + 1}. ${a}`).join("\n")}

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
async function callGemini(prompt: string, apiKey: string, modelName?: string, temperature?: number): Promise<string> {
  const model = modelName || "gemini-3-flash-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: temperature ?? 0.2,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extrae y serializa el contenido de la Fase 7 como texto plano
// ─────────────────────────────────────────────────────────────────────────────
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
  const secciones = d.capitulos ?? d.chapters ?? d.secciones ?? d.guide_content ?? d.contenido ?? [];
  if (Array.isArray(secciones) && secciones.length > 0) {
    parts.push("\nSecciones de la guía:");
    for (const sec of secciones) {
      if (typeof sec === "string") {
        parts.push(`- ${sec}`);
      } else {
        const titulo = sec.titulo ?? sec.title ?? sec.nombre ?? sec.section_title ?? sec.id ?? sec.section_id ?? "";
        const contenido = sec.contenido ?? sec.content ?? sec.descripcion ?? sec.description ?? sec.enfasis ?? sec.introduccion ?? "";
        parts.push(`- ${titulo}: ${contenido}`);

        // Sub-secciones si existen
        const subsecs = sec.subsecciones ?? sec.subsections ?? sec.secciones ?? [];
        if (Array.isArray(subsecs)) {
          for (const sub of subsecs) {
            const stit = sub.titulo ?? sub.title ?? "";
            const scont = sub.contenido ?? sub.content ?? sub.descripcion ?? "";
            if (stit || scont) parts.push(`  · ${stit}: ${scont}`);
          }
        }
      }
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

    if (!projectId) {
      return new Response(
        JSON.stringify({ success: false, error: "projectId es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      throw new Error("Falta la configuración de la API Key (GOOGLE_API_KEY o GEMINI_API_KEY) en los secretos de Supabase.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 0. Cargar configuración del agente desde la DB ──────────────────────
    const { data: agentConfig } = await supabase
      .from("configuracion_agentes")
      .select("*")
      .eq("fase_numero", 8)
      .single();

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

    if (!fase7Content.trim()) {
      throw new Error("El documento de la Fase 7 está vacío o no tiene contenido procesable.");
    }

    // ── 4. Construir prompt y llamar a Gemini ─────────────────────────────────
    const prompt = buildPrompt(fase7Content, agentConfig?.prompt_sistema);
    const geminiResponse = await callGemini(
      prompt, 
      geminiApiKey, 
      agentConfig?.modelo, 
      agentConfig?.temperatura ? Number(agentConfig.temperatura) : 0.2
    );

    // ── 5. Parsear la respuesta JSON ──────────────────────────────────────────
    let resultado: { artefactos_recomendados: string[]; otros_artefactos: string[] };
    try {
      resultado = JSON.parse(geminiResponse);
    } catch {
      // Intentar extraer JSON si Gemini puso texto antes/después
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Gemini no devolvió JSON válido: ${geminiResponse.slice(0, 300)}`);
      }
      resultado = JSON.parse(jsonMatch[0]);
    }

    // ── 6. Normalizar, complementar y validar contra la lista maestra ───────
    const geminiRecommended = normalizeArtifactList(resultado.artefactos_recomendados);
    const geminiOther = normalizeArtifactList(resultado.otros_artefactos);
    const deterministicRecommended = inferRecommendedFromText(fase7Content);

    const recommendedSet = new Set([...geminiRecommended, ...deterministicRecommended]);
    const usedFallback = recommendedSet.size === 0;
    if (usedFallback) {
      for (const artifact of ARTEFACTOS_BASE_RECOMENDADOS) {
        recommendedSet.add(artifact);
      }
    }

    const finalRecommended = ARTEFACTOS_MAESTROS.filter(artifact => recommendedSet.has(artifact));
    const finalOther = ARTEFACTOS_MAESTROS.filter(artifact => !recommendedSet.has(artifact));

    resultado = {
      artefactos_recomendados: finalRecommended,
      otros_artefactos: finalOther,
    };

    // ── 7. Persistir en fases_estado ─────────────────────────────────────────
    const datosFinales = {
      artefactos_recomendados: resultado.artefactos_recomendados,
      otros_artefactos: resultado.otros_artefactos,
      lista_maestra: ARTEFACTOS_MAESTROS,
      metadata: {
        timestamp: new Date().toISOString(),
        agent_id: "agente-8",
        fase_origen: 7,
        total_recomendados: resultado.artefactos_recomendados.length,
        total_otros: resultado.otros_artefactos.length,
        gemini_recomendados_normalizados: geminiRecommended,
        gemini_otros_normalizados: geminiOther,
        inferidos_por_texto: deterministicRecommended,
        uso_fallback_base: usedFallback,
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
