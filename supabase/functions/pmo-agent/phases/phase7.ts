import { type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

function normalizeConsultantComments(comments: unknown): string | null {
  if (typeof comments === "string" && comments.trim()) return comments.trim();
  if (comments && typeof comments === "object") {
    const record = comments as Record<string, unknown>;
    const value = record.comentario_consultor ?? record.comments ?? record.comment;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function unwrapPhaseOutput(value: unknown) {
  const record = value as any;
  return record?._current ?? record?.diagnosis ?? record?.data?.diagnosis ?? record?.data ?? value;
}

const phase71BusinessRules = {
  introduccion: {},
  objetivo: {},
  alcance: {},
  responsables_guia: {},
  marco_conceptual: {},
  marco_de_referencia: {},
  politicas: {},
  roles_y_responsabilidades: {},
  comites: {},
};

const phase7ReferenceGuideUrls = {
  agile_practice_guide: "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/AgilePG_A72.md",
  pmbok_8: "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/PMBOK8_A72.md",
  scrum_guide: "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/ScrumGuide_A72.md",
};

async function fetchReferenceGuide(name: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la guia de referencia ${name}: HTTP ${response.status}`);
  }

  const markdown = (await response.text()).replace(/\r\n/g, "\n").trim();
  return {
    name,
    url,
    format: "markdown",
    characters: markdown.length,
    content: markdown,
  };
}

async function loadPhase7ReferenceGuides() {
  const entries = await Promise.all(
    Object.entries(phase7ReferenceGuideUrls).map(([name, url]) => fetchReferenceGuide(name, url))
  );

  return Object.fromEntries(entries.map((entry) => [entry.name, entry]));
}

export async function buildPhase7Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata } = ctx;
  const consultantComments = normalizeConsultantComments(comments);

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
    faseMap[f.numero_fase] = unwrapPhaseOutput(f.datos_consolidados);
  }

  const referenceGuides = await loadPhase7ReferenceGuides();

  return {
    metadata: { ...baseMetadata, agent_id: "asistente-fundamentos-guia" },
    payload: {
      project_context: {
        project_id: projectId,
        project_name: proyecto?.nombre_proyecto ?? null,
        company_name: (proyecto?.empresas as any)?.nombre ?? null,
        start_date: proyecto?.fecha_inicio ?? null,
      },
      approved_phase4_diagnosis: faseMap[4] ?? null,
      approved_phase5_diagnosis: faseMap[5] ?? null,
      approved_phase6_diagnosis: faseMap[6] ?? null,
      reference_guides: referenceGuides,
      business_rules: phase71BusinessRules,
      comments: consultantComments,
    },
    comments: consultantComments,
  };
}
