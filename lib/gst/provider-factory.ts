import { MockGstProvider } from "./mock-provider";
import { SandboxGstProvider } from "./sandbox-provider";
import { getGstApiSettings } from "./settings";
import type { GstVerificationProvider } from "./types";

const mockProviderInstance = new MockGstProvider();
const sandboxProviderInstance = new SandboxGstProvider();

export function getGstProvider(): GstVerificationProvider {
  const settings = getGstApiSettings();
  if (settings.providerMode === "sandbox" && sandboxProviderInstance.isConfigured()) {
    return sandboxProviderInstance;
  }
  return mockProviderInstance;
}

export { ProviderUnavailableError } from "./mock-provider";

