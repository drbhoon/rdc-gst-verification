import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const runtimeRoot = process.env.SITES_RUNTIME_ROOT || path.join(projectRoot, ".sites-runtime");

process.env.CLOUDFLARE_CF_FETCH_ENABLED ||= "false";
process.env.WRANGLER_SEND_METRICS ||= "false";
process.env.WRANGLER_WRITE_LOGS ||= "false";
process.env.WRANGLER_LOG_PATH ||= path.join(runtimeRoot, "wrangler/logs");
process.env.WRANGLER_REGISTRY_PATH ||= path.join(runtimeRoot, "wrangler/dev-registry");
process.env.MINIFLARE_REGISTRY_PATH ||= path.join(runtimeRoot, "wrangler/registry");

process.chdir(projectRoot);
for (const directory of [
  path.dirname(process.env.WRANGLER_LOG_PATH),
  process.env.WRANGLER_REGISTRY_PATH,
  process.env.MINIFLARE_REGISTRY_PATH,
]) {
  mkdirSync(directory, { recursive: true });
}

// Forward all process.env variables and .env variables to Miniflare runtime (.dev.vars and wrangler.json vars)
const forwardKeys = [
  "ADMIN_EMAILS",
  "GST_PROVIDER_MODE",
  "GST_SANDBOX_API_KEY",
  "GST_SANDBOX_API_SECRET",
  "GST_SANDBOX_BASE_URL",
  "GST_SANDBOX_API_VERSION",
  "SANDBOX_KEY",
  "SANDBOX_SECRET",
  "SANDBOX_API_KEY",
  "SANDBOX_API_SECRET",
  "OCR_SPACE_API_KEY",
  "OCR_API_KEY",
  "OCR_ENGINE",
  "NODE_ENV",
];

const collectedVars = {};

// Read from .env file if it exists
const envFile = path.join(projectRoot, ".env");
if (existsSync(envFile)) {
  try {
    const raw = readFileSync(envFile, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...v] = trimmed.split("=");
        const key = k.trim();
        const val = v.join("=").trim().replace(/^["']|["']$/g, "");
        if (key) collectedVars[key] = val;
      }
    }
  } catch {}
}

// Host process.env takes precedence
for (const key of Object.keys(process.env)) {
  if (
    forwardKeys.includes(key) ||
    key.startsWith("GST_") ||
    key.startsWith("SANDBOX_") ||
    key.startsWith("OCR_") ||
    key.startsWith("ADMIN_")
  ) {
    if (process.env[key]) {
      collectedVars[key] = process.env[key];
    }
  }
}

// Write .dev.vars
const devVarsContent = Object.entries(collectedVars)
  .map(([k, v]) => `${k}=${v}`)
  .join("\n");
writeFileSync(path.join(projectRoot, ".dev.vars"), devVarsContent, "utf8");

// Also inject into dist/server/wrangler.json vars if file exists
const wranglerJsonPath = path.join(projectRoot, "dist/server/wrangler.json");
if (existsSync(wranglerJsonPath)) {
  try {
    const rawConfig = readFileSync(wranglerJsonPath, "utf8");
    const json = JSON.parse(rawConfig);
    json.vars = { ...(json.vars || {}), ...collectedVars };
    writeFileSync(wranglerJsonPath, JSON.stringify(json), "utf8");
  } catch {}
}
