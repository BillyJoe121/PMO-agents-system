import { buildPhase1Payload } from "../phases/phase1.ts";
import { buildPhase2Payload } from "../phases/phase2.ts";
import { buildPhase3Payload } from "../phases/phase3.ts";
import { buildPhase4Payload } from "../phases/phase4.ts";
import { buildPhase5Payload } from "../phases/phase5.ts";
import { buildPhase6Payload } from "../phases/phase6.ts";
import { buildPhase7Payload } from "../phases/phase7.ts";
import { buildPhase9Payload } from "../phases/phase9.ts";
import type { PhasePayloadContext, PhasePayloadResult } from "../phases/types.ts";

type PayloadBuilder = (ctx: PhasePayloadContext) => Promise<PhasePayloadResult>;

const phaseBuilders: Record<number, PayloadBuilder> = {
  1: buildPhase1Payload,
  2: buildPhase2Payload,
  3: buildPhase3Payload,
  4: buildPhase4Payload,
  5: buildPhase5Payload,
  6: buildPhase6Payload,
  7: buildPhase7Payload,
  9: buildPhase9Payload,
};

export async function getPayloadForPhase(
  supabase: any,
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
      if (url.includes("documentos-pmo/")) {
        const pathMatch = url.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
        if (pathMatch) relPath = decodeURIComponent(pathMatch[1]);
      }

      if (url.startsWith("http") && !url.includes("documentos-pmo/")) return url;

      const { data, error } = await supabase.storage.from("documentos-pmo").createSignedUrl(relPath, 3600);
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

  let organizationContextCache: unknown | undefined;
  const getOrganizationContext = async () => {
    if (organizationContextCache !== undefined) return organizationContextCache;

    const { data, error } = await supabase
      .from("proyectos")
      .select("id, nombre_proyecto, tamano, mision, vision, empresas(nombre)")
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) {
      console.warn("[pmo-agent] No se pudo leer contexto organizacional:", error?.message);
      organizationContextCache = null;
      return organizationContextCache;
    }

    organizationContextCache = {
      company_name: (data.empresas as any)?.nombre ?? null,
      project_name: data.nombre_proyecto ?? null,
      size: data.tamano ?? null,
      mission: data.mision ?? null,
      vision: data.vision ?? null,
    };

    return organizationContextCache;
  };

  const builder = phaseBuilders[phaseNumber];
  if (!builder) {
    return {
      metadata: baseMetadata,
      payload: {},
      comments,
    };
  }

  return builder({
    supabase,
    projectId,
    iteration,
    comments,
    externalFileUrl,
    extraFileUrls,
    now,
    baseMetadata,
    ensureFreshUrl,
    getOrganizationContext,
  });
}
