export const DEFAULT_HIGH_MODEL = "gemini-3.1-pro-preview";
export const DEFAULT_LOW_MODEL = "gemini-flash-lite-latest";
export const DEFAULT_KIMI_MODEL = "kimi-k2.6";
export const DEFAULT_AI_MODEL_MODE = "high_with_fallback";

export type AiModelMode = "low" | "high_with_fallback" | "kimi";
export type AiProvider = "gemini" | "kimi";

export interface AiModelSettings {
  mode: AiModelMode;
  high_model: string;
  low_model: string;
  kimi_model: string;
}

export interface AiModelCandidate {
  provider: AiProvider;
  model: string;
}

export interface AiAttemptError {
  provider: AiProvider;
  model: string;
  message: string;
  status?: number;
}

export interface AiGenerateResult {
  data: any;
  provider: AiProvider;
  model: string;
  attemptedModels: string[];
  errors: AiAttemptError[];
  fallbackUsed: boolean;
}

function normalizeAiModelMode(value: unknown): AiModelMode {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode === "low" || mode === "kimi") return mode;
  return DEFAULT_AI_MODEL_MODE;
}

export function normalizeAiModelSettings(row?: Partial<AiModelSettings> | null): AiModelSettings {
  return {
    mode: normalizeAiModelMode(row?.mode),
    high_model: row?.high_model || DEFAULT_HIGH_MODEL,
    low_model: row?.low_model || DEFAULT_LOW_MODEL,
    kimi_model: row?.kimi_model || DEFAULT_KIMI_MODEL,
  };
}

export async function getAiModelSettings(supabase: any): Promise<AiModelSettings> {
  const { data, error } = await supabase
    .from("ai_model_settings")
    .select("mode, high_model, low_model, kimi_model")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    console.warn("[pmo-agent] No se pudo leer ai_model_settings con kimi_model; intentando esquema legacy.", error.message);
    const fallback = await supabase
      .from("ai_model_settings")
      .select("mode, high_model, low_model")
      .eq("id", "global")
      .maybeSingle();

    if (fallback.error) {
      console.warn("[pmo-agent] No se pudo leer ai_model_settings; usando defaults.", fallback.error.message);
      return normalizeAiModelSettings(null);
    }

    return normalizeAiModelSettings(fallback.data as Partial<AiModelSettings> | null);
  }

  return normalizeAiModelSettings(data as Partial<AiModelSettings> | null);
}

export function getModelCandidates(settings: AiModelSettings) {
  const candidates: AiModelCandidate[] = settings.mode === "kimi"
    ? [{ provider: "kimi", model: settings.kimi_model }]
    : settings.mode === "low"
      ? [
          { provider: "gemini", model: settings.low_model },
          { provider: "kimi", model: settings.kimi_model },
        ]
      : [
          { provider: "gemini", model: settings.high_model },
          { provider: "gemini", model: settings.low_model },
          { provider: "kimi", model: settings.kimi_model },
        ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.provider}:${candidate.model}`;
    if (!candidate.model || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shouldTryNextModel(status: number | undefined, isLastModel: boolean) {
  if (isLastModel) return false;
  return status === undefined || [400, 404, 429, 500, 502, 503, 504].includes(status);
}

export function getGeminiErrorMessage(data: any) {
  return data?.error?.message || data?.error?.status || JSON.stringify(data);
}

function normalizeOpenAiChatResponse(data: any) {
  const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
  return {
    candidates: [
      {
        finishReason: data?.choices?.[0]?.finish_reason === "length" ? "MAX_TOKENS" : data?.choices?.[0]?.finish_reason,
        content: {
          parts: [{ text }],
        },
      },
    ],
    raw: data,
  };
}

function getMimeExtension(mimeType: string) {
  const extensionMap: Record<string, string> = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "text/plain": "txt",
    "application/json": "json",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  return extensionMap[mimeType] || "bin";
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function readResponseData(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw_text: text };
  }
}

async function uploadKimiFileForExtraction(
  apiKey: string,
  part: { inlineData: { mimeType: string; data: string } },
  index: number
): Promise<string> {
  const mimeType = part.inlineData.mimeType;
  const formData = new FormData();
  const fileName = `pmo-agent-file-${index}.${getMimeExtension(mimeType)}`;
  formData.append("purpose", "file-extract");
  formData.append("file", base64ToBlob(part.inlineData.data, mimeType), fileName);

  const uploadResponse = await fetch("https://api.moonshot.ai/v1/files", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
    },
    body: formData,
    signal: AbortSignal.timeout(30000), // 30s timeout para subida
  });
  const uploadData = await readResponseData(uploadResponse);

  if (!uploadResponse.ok) {
    const message = uploadData?.error?.message || uploadData?.error?.type || uploadData?.raw_text || JSON.stringify(uploadData);
    
    // Si el error es "no hay texto extraíble" (PDF escaneado o imagen), lo saltamos sin lanzar
    const isExtractionEmpty = typeof message === "string" && (
      message.includes("没有解析出内容") ||
      message.includes("text extract error") ||
      message.includes("no content")
    );
    if (isExtractionEmpty) {
      console.warn(`[uploadKimiFileForExtraction] Archivo ${fileName} sin texto extraíble (PDF escaneado/imagen). Se omite del contexto.`);
      return `[Archivo ${fileName}: no se pudo extraer texto — posiblemente es un PDF escaneado o imagen sin OCR]`;
    }

    throw new Error(`Error subiendo archivo a Kimi (${uploadResponse.status}): ${message}`);
  }

  const contentResponse = await fetch(`https://api.moonshot.ai/v1/files/${uploadData.id}/content`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
    },
    signal: AbortSignal.timeout(30000), // 30s timeout para extracción
  });
  const fileContent = await contentResponse.text();

  if (!contentResponse.ok) {
    // También toleramos errores de extracción de contenido sin tumbar el proceso
    console.warn(`[uploadKimiFileForExtraction] No se pudo leer contenido del archivo ${fileName} (${contentResponse.status}). Se omite.`);
    return `[Archivo ${fileName}: contenido no disponible (${contentResponse.status})]`;
  }

  return fileContent;
}

async function bodyToKimiMessages(apiKey: string, body: Record<string, unknown>) {
  const contents = Array.isArray((body as any).contents) ? (body as any).contents : [];
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  const userTexts: string[] = [];
  let fileIndex = 0;

  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (part?.text) {
        userTexts.push(String(part.text));
      } else if (part?.inlineData?.data && part?.inlineData?.mimeType) {
        fileIndex += 1;
        const fileContent = await uploadKimiFileForExtraction(apiKey, part, fileIndex);
        messages.push({
          role: "system",
          content: `Contenido extraido del archivo adjunto ${fileIndex} (${part.inlineData.mimeType}):\n\n${fileContent}`,
        });
      }
    }
  }

  messages.push({
    role: "user",
    content: userTexts.filter(Boolean).join("\n\n") || "Devuelve exclusivamente JSON valido.",
  });

  return messages;
}

async function callGemini(
  apiKey: string,
  model: string,
  body: Record<string, unknown>
) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

async function callKimi(
  apiKey: string,
  model: string,
  body: Record<string, unknown>
) {
  const generationConfig = (body as any).generationConfig ?? {};
  const maxCompletionTokens = Number.isFinite(Number(generationConfig.maxOutputTokens))
    ? Number(generationConfig.maxOutputTokens)
    : 32768;

  const payload: any = {
    model,
    messages: await bodyToKimiMessages(apiKey, body),
    max_completion_tokens: maxCompletionTokens,
    stream: false,
  };

  const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90000), // 90s timeout para chat completion
  });
  const data = await readResponseData(response);

  if (!response.ok) {
    const errMsg = data?.error?.message || data?.error?.type || data?.raw_text || JSON.stringify(data);
    console.error(`[callKimi] Error ${response.status} de Kimi (${model}): ${errMsg}`);
    console.error(`[callKimi] Payload enviado (sin archivos): model=${model}, max_tokens=${maxCompletionTokens}, messages_count=${payload.messages?.length}`);
  }

  return { response, data: normalizeOpenAiChatResponse(data), rawData: data };
}

export async function callAiWithFallback(
  apiKeys: { gemini: string; kimi: string },
  candidates: AiModelCandidate[],
  body: Record<string, unknown>
): Promise<AiGenerateResult> {
  const errors: AiAttemptError[] = [];
  const attemptedModels: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const attemptId = `${candidate.provider}:${candidate.model}`;
    attemptedModels.push(attemptId);

    try {
      const apiKey = candidate.provider === "kimi" ? apiKeys.kimi : apiKeys.gemini;
      if (!apiKey) throw new Error(`Falta API key para ${candidate.provider}`);

      const result = candidate.provider === "kimi"
        ? await callKimi(apiKey, candidate.model, body)
        : await callGemini(apiKey, candidate.model, body);
      const { response, data } = result;

      if (response.ok) {
        return {
          data,
          provider: candidate.provider,
          model: candidate.model,
          attemptedModels,
          errors,
          fallbackUsed: index > 0,
        };
      }

      const message = candidate.provider === "kimi"
        ? data?.raw?.error?.message || data?.raw?.error?.type || data?.raw?.raw_text || JSON.stringify((result as any).rawData ?? data)
        : getGeminiErrorMessage(data);
      errors.push({ provider: candidate.provider, model: candidate.model, status: response.status, message });

      if (!shouldTryNextModel(response.status, index === candidates.length - 1)) {
        throw new Error(`Error de ${candidate.provider} API (${candidate.model}, ${response.status}): ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido llamando al modelo";
      const alreadyLogged = errors.some((entry) => entry.provider === candidate.provider && entry.model === candidate.model && entry.message === message);
      if (!alreadyLogged) errors.push({ provider: candidate.provider, model: candidate.model, message });

      const latestStatus = [...errors].reverse().find((entry) => entry.provider === candidate.provider && entry.model === candidate.model)?.status;
      if (latestStatus !== undefined && !shouldTryNextModel(latestStatus, index === candidates.length - 1)) {
        throw error;
      }

      if (index === candidates.length - 1) {
        throw new Error(
          `Fallaron todos los modelos configurados (${attemptedModels.join(", ")}). Ultimo error: ${message}`
        );
      }
    }
  }

  throw new Error("No hay modelos configurados.");
}

export function attachModelMetadata(
  value: unknown,
  modelResult: AiGenerateResult,
  settings: AiModelSettings
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const metadata = (record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata))
    ? record.metadata as Record<string, unknown>
    : {};

  return {
    ...record,
    metadata: {
      ...metadata,
      model_mode: settings.mode,
      model_high: settings.high_model,
      model_low: settings.low_model,
      model_kimi: settings.kimi_model,
      model_provider: modelResult.provider,
      model_used: modelResult.model,
      model_fallback_used: modelResult.fallbackUsed,
      attempted_models: modelResult.attemptedModels,
      model_errors: modelResult.errors,
    },
  };
}
