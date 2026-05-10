import { fileTypeFromPath, type PhasePayloadContext, type PhasePayloadResult } from "./types.ts";

const PHASE1_CATEGORY_LABELS: Record<string, string> = {
  D01: "Organigrama",
  D02: "Artefactos de Gestion de proyectos",
  D03: "Plataformas y Sistemas",
  D04: "Listado de Proyectos",
  D05: "Proyecto mejor documentado",
  D06: "Resultados Estrategicos",
  D07: "Mapa de Procesos",
  D08: "Arquitectura Organizacional/TI",
  D09: "Metodologia de Proyectos",
  D10: "Portafolio de Productos/Servicios",
  D11: "Otros",
};

export function getPhase1CategoryLabel(categoryCode: string) {
  return PHASE1_CATEGORY_LABELS[categoryCode] ?? "Otro";
}

export function isPredefinedPhase1Category(categoryCode: string) {
  return /^D\d+$/.test(categoryCode) && categoryCode !== "D11";
}

export async function buildPhase1Payload(ctx: PhasePayloadContext): Promise<PhasePayloadResult> {
  const { supabase, projectId, comments, baseMetadata, ensureFreshUrl, getOrganizationContext } = ctx;
  const { data: docs, error } = await supabase
    .from("documentos")
    .select("id, storage_path, categoria, nombre_personalizado, metadatos, created_at")
    .eq("proyecto_id", projectId);

  if (error) throw new Error(`Error leyendo documentos: ${error.message}`);

  const fileUrls: { url: string; type: string }[] = [];
  const documents = await Promise.all((docs ?? []).map(async (d: Record<string, unknown>, idx: number) => {
    const rawStoragePath = String(d.storage_path ?? "");
    const ext = rawStoragePath.split("?")[0].split(".").pop()?.toLowerCase() ?? "pdf";

    if (rawStoragePath) {
      const urlToUse = await ensureFreshUrl(rawStoragePath);
      fileUrls.push({ url: urlToUse, type: fileTypeFromPath(rawStoragePath) });
    }

    const categoryCode = String(d.categoria ?? "D11");
    const isPredefined = isPredefinedPhase1Category(categoryCode);

    return {
      document_id: `doc-${String(idx + 1).padStart(3, "0")}`,
      document_name: d.nombre_personalizado ?? d.storage_path,
      document_type: isPredefined ? "predefined" : "custom",
      category: categoryCode,
      category_label: getPhase1CategoryLabel(categoryCode),
      file_format: ext,
      file_size_kb: (d.metadatos as Record<string, number>)?.size_kb ?? 0,
      uploaded_at: d.created_at,
    };
  }));

  return {
    metadata: { ...baseMetadata, agent_id: "agente-3" },
    payload: {
      organization_context: await getOrganizationContext(),
      documents,
      total_documents: documents.length,
    },
    comments,
    __fileUrls: fileUrls,
  };
}
