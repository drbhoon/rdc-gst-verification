import { getGstApiSettings, maskSecret, updateGstApiSettings } from "@/lib/gst/settings";

export async function GET() {
  const settings = getGstApiSettings();
  const isConfigured = Boolean(settings.apiKey && settings.apiSecret);

  return Response.json({
    isConfigured,
    providerMode: settings.providerMode,
    apiKeyPreview: settings.apiKey ? maskSecret(settings.apiKey) : "",
    hasApiSecret: Boolean(settings.apiSecret),
    baseUrl: settings.baseUrl,
    apiVersion: settings.apiVersion,
    ocrEngine: settings.ocrEngine,
    ocrApiKeyPreview: settings.ocrApiKey ? maskSecret(settings.ocrApiKey) : "",
    hasOcrApiKey: Boolean(settings.ocrApiKey),
  });
}

export async function POST(request: Request) {
  let body: {
    action?: "test" | "save" | "test-ocr";
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
    providerMode?: "sandbox" | "mock";
    ocrEngine?: "auto" | "ocr-space" | "tesseract";
    ocrApiKey?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentSettings = getGstApiSettings();
  const apiKeyToTest = body.apiKey?.trim() || currentSettings.apiKey;
  const apiSecretToTest = body.apiSecret?.trim() || currentSettings.apiSecret;
  const baseUrlToTest = (body.baseUrl?.trim() || currentSettings.baseUrl).replace(/\/+$/, "");
  const apiVersionToTest = currentSettings.apiVersion;

  // 1. Connection Test Probe against Sandbox.co.in /authenticate
  if (body.action === "test") {
    if (!apiKeyToTest || !apiSecretToTest) {
      return Response.json(
        { success: false, error: "Please provide both Sandbox API Key and API Secret to test connection." },
        { status: 400 },
      );
    }

    try {
      const authRes = await fetch(`${baseUrlToTest}/authenticate`, {
        method: "POST",
        headers: {
          "x-api-key": apiKeyToTest,
          "x-api-secret": apiSecretToTest,
          "x-api-version": apiVersionToTest,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const data = (await authRes.json().catch(() => ({}))) as {
        code?: number;
        status?: string;
        message?: string;
        data?: { access_token?: string };
        access_token?: string;
      };

      if (!authRes.ok) {
        return Response.json(
          {
            success: false,
            error: data.message || `Authentication rejected by Sandbox API (Status ${authRes.status})`,
          },
          { status: 200 },
        );
      }

      const token = data.data?.access_token || data.access_token;
      if (!token) {
        return Response.json(
          { success: false, error: "Authentication responded with OK but access token was not returned." },
          { status: 200 },
        );
      }

      return Response.json({
        success: true,
        message: "Connection verified. Valid access token received from Sandbox.co.in.",
      });
    } catch (err) {
      return Response.json(
        {
          success: false,
          error: `Network connection failed: ${err instanceof Error ? err.message : String(err)}`,
        },
        { status: 200 },
      );
    }
  }

  // 2. OCR API Test Probe
  if (body.action === "test-ocr") {
    try {
      const ocrKey = body.ocrApiKey?.trim() || currentSettings.ocrApiKey || "helloworld";
      const form = new FormData();
      form.append("apikey", ocrKey);
      const sampleB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAYAAAB3AH1ZAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA0SURBVEhL7c0xDQAwDMCw8mc6V7mD0y6QeC52z3cDAAAAAAAAAAAAAAD4q8A8kK5A7gfkDkC+D65Z9B1+f2cBAAAAAElFTkSuQmCC";
      form.append("base64Image", sampleB64);
      form.append("filetype", "PNG");
      form.append("OCREngine", "1");

      const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        ErrorMessage?: string[];
        OCRExitCode?: number;
      };

      if (json.error && /API key/i.test(json.error)) {
        return Response.json({
          success: false,
          error: `${json.error}. ${json.details || ""}`.trim(),
        });
      }

      if (json.ErrorMessage?.length && json.ErrorMessage.some((e) => /API key/i.test(e))) {
        return Response.json({
          success: false,
          error: "Invalid OCR API key provided.",
        });
      }

      return Response.json({
        success: true,
        message: "OCR.Space Cloud API endpoint is reachable and responsive.",
      });
    } catch (err) {
      return Response.json({
        success: false,
        error: `OCR API test failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 3. Save / Update Settings
  if (body.action === "save" || !body.action) {
    const updates: Partial<typeof currentSettings> = {};
    if (body.apiKey !== undefined) updates.apiKey = body.apiKey.trim();
    if (body.apiSecret !== undefined) updates.apiSecret = body.apiSecret.trim();
    if (body.baseUrl !== undefined) updates.baseUrl = body.baseUrl.trim();
    if (body.providerMode !== undefined) updates.providerMode = body.providerMode;
    if (body.ocrEngine !== undefined) updates.ocrEngine = body.ocrEngine;
    if (body.ocrApiKey !== undefined) updates.ocrApiKey = body.ocrApiKey.trim();

    const newSettings = updateGstApiSettings(updates);

    return Response.json({
      success: true,
      message: "Configuration updated successfully.",
      settings: {
        isConfigured: Boolean(newSettings.apiKey && newSettings.apiSecret),
        providerMode: newSettings.providerMode,
        apiKeyPreview: newSettings.apiKey ? maskSecret(newSettings.apiKey) : "",
        hasApiSecret: Boolean(newSettings.apiSecret),
        baseUrl: newSettings.baseUrl,
        ocrEngine: newSettings.ocrEngine,
        ocrApiKeyPreview: newSettings.ocrApiKey ? maskSecret(newSettings.ocrApiKey) : "",
      },
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
