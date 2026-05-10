export type SupabaseClient = any;

export type AgentFileUrl = {
  url: string;
  type: string;
};

export type PhasePayloadResult = {
  metadata: Record<string, unknown>;
  payload: Record<string, unknown>;
  comments?: unknown;
  __fileUrls?: AgentFileUrl[];
};

export type PhasePayloadContext = {
  supabase: SupabaseClient;
  projectId: string;
  iteration: number;
  comments: unknown | null;
  externalFileUrl?: string;
  extraFileUrls?: string[];
  now: string;
  baseMetadata: Record<string, unknown>;
  ensureFreshUrl: (url: string) => Promise<string>;
  getOrganizationContext: () => Promise<unknown>;
};

export function fileTypeFromPath(path: string) {
  const ext = String(path).split("?")[0].split(".").pop()?.toLowerCase();
  return ext === "csv" ? "text/csv" : "application/pdf";
}

export function unwrapDiagnosis(value: unknown) {
  const record = value as any;
  return record?.diagnosis ? record.diagnosis : record;
}
