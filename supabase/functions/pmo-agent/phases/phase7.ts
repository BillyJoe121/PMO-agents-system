import { type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

const responseRules = [
  "Devuelve exclusivamente JSON valido, sin Markdown ni texto adicional.",
  "La guia debe tener una extension equivalente a minimo 20 paginas A4 en el visor de la plataforma. Para lograrlo, genera al menos 10 capitulos sustantivos y desarrolla cada capitulo con varias secciones completas.",
  "Cada capitulo debe incluir titulo, una introduccion de minimo 120 palabras y un arreglo secciones con minimo 3 secciones.",
  "Cada seccion debe incluir titulo, contenido con minimo 2 parrafos desarrollados, items accionables y una tabla cuando el tema permita estructurar roles, decisiones, riesgos, controles, metricas, artefactos, actividades o criterios.",
  "Cada parrafo, item y subitem debe tener mas de 70 palabras, con explicacion contextual, justificacion metodologica, aplicacion practica en la organizacion, decisiones que habilita y riesgos que ayuda a mitigar.",
  "Cada tabla debe incluir encabezados utiles y minimo 4 filas con datos concretos. Evita tablas vacias, genericas o sin valores accionables.",
  "El informe debe ser extenso, detallado y profesional; evita respuestas sinteticas, genericas, tipo checklist o con bullets de una sola linea.",
  "Cuando incluyas listas, no uses frases cortas: cada elemento debe ser un parrafo completo y autosuficiente de mas de 70 palabras.",
  "Cuando incluyas subitems o campos anidados dentro de objetos, cada descripcion debe explicar que es, por que importa, como se aplica y que riesgo evita.",
  "Manten el mismo nivel de profundidad desde el primer capitulo hasta el ultimo; no reduzcas la calidad ni la extension de las secciones finales.",
  "Antes de responder, revisa mentalmente que el documento alcance minimo 20 paginas equivalentes, que ningun capitulo haya quedado superficial y que todas las secciones tengan desarrollo narrativo y datos de soporte.",
];

const detailRequirements = {
  minimum_equivalent_pages: 20,
  minimum_chapters: 10,
  minimum_sections_per_chapter: 3,
  minimum_paragraphs_per_section: 2,
  minimum_words_per_paragraph: 70,
  minimum_words_per_item: 70,
  minimum_words_per_subitem: 70,
  minimum_table_rows: 4,
  expected_depth: "profesional, consultiva, extensa y accionable",
  must_include_for_each_item: [
    "descripcion detallada",
    "justificacion metodologica",
    "aplicacion practica en la organizacion",
    "implicaciones para roles, gobierno o procesos",
    "riesgos que ayuda a mitigar",
  ],
  avoid: [
    "bullets breves",
    "definiciones superficiales",
    "frases genericas",
    "contenido que parezca resumen ejecutivo cuando se requiere desarrollo metodologico",
    "tablas sin datos concretos",
    "capitulos con menos de tres secciones",
  ],
};

function normalizeConsultantComments(comments: unknown): string | null {
  if (typeof comments === "string" && comments.trim()) return comments.trim();
  if (comments && typeof comments === "object") {
    const record = comments as Record<string, unknown>;
    const value = record.comentario_consultor ?? record.comments ?? record.comment;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractCurrentGuideForRevision(comments: unknown): unknown | null {
  if (!comments || typeof comments !== "object") return null;
  const record = comments as Record<string, unknown>;
  const guide = record.current_guide_for_revision ?? record.previous_guide ?? record.current_guide ?? null;
  const guideRecord = guide as any;
  return guideRecord?._current ?? guideRecord?.diagnosis ?? guide;
}

const expectedOutputContract = {
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
            rows: [["string"]],
          },
        },
      ],
    },
  ],
  artefactos_recomendados: ["string"],
  criterios_implementacion: ["string"],
  riesgos_adopcion: ["string"],
  metricas_seguimiento: ["string"],
};

export async function buildPhase7Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata } = ctx;
  const consultantComments = normalizeConsultantComments(comments);
  const currentGuideForRevision = extractCurrentGuideForRevision(comments);
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
      mandatory_consultant_instructions: consultantComments
        ? {
            priority: "highest",
            instruction: "Debes aplicar estos comentarios del consultor como requerimientos obligatorios de reprocesamiento. No los resumas ni los ignores. Reestructura, amplía o corrige la guia para satisfacerlos de forma visible en el documento final.",
            comments: consultantComments,
            compliance_rule: "Si un comentario pide agregar, ampliar, quitar, ajustar tono, cambiar enfoque o incluir detalle, el resultado final debe evidenciar ese cambio en los capitulos y secciones correspondientes.",
          }
        : null,
      current_guide_for_revision: consultantComments ? currentGuideForRevision : null,
      response_rules: responseRules,
      detail_requirements: detailRequirements,
      expected_output_contract: expectedOutputContract,
    },
    comments: consultantComments,
  };
}
