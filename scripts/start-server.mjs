import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "5173";
const host = "0.0.0.0";

console.log(`[RDC-GST] Initializing application for production/testing on port ${port}...`);

// Ensure build artifacts exist before starting server
const wranglerConfigPath = fileURLToPath(new URL("../dist/server/wrangler.json", import.meta.url));
if (!existsSync(wranglerConfigPath)) {
  console.log("[RDC-GST] Dist build artifacts not found. Running build...");
  const buildResult = spawnSync(process.execPath, [fileURLToPath(new URL("./run-framework.mjs", import.meta.url)), "build"], {
    stdio: "inherit",
    cwd: fileURLToPath(new URL("../", import.meta.url)),
  });
  if (buildResult.status !== 0) {
    console.error("[RDC-GST] Build failed with exit code:", buildResult.status);
    process.exit(buildResult.status || 1);
  }
}

// 1. Start background OCR daemon on port 5174
const ocrScript = fileURLToPath(new URL("./ocr-server.mjs", import.meta.url));
console.log("[RDC-GST] Starting background OCR daemon on 127.0.0.1:5174...");
const ocrProcess = spawn(process.execPath, [ocrScript], {
  stdio: "inherit",
  env: { ...process.env, PORT: "5174", HOST: "127.0.0.1" },
  cwd: fileURLToPath(new URL("../", import.meta.url)),
});

ocrProcess.on("error", (err) => {
  console.error("[RDC-GST] OCR daemon process error:", err);
});

// 2. Start Wrangler server bound to 0.0.0.0 and dynamic Railway PORT
console.log(`[RDC-GST] Starting web server on ${host}:${port}...`);
const wranglerScript = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const sitesEnvUrl = new URL("./sites-env.mjs", import.meta.url).href;

const wranglerArgs = [
  "--import", sitesEnvUrl,
  wranglerScript,
  "dev",
  "--config", "dist/server/wrangler.json",
  "--local",
  "--persist-to", ".wrangler/state",
  "--ip", host,
  "--port", String(port),
  "--inspector-port", "0",
];

const webProcess = spawn(process.execPath, wranglerArgs, {
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
  cwd: fileURLToPath(new URL("../", import.meta.url)),
});

webProcess.on("error", (err) => {
  console.error("[RDC-GST] Web server process error:", err);
});

const cleanup = (code = 0) => {
  console.log("[RDC-GST] Stopping background services...");
  try { ocrProcess.kill(); } catch {}
  try { webProcess.kill(); } catch {}
  process.exit(code);
};

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));

webProcess.on("exit", (code) => {
  console.log(`[RDC-GST] Web server exited with code ${code}`);
  cleanup(code ?? 0);
});
