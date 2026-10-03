"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileSearch,
  KeyRound,
  Loader2,
  Radio,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GstSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function GstSettingsDialog({ open, onOpenChange, onSaved }: GstSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingOcr, setTestingOcr] = useState(false);
  const [saving, setSaving] = useState(false);

  const [providerMode, setProviderMode] = useState<"sandbox" | "mock">("sandbox");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.sandbox.co.in");

  const [ocrEngine, setOcrEngine] = useState<"auto" | "ocr-space" | "tesseract">("auto");
  const [ocrApiKey, setOcrApiKey] = useState("");
  const [ocrApiKeyPreview, setOcrApiKeyPreview] = useState("");

  const [isConfigured, setIsConfigured] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState("");
  const [hasApiSecret, setHasApiSecret] = useState(false);

  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const [ocrTestResult, setOcrTestResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    async function fetchSettings() {
      try {
        const res = await fetch("/api/gst-settings");
        const data = (await res.json()) as {
          isConfigured: boolean;
          providerMode: "sandbox" | "mock";
          apiKeyPreview: string;
          hasApiSecret: boolean;
          baseUrl: string;
          ocrEngine?: "auto" | "ocr-space" | "tesseract";
          ocrApiKeyPreview?: string;
        };
        if (!ignore) {
          setIsConfigured(data.isConfigured);
          setProviderMode(data.providerMode || "sandbox");
          setApiKeyPreview(data.apiKeyPreview || "");
          setHasApiSecret(data.hasApiSecret);
          if (data.baseUrl) setBaseUrl(data.baseUrl);
          if (data.ocrEngine) setOcrEngine(data.ocrEngine);
          if (data.ocrApiKeyPreview) setOcrApiKeyPreview(data.ocrApiKeyPreview);
        }
      } catch {
        if (!ignore) {
          toast.error("Could not fetch current GST API settings");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchSettings();

    return () => {
      ignore = true;
    };
  }, [open]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/gst-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          apiKey: apiKey.trim() || undefined,
          apiSecret: apiSecret.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      setTestResult(data);
      if (data.success) {
        toast.success("Sandbox API Connection Verified!", {
          description: data.message,
        });
      } else {
        toast.error("Sandbox API Test Failed", {
          description: data.error,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error during test";
      setTestResult({ success: false, error: msg });
      toast.error("Connection Test Failed", { description: msg });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestOcr() {
    setTestingOcr(true);
    setOcrTestResult(null);
    try {
      const res = await fetch("/api/gst-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-ocr",
          ocrApiKey: ocrApiKey.trim() || undefined,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      setOcrTestResult(data);
      if (data.success) {
        toast.success("Cloud OCR Test Succeeded!", {
          description: data.message,
        });
      } else {
        toast.error("Cloud OCR Test Failed", {
          description: data.error,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error during OCR test";
      setOcrTestResult({ success: false, error: msg });
      toast.error("OCR Test Failed", { description: msg });
    } finally {
      setTestingOcr(false);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/gst-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          providerMode,
          apiKey: apiKey.trim() || undefined,
          apiSecret: apiSecret.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          ocrEngine,
          ocrApiKey: ocrApiKey.trim() || undefined,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save configuration");
      }

      toast.success("Settings Saved!", {
        description: `GST Gateway: ${providerMode.toUpperCase()} · OCR: ${ocrEngine.toUpperCase()}`,
      });

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save settings", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            <Sliders className="size-3.5" />
            Integration & Compliance Gateway
          </div>
          <DialogTitle className="text-xl font-bold text-[#102a4f]">
            GST Verification & OCR Engine Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Configure live Sandbox.co.in GST APIs and intelligent OCR document scanning for invoices.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <p className="text-xs text-slate-500 font-medium">Loading settings...</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6 max-h-[65vh] overflow-y-auto">
            {/* Status Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div
                  className={`size-3 rounded-full ${
                    providerMode === "sandbox"
                      ? isConfigured
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-500"
                      : "bg-purple-500"
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {providerMode === "sandbox"
                      ? isConfigured
                        ? "Sandbox.co.in Live Gateway Active"
                        : "Sandbox.co.in (Credentials Pending)"
                      : "Offline Mock Simulator Active"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {providerMode === "sandbox"
                      ? "Real queries to Indian GST Portal, GSTR-1 & Section 16(2)(aa) checks."
                      : "Local deterministic mocks for testing edge cases without API quota."}
                  </p>
                </div>
              </div>
            </div>

            {/* Provider Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Active GST Verification Engine
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProviderMode("sandbox")}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    providerMode === "sandbox"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                      <Server className="size-3.5 text-blue-600" />
                      Sandbox.co.in Live
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      Live
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Production tax compliance APIs with 24-hr cached access token.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProviderMode("mock")}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    providerMode === "mock"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                      <Radio className="size-3.5 text-purple-600" />
                      Offline Mock
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                      Offline
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Built-in deterministic test sandboxes (supports MM, PENDING, CANCEL, DEF triggers).
                  </p>
                </button>
              </div>
            </div>

            {/* Sandbox Credentials Form */}
            {providerMode === "sandbox" && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-blue-600" />
                    Sandbox.co.in API Credentials
                  </h4>
                  <a
                    href="https://sandbox.co.in"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Get API Keys <ExternalLink className="size-3" />
                  </a>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sandbox API Key (<code className="text-xs font-mono">x-api-key</code>)
                  </label>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={apiKeyPreview ? `${apiKeyPreview} (Configured)` : "Paste your key_live_... or key_test_..."}
                      className="font-mono text-xs pr-10 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {apiKeyPreview && !apiKey && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Key already configured in environment. Leave blank to retain.
                    </p>
                  )}
                </div>

                {/* API Secret */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sandbox API Secret (<code className="text-xs font-mono">x-api-secret</code>)
                  </label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder={hasApiSecret ? "•••••••••••••••• (Configured)" : "Paste your API secret"}
                      className="font-mono text-xs pr-10 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {hasApiSecret && !apiSecret && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Secret is saved in environment. Leave blank to retain.
                    </p>
                  )}
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sandbox Gateway Base URL
                  </label>
                  <Input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="font-mono text-xs bg-white"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setBaseUrl("https://api.sandbox.co.in")}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        baseUrl === "https://api.sandbox.co.in"
                          ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Production (api.sandbox.co.in)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBaseUrl("https://test-api.sandbox.co.in")}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        baseUrl === "https://test-api.sandbox.co.in"
                          ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Test (test-api.sandbox.co.in)
                    </button>
                  </div>
                </div>

                {/* Connection Test Status Banner */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {testResult.success ? "Authentication Successful" : "Authentication Failed"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        {testResult.success ? testResult.message : testResult.error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Test Connection Button */}
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing || (!apiKey && !apiKeyPreview) || (!apiSecret && !hasApiSecret)}
                    className="w-full text-xs font-semibold border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Testing Connection with Sandbox.co.in...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3.5 mr-1.5" />
                        Test Connection Live
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* OCR Engine Section */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-purple-600" />
                  OCR & Document Scanner Engine
                </h4>
                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  Multi-Stage
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Invoice OCR Scanning Strategy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOcrEngine("auto")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      ocrEngine === "auto"
                        ? "border-purple-600 bg-purple-50 text-purple-950 font-semibold ring-1 ring-purple-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs"
                    }`}
                  >
                    <p className="text-xs font-bold">Auto Smart (Recommended)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Vector PDF (100%) &rarr; Cloud OCR &rarr; Local
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOcrEngine("ocr-space")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      ocrEngine === "ocr-space"
                        ? "border-purple-600 bg-purple-50 text-purple-950 font-semibold ring-1 ring-purple-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs"
                    }`}
                  >
                    <p className="text-xs font-bold">OCR.Space Cloud API</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Free cloud document AI engine
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOcrEngine("tesseract")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      ocrEngine === "tesseract"
                        ? "border-purple-600 bg-purple-50 text-purple-950 font-semibold ring-1 ring-purple-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs"
                    }`}
                  >
                    <p className="text-xs font-bold">Local Tesseract</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Offline daemon on port 5174
                    </p>
                  </button>
                </div>
              </div>

              {/* OCR Space API Key */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span>OCR.Space Free API Key (Optional)</span>
                  <a
                    href="https://ocr.space/ocrapi/freekey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                  >
                    Get Free 25,000 requests/mo Key <ExternalLink className="size-3" />
                  </a>
                </label>
                <Input
                  type="text"
                  value={ocrApiKey}
                  onChange={(e) => setOcrApiKey(e.target.value)}
                  placeholder={ocrApiKeyPreview ? `${ocrApiKeyPreview} (Configured)` : "Default: Free tier (helloworld)"}
                  className="font-mono text-xs bg-white"
                />
              </div>

              {ocrTestResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    ocrTestResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {ocrTestResult.success ? (
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{ocrTestResult.success ? "OCR Ready" : "OCR Check Failed"}</p>
                    <p className="mt-0.5 text-[11px]">{ocrTestResult.message || ocrTestResult.error}</p>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestOcr}
                disabled={testingOcr}
                className="w-full text-xs font-semibold border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                {testingOcr ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Checking OCR Cloud Connection...
                  </>
                ) : (
                  <>
                    <FileSearch className="size-3.5 mr-1.5" />
                    Test Cloud OCR Endpoint
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveSettings}
            disabled={saving || loading}
            className="bg-[#163b70] hover:bg-[#102a4f] text-white text-xs font-semibold px-4"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              "Save & Apply Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
