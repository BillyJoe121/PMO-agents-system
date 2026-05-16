export const DEFAULT_OPENAI_MODEL = "gpt-5.4";
export const DEFAULT_OPENAI_FALLBACK_MODEL = "gpt-5.4-mini";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
export const DEFAULT_ANTHROPIC_FALLBACK_MODEL = "claude-haiku-4-5";

// Gemini remains intentionally unused. These defaults are kept as legacy data/code
// so the provider can be reconnected later without a DB reshape.
export const DEFAULT_HIGH_MODEL = "gemini-3.1-pro-preview";
export const DEFAULT_LOW_MODEL = "gemini-flash-lite-latest";
export const DEFAULT_AI_MODEL_MODE = "openai";

export type AiProvider = "openai" | "anthropic" | "gemini";

export interface AiModelSettings {
  provider: "openai" | "anthropic";
  selected_model: string;
  openai_model: string;
  anthropic_model: string;
  high_model: string;
  low_model: string;
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

const OPENAI_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]);
const ANTHROPIC_MODELS = new Set(["claude-sonnet-4-6", "claude-haiku-4-5"]);

function inferProviderFromModel(model: unknown): "openai" | "anthropic" | null {
  const value = String(model ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("claude-")) return "anthropic";
  if (value.startsWith("gpt-") || value.startsWith("o")) return "openai";
  return null;
}

function normalizeProvider(value: unknown, selectedModel?: unknown): "openai" | "anthropic" {
  const provider = String(value ?? "").trim().toLowerCase();
  if (provider === "anthropic" || provider === "claude") return "anthropic";
  if (provider === "openai" || provider === "chatgpt" || provider === "gpt") return "openai";
  return inferProviderFromModel(selectedModel) ?? "openai";
}

function normalizeSelectedModel(provider: "openai" | "anthropic", value: unknown) {
  const model = String(value ?? "").trim();
  if (provider === "openai") {
    return OPENAI_MODELS.has(model) ? model : DEFAULT_OPENAI_MODEL;
  }
  return ANTHROPIC_MODELS.has(model) ? model : DEFAULT_ANTHROPIC_MODEL;
}

export function normalizeAiModelSettings(row?: Partial<AiModelSettings> & Record<string, unknown> | null): AiModelSettings {
  const legacyMode = String(row?.mode ?? "").trim().toLowerCase();
  const legacyModel = legacyMode === "low" ? DEFAULT_OPENAI_FALLBACK_MODEL : DEFAULT_OPENAI_MODEL;
  const rawSelectedModel = row?.selected_model ?? row?.openai_model ?? legacyModel;
  const provider = normalizeProvider(row?.provider, rawSelectedModel);
  const selected_model = normalizeSelectedModel(provider, rawSelectedModel);

  return {
    provider,
    selected_model,
    openai_model: normalizeSelectedModel("openai", row?.openai_model ?? (provider === "openai" ? selected_model : DEFAULT_OPENAI_MODEL)),
    anthropic_model: normalizeSelectedModel("anthropic", row?.anthropic_model ?? (provider === "anthropic" ? selected_model : DEFAULT_ANTHROPIC_MODEL)),
    high_model: String(row?.high_model ?? DEFAULT_HIGH_MODEL),
    low_model: String(row?.low_model ?? DEFAULT_LOW_MODEL),
  };
}

export async function getAiModelSettings(supabase: any): Promise<AiModelSettings> {
  const { data, error } = await supabase
    .from("ai_model_settings")
    .select("provider, selected_model, openai_model, anthropic_model, high_model, low_model")
    .eq("id", "global")
    .maybeSingle();

  if (!error) return normalizeAiModelSettings(data as any);

  console.warn("[pmo-agent] No se pudo leer ai_model_settings moderno; intentando esquema legacy.", error.message);
  const fallback = await supabase
    .from("ai_model_settings")
    .select("mode, high_model, low_model")
    .eq("id", "global")
    .maybeSingle();

  if (fallback.error) {
    console.warn("[pmo-agent] No se pudo leer ai_model_settings; usando defaults.", fallback.error.message);
    return normalizeAiModelSettings(null);
  }

  return normalizeAiModelSettings(fallback.data as any);
}

function getPreferredCandidate(preferredModel?: unknown): AiModelCandidate | null {
  const model = String(preferredModel ?? "").trim();
  if (!model) return null;

  const provider = inferProviderFromModel(model);
  if (!provider) return null;

  const normalizedModel = normalizeSelectedModel(provider, model);
  if (normalizedModel !== model) return null;

  return { provider, model: normalizedModel };
}

export function getModelCandidates(settings: AiModelSettings, preferredModel?: unknown) {
  const preferred = getPreferredCandidate(preferredModel);
  const primary: AiModelCandidate = preferred ?? {
    provider: settings.provider,
    model: settings.selected_model,
  };

  const fallbackCandidates: AiModelCandidate[] = primary.provider === "openai"
    ? [
        // Fallback OpenAI -> Anthropic desactivado temporalmente para evitar consumo
        // de creditos de Claude cuando GPT falle, tarde demasiado o agote timeout.
        // Para reactivarlo, descomentar la siguiente linea:
        // { provider: "anthropic", model: DEFAULT_ANTHROPIC_FALLBACK_MODEL },
      ]
    : [
        { provider: "openai", model: DEFAULT_OPENAI_FALLBACK_MODEL },
      ];

  const seen = new Set<string>();
  const configuredPrimary: AiModelCandidate = {
    provider: settings.provider,
    model: settings.selected_model,
  };

  return [primary, configuredPrimary, ...fallbackCandidates].filter((candidate) => {
    const key = `${candidate.provider}:${candidate.model}`;
    if (!candidate.model || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shouldTryNextModel(status: number | undefined, isLastModel: boolean) {
  if (isLastModel) return false;
  return status === undefined || [400, 404, 408, 409, 429, 500, 502, 503, 504].includes(status);
}

function getProviderTimeoutMs(body: Record<string, unknown>) {
  const generationConfig = (body as any).generationConfig ?? {};
  return Number.isFinite(Number(generationConfig.providerTimeoutMs))
    ? Number(generationConfig.providerTimeoutMs)
    : 110000;
}

function wantsJsonResponse(body: Record<string, unknown>) {
  const generationConfig = (body as any).generationConfig ?? {};
  return String(generationConfig.responseMimeType ?? "").toLowerCase() === "application/json";
}

function getCaughtErrorMessage(error: unknown, attemptId: string, timeoutMs: number) {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `Timeout llamando a ${attemptId} despues de ${Math.round(timeoutMs / 1000)} segundos. Se intento pasar al fallback configurado antes de que venciera la Edge Function.`;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `Timeout llamando a ${attemptId} despues de ${Math.round(timeoutMs / 1000)} segundos. Se intento pasar al fallback configurado antes de que venciera la Edge Function.`;
  }
  return error instanceof Error ? error.message : "Error desconocido llamando al modelo";
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

async function readResponseData(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw_text: text };
  }
}

function getParts(body: Record<string, unknown>) {
  const contents = Array.isArray((body as any).contents) ? (body as any).contents : [];
  return contents.flatMap((content: any) => Array.isArray(content?.parts) ? content.parts : []);
}

function normalizeOpenAiResponse(data: any) {
  const outputText =
    data?.output_text ??
    data?.output?.flatMap((item: any) => item?.content ?? [])
      ?.map((content: any) => content?.text ?? "")
      ?.filter(Boolean)
      ?.join("\n") ??
    "";

  const finishReason = data?.status === "incomplete"
    ? data?.incomplete_details?.reason ?? "incomplete"
    : data?.status;

  return {
    candidates: [
      {
        finishReason: finishReason === "max_output_tokens" ? "MAX_TOKENS" : finishReason,
        content: { parts: [{ text: outputText }] },
      },
    ],
    raw: data,
  };
}

function normalizeAnthropicResponse(data: any) {
  const text = (data?.content ?? [])
    .map((part: any) => part?.type === "text" ? part.text : "")
    .filter(Boolean)
    .join("\n");

  return {
    candidates: [
      {
        finishReason: data?.stop_reason === "max_tokens" ? "MAX_TOKENS" : data?.stop_reason,
        content: { parts: [{ text }] },
      },
    ],
    raw: data,
  };
}

function buildOpenAiContent(parts: any[]) {
  return parts.map((part, index) => {
    if (part?.text) return { type: "input_text", text: String(part.text) };
    const inline = part?.inlineData;
    if (inline?.data && inline?.mimeType) {
      if (String(inline.mimeType).startsWith("image/")) {
        return {
          type: "input_image",
          image_url: inline.sourceUrl || `data:${inline.mimeType};base64,${inline.data}`,
        };
      }
      if (inline.sourceUrl) {
        return {
          type: "input_file",
          file_url: inline.sourceUrl,
        };
      }
      return {
        type: "input_file",
        filename: `pmo-agent-file-${index + 1}.${getMimeExtension(inline.mimeType)}`,
        file_data: inline.data,
      };
    }
    return null;
  }).filter(Boolean);
}

function buildAnthropicContent(parts: any[]) {
  return parts.map((part) => {
    if (part?.text) return { type: "text", text: String(part.text) };
    const inline = part?.inlineData;
    if (inline?.data && inline?.mimeType) {
      if (String(inline.mimeType).startsWith("image/")) {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: inline.mimeType,
            data: inline.data,
          },
        };
      }
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: inline.mimeType,
          data: inline.data,
        },
      };
    }
    return null;
  }).filter(Boolean);
}

async function callOpenAi(apiKey: string, model: string, body: Record<string, unknown>) {
  const generationConfig = (body as any).generationConfig ?? {};
  const timeoutMs = getProviderTimeoutMs(body);
  const payload: any = {
    model,
    input: [
      {
        role: "user",
        content: buildOpenAiContent(getParts(body)),
      },
    ],
  };

  if (Number.isFinite(Number(generationConfig.maxOutputTokens))) {
    payload.max_output_tokens = Number(generationConfig.maxOutputTokens);
  }

  if (wantsJsonResponse(body)) {
    payload.text = {
      format: { type: "json_object" },
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await readResponseData(response);
  return { response, data: normalizeOpenAiResponse(data), rawData: data };
}

async function callAnthropic(apiKey: string, model: string, body: Record<string, unknown>) {
  const generationConfig = (body as any).generationConfig ?? {};
  const timeoutMs = getProviderTimeoutMs(body);
  const requestedMaxTokens = Number.isFinite(Number(generationConfig.maxOutputTokens))
    ? Number(generationConfig.maxOutputTokens)
    : 32768;
  const providerMaxTokens = 64000;
  const maxTokens = Math.min(requestedMaxTokens, providerMaxTokens);

  const payload: any = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: buildAnthropicContent(getParts(body)),
      },
    ],
  };

  if (Number.isFinite(Number(generationConfig.temperature))) {
    payload.temperature = Number(generationConfig.temperature);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await readResponseData(response);
  return { response, data: normalizeAnthropicResponse(data), rawData: data };
}

// Legacy Gemini connector intentionally kept dormant.
async function callGemini(apiKey: string, model: string, body: Record<string, unknown>) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readResponseData(response);
  return { response, data };
}

function getProviderErrorMessage(provider: AiProvider, data: any, rawData?: any) {
  if (provider === "openai") {
    return rawData?.error?.message || rawData?.error?.type || rawData?.raw_text || JSON.stringify(rawData ?? data);
  }
  if (provider === "anthropic") {
    return rawData?.error?.message || rawData?.error?.type || rawData?.raw_text || JSON.stringify(rawData ?? data);
  }
  return data?.error?.message || data?.error?.status || JSON.stringify(data);
}

export async function callAiWithFallback(
  apiKeys: { openai: string; anthropic: string; gemini?: string },
  candidates: AiModelCandidate[],
  body: Record<string, unknown>
): Promise<AiGenerateResult> {
  const errors: AiAttemptError[] = [];
  const attemptedModels: string[] = [];
  const providerTimeoutMs = getProviderTimeoutMs(body);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const attemptId = `${candidate.provider}:${candidate.model}`;
    attemptedModels.push(attemptId);

    try {
      const apiKey =
        candidate.provider === "openai" ? apiKeys.openai :
        candidate.provider === "anthropic" ? apiKeys.anthropic :
        apiKeys.gemini ?? "";
      if (!apiKey) throw new Error(`Falta API key para ${candidate.provider}`);

      console.log(`[aiModels] Intentando modelo ${attemptId}`);
      const result = candidate.provider === "openai"
        ? await callOpenAi(apiKey, candidate.model, body)
        : candidate.provider === "anthropic"
          ? await callAnthropic(apiKey, candidate.model, body)
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

      const message = getProviderErrorMessage(candidate.provider, data, (result as any).rawData);
      errors.push({ provider: candidate.provider, model: candidate.model, status: response.status, message });
      console.warn(`[aiModels] Modelo ${attemptId} fallo con status ${response.status}: ${String(message).slice(0, 240)}`);

      if (!shouldTryNextModel(response.status, index === candidates.length - 1)) {
        throw new Error(`Error de ${candidate.provider} API (${candidate.model}, ${response.status}): ${message}`);
      }
    } catch (error) {
      const message = getCaughtErrorMessage(error, attemptId, providerTimeoutMs);
      const alreadyLogged = errors.some((entry) => entry.provider === candidate.provider && entry.model === candidate.model && entry.message === message);
      if (!alreadyLogged) errors.push({ provider: candidate.provider, model: candidate.model, message });
      console.warn(`[aiModels] Modelo ${attemptId} fallo antes de completar la llamada: ${String(message).slice(0, 240)}`);

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
      model_provider_configured: settings.provider,
      model_selected: settings.selected_model,
      model_openai_fallback: DEFAULT_OPENAI_FALLBACK_MODEL,
      model_anthropic_fallback: DEFAULT_ANTHROPIC_FALLBACK_MODEL,
      model_provider: modelResult.provider,
      model_used: modelResult.model,
      model_fallback_used: modelResult.fallbackUsed,
      attempted_models: modelResult.attemptedModels,
      model_errors: modelResult.errors,
      legacy_gemini_high: settings.high_model,
      legacy_gemini_low: settings.low_model,
    },
  };
}
