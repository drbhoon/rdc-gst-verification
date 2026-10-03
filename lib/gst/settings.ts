export interface GstApiSettings {
  providerMode: "sandbox" | "mock";
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  apiVersion: string;
  ocrEngine: "auto" | "ocr-space" | "tesseract";
  ocrApiKey: string;
}

// In-memory runtime settings override
let runtimeSettings: Partial<GstApiSettings> = {};

export function getGstApiSettings(): GstApiSettings {
  const envMode = process.env.GST_PROVIDER_MODE?.toLowerCase();
  const providerMode: "sandbox" | "mock" =
    runtimeSettings.providerMode ?? (envMode === "mock" ? "mock" : "sandbox");

  const apiKey =
    runtimeSettings.apiKey ??
    process.env.GST_SANDBOX_API_KEY?.trim() ??
    process.env.SANDBOX_KEY?.trim() ??
    process.env.SANDBOX_API_KEY?.trim() ??
    process.env.SANDBOX_CO_IN_KEY?.trim() ??
    "";

  const apiSecret =
    runtimeSettings.apiSecret ??
    process.env.GST_SANDBOX_API_SECRET?.trim() ??
    process.env.SANDBOX_SECRET?.trim() ??
    process.env.SANDBOX_API_SECRET?.trim() ??
    process.env.SANDBOX_CO_IN_SECRET?.trim() ??
    "";

  const baseUrl =
    runtimeSettings.baseUrl ??
    process.env.GST_SANDBOX_BASE_URL?.trim() ??
    process.env.SANDBOX_BASE_URL?.trim() ??
    "https://api.sandbox.co.in";

  const apiVersion =
    runtimeSettings.apiVersion ??
    process.env.GST_SANDBOX_API_VERSION?.trim() ??
    process.env.SANDBOX_API_VERSION?.trim() ??
    "1.0.0";

  const ocrEngine =
    runtimeSettings.ocrEngine ??
    ((process.env.OCR_ENGINE as "auto" | "ocr-space" | "tesseract") || "auto");

  const ocrApiKey =
    runtimeSettings.ocrApiKey ??
    process.env.OCR_SPACE_API_KEY?.trim() ??
    process.env.OCR_API_KEY?.trim() ??
    "";

  return {
    providerMode,
    apiKey,
    apiSecret,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiVersion,
    ocrEngine,
    ocrApiKey,
  };
}

export function updateGstApiSettings(updates: Partial<GstApiSettings>): GstApiSettings {
  runtimeSettings = {
    ...runtimeSettings,
    ...updates,
  };
  return getGstApiSettings();
}

export function maskSecret(secret?: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`;
}
