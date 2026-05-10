import { type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

const responseRules = [
  "Devuelve exclusivamente JSON valido, sin Markdown ni texto adicional.",
  "La guia debe incluir un arreglo capitulos no vacio.",
  "Cada capitulo debe incluir titulo, introduccion y un arreglo secciones no vacio.",
  "Cada seccion debe incluir titulo y contenido; items y tabla son opcionales.",
  "El informe debe ser extenso, detallado y profesional; evita respuestas sinteticas, genericas o tipo checklist.",
  "Cada parrafo de contenido, cada item y cada subitem debe tener mas de 40 palabras, con explicacion contextual, justificacion, implicaciones practicas y recomendaciones aplicables a la PMO.",
  "Cuando incluyas listas, no uses frases cortas: cada elemento debe ser un parrafo completo y autosuficiente de mas de 40 palabras.",
  "Cuando incluyas subitems o campos anidados dentro de objetos, cada descripcion debe explicar que es, por que importa, como se aplica y que riesgo evita.",
  "El documento total debe tener una extension amplia, con profundidad consultiva, lenguaje ejecutivo y suficiente detalle para ser usado como guia metodologica corporativa.",
  "Manten el mismo nivel de profundidad desde el primer capitulo hasta el ultimo; no reduzcas la calidad ni la extension de las secciones finales.",
  "Antes de responder, revisa mentalmente que ningun capitulo haya quedado como frase corta, placeholder o resumen superficial. Si necesitas priorizar, reduce la cantidad de items antes que reducir la profundidad de cada item.",
];

const detailRequirements = {
  minimum_words_per_paragraph: 40,
  minimum_words_per_item: 40,
  minimum_words_per_subitem: 40,
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
  ],
};

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
      response_rules: responseRules,
      detail_requirements: detailRequirements,
      expected_output_contract: expectedOutputContract,
    },
    comments,
  };
}

