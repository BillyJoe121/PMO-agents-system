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

function hasMeaningfulData(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return true;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

const IDONEIDAD_ITEM_RE = /([CEP]\d{1,2})/i;

function cleanIdoneidadItemCode(value: unknown) {
  const match = String(value ?? "").match(IDONEIDAD_ITEM_RE);
  return match ? match[1].toUpperCase() : null;
}

function inferIdoneidadDimension(code: string) {
  if (code.startsWith("C")) return "Cultura";
  if (code.startsWith("E")) return "Equipo";
  if (code.startsWith("P")) return "Proyecto";
  return "N/A";
}

function normalizeIdoneidadScore(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(cell => cell !== "")) rows.push(row);
  return rows;
}

function buildPhase3ItemResults(inputEnvelope: any, csvTexts: string[] = []) {
  const scoreMap = new Map<string, number[]>();

  const addScore = (codeValue: unknown, scoreValue: unknown) => {
    const code = cleanIdoneidadItemCode(codeValue);
    const score = normalizeIdoneidadScore(scoreValue);
    if (!code || score === null) return;
    const scores = scoreMap.get(code) ?? [];
    scores.push(score);
    scoreMap.set(code, scores);
  };

  const respondents = inputEnvelope?.payload?.respondents;
  if (Array.isArray(respondents)) {
    for (const respondent of respondents) {
      const answers = Array.isArray(respondent?.answers) ? respondent.answers : [];
      for (const answer of answers) {
        addScore(answer?.question_code ?? answer?.codigo ?? answer?.item, answer?.answer_score ?? answer?.valor ?? answer?.score);
      }
    }
  }

  for (const csvText of csvTexts) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) continue;
    const headers = rows[0].map(cleanIdoneidadItemCode);

    for (const row of rows.slice(1)) {
      row.forEach((cell, index) => {
        const code = headers[index];
        if (code) addScore(code, cell);
      });
    }
  }

  const orderGroup: Record<string, number> = { C: 0, E: 1, P: 2 };
  return [...scoreMap.entries()]
    .map(([item, scores]) => {
      const count = scores.length;
      const sum = scores.reduce((acc, score) => acc + score, 0);
      const promedio = count ? sum / count : 0;
      const variance = count
        ? scores.reduce((acc, score) => acc + Math.pow(score - promedio, 2), 0) / count
        : 0;
      const zona = promedio < 4 ? "agil" : promedio < 8 ? "hibrido" : "predictivo";

      return {
        item,
        dimension: inferIdoneidadDimension(item),
        promedio: Number(promedio.toFixed(1)),
        minimo: Math.min(...scores),
        maximo: Math.max(...scores),
        desviacion_estandar: Number(Math.sqrt(variance).toFixed(1)),
        zona,
        factor_critico: promedio <= 3 || promedio >= 8,
        numero_respuestas: count,
      };
    })
    .sort((a, b) => {
      const groupDelta = (orderGroup[a.item[0]] ?? 9) - (orderGroup[b.item[0]] ?? 9);
      if (groupDelta !== 0) return groupDelta;
      return (Number(a.item.slice(1)) || 0) - (Number(b.item.slice(1)) || 0);
    });
}

function withCompletedPhase3Items(diagnosis: unknown, inputEnvelope: any, csvTexts: string[] = []) {
  const deterministicItems = buildPhase3ItemResults(inputEnvelope, csvTexts);
  if (deterministicItems.length === 0 || typeof diagnosis !== "object" || diagnosis === null) return diagnosis;

  const wrapper = diagnosis as Record<string, any>;
  const inner = typeof wrapper.diagnosis === "object" && wrapper.diagnosis !== null
    ? wrapper.diagnosis
    : wrapper;

  const currentItems = Array.isArray(inner.resultados_por_item) ? inner.resultados_por_item : [];
  if (currentItems.length >= deterministicItems.length) return diagnosis;

  inner.resultados_por_item = deterministicItems;
  inner._resultados_por_item_fuente = "calculado_en_edge_function";

  if (typeof wrapper.metadata === "object" && wrapper.metadata !== null) {
    wrapper.metadata.agent_id = "agente-3";
  }

  return diagnosis;
}

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
      metadata: { ...baseMetadata, agent_id: "agente-3" },
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

  // Fase 7 — Guía metodológica: consume el enfoque aprobado de Fase 6
  if (phaseNumber === 7) {
    const { data: proyecto } = await supabase
      .from("proyectos")
      .select("id, nombre_proyecto, fecha_inicio, empresas(nombre)")
      .eq("id", projectId)
      .single();

    const { data: prevFases } = await supabase
      .from("fases_estado")
      .select("numero_fase, datos_consolidados")
      .eq("proyecto_id", projectId)
      .in("numero_fase", [4, 5, 6]);

    const faseMap: Record<number, any> = {};
    for (const f of prevFases ?? []) {
      const dc = f.datos_consolidados as any;
      faseMap[f.numero_fase] = dc?._current ?? dc?.diagnosis ?? dc;
    }

    return {
      metadata: { ...baseMetadata, agent_id: "agente-7" },
      payload: {
        project_context: {
          project_id: projectId,
          project_name: proyecto?.nombre_proyecto ?? null,
          company_name: (proyecto?.empresas as any)?.nombre ?? null,
          start_date: proyecto?.fecha_inicio ?? null,
        },
        approved_phase4_diagnosis: faseMap[4] ?? null,
        approved_phase5_diagnosis: faseMap[5] ?? null,
        approved_phase6_enfoque: faseMap[6] ?? null,
        response_rules: [
          "Devuelve exclusivamente JSON valido, sin Markdown ni texto adicional.",
          "La guia debe incluir un arreglo capitulos no vacio.",
          "Cada capitulo debe incluir titulo, introduccion y un arreglo secciones no vacio.",
          "Cada seccion debe incluir titulo y contenido; items y tabla son opcionales.",
          "El informe debe ser extenso, detallado y profesional; evita respuestas sinteticas, genericas o tipo checklist.",
          "Cada parrafo de contenido, cada item y cada subitem debe tener mas de 40 palabras, con explicacion contextual, justificacion, implicaciones practicas y recomendaciones aplicables a la PMO.",
          "Cuando incluyas listas, no uses frases cortas: cada elemento debe ser un parrafo completo y autosuficiente de mas de 40 palabras.",
          "Cuando incluyas subitems o campos anidados dentro de objetos, cada descripcion debe explicar que es, por que importa, como se aplica y que riesgo evita.",
          "El documento total debe tener una extension amplia, con profundidad consultiva, lenguaje ejecutivo y suficiente detalle para ser usado como guia metodologica corporativa.",
          "Mantén el mismo nivel de profundidad desde el primer capitulo hasta el ultimo; no reduzcas la calidad ni la extension de las secciones finales.",
          "Antes de responder, revisa mentalmente que ningun capitulo haya quedado como frase corta, placeholder o resumen superficial. Si necesitas priorizar, reduce la cantidad de items antes que reducir la profundidad de cada item."
        ],
        detail_requirements: {
          minimum_words_per_paragraph: 40,
          minimum_words_per_item: 40,
          minimum_words_per_subitem: 40,
          expected_depth: "profesional, consultiva, extensa y accionable",
          must_include_for_each_item: [
            "descripcion detallada",
            "justificacion metodologica",
            "aplicacion practica en la organizacion",
            "implicaciones para roles, gobierno o procesos",
            "riesgos que ayuda a mitigar"
          ],
          avoid: [
            "bullets breves",
            "definiciones superficiales",
            "frases genericas",
            "contenido que parezca resumen ejecutivo cuando se requiere desarrollo metodologico"
          ]
        },
        expected_output_contract: {
          titulo: "string",
          resumen_ejecutivo: "string",
          tipo_pmo: "string",
          capitulos: [
            {
              numero: "number",
              titulo: "string",
              introduccion: "string",
              secciones: [
                {
                  titulo: "string",
                  contenido: "string",
                  items: ["string"],
                  tabla: {
                    headers: ["string"],
                    rows: [["string"]]
                  }
                }
              ]
            }
          ],
          artefactos_recomendados: ["string"],
          criterios_implementacion: ["string"],
          riesgos_adopcion: ["string"],
          metricas_seguimiento: ["string"]
        }
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
 * Núcleo del orquestador: invoca la API de Gemini y guarda el resultado en Supabase.
 * Usa fetch nativo para soportar contenido multimodal (PDF/CSV via inlineData).
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

  // ── Auto-gestión de estado: marcar 'procesando' en la BD ──────────────────
  // La Edge Function gestiona su propio estado de forma autónoma.
  // Esto garantiza que el check de cancelación posterior siempre encuentre
  // el estado correcto, sin importar el estado previo de la fila en la BD.
  // Fases 3 y 9 se auto-completan directamente y omiten este paso.
  if (phaseNumber !== 3 && phaseNumber !== 9) {
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
          datos_consolidados: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proyecto_id,numero_fase" }
      );
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
  const modelName = agentConfig.modelo || "gemini-3-flash-preview";
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
        maxOutputTokens: phaseNumber === 7 ? 32768 : undefined,
        responseMimeType: "application/json",
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
  const candidate = geminiData.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const rawContent = candidate?.content?.parts?.[0]?.text || "";

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini corto la respuesta por limite de tokens antes de completar la guia metodologica. Aumenta maxOutputTokens o divide la Fase 7 en generacion por capitulos."
    );
  }

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

    // Marcar fase como "procesando" en la UI
    await supabase
      .from("fases_estado")
      .upsert(
        {
          proyecto_id: projectId,
          numero_fase: phaseNumber,
          estado_visual: "procesando",
          datos_consolidados: null,
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
      // No usar await para no bloquear la respuesta de la fase 3
      checkAndTriggerPhase4(supabase, projectId).catch(e => console.error("Auto trigger Phase 4 error:", e));
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
