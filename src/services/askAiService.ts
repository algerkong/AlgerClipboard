import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { isMacOS } from "@/services/windowOptions";
import type { AiWebService } from "@/constants/aiServices";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import type { AskAiPreset } from "@/constants/askAiPresets";
import { getInjectionScript } from "@/services/injectionScripts";

/**
 * Create a deterministic 16-byte identifier from a service ID.
 * Used as `dataStoreIdentifier` on macOS for per-service WebView session isolation.
 */
export function serviceIdToDataStoreId(serviceId: string): number[] {
  const bytes = new Array(16).fill(0);
  for (let i = 0; i < serviceId.length && i < 16; i++) {
    bytes[i] = serviceId.charCodeAt(i);
  }
  return bytes;
}

/**
 * Open (or focus) a WebView window for the given AI service.
 * Each service gets its own persistent, isolated session via:
 * - macOS: `dataStoreIdentifier` (WKWebsiteDataStore)
 * - Windows/Linux: `dataDirectory` (per-service profile folder)
 */
export async function openAiWebView(service: AiWebService) {
  const label = `ai-webview-${service.id}`;

  // If the window already exists, just show and focus it
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }

  // Build platform-specific session isolation options
  const sessionOptions = isMacOS()
    ? { dataStoreIdentifier: serviceIdToDataStoreId(service.id) }
    : { dataDirectory: service.id };

  const win = new WebviewWindow(label, {
    url: service.url,
    title: service.name,
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    decorations: true,
    center: true,
    shadow: true,
    resizable: true,
    ...sessionOptions,
  });

  win.once("tauri://error", (e) => {
    console.error(`Failed to create WebView window for ${service.name}:`, e);
  });
}

/**
 * Fetch and cache a favicon for the given service.
 * Returns an asset URL suitable for `<img src>`, or null on failure.
 */
export async function fetchServiceFavicon(
  serviceId: string,
  domain: string,
): Promise<string | null> {
  try {
    const path = await invoke<string>("fetch_favicon", { serviceId, domain });
    return convertFileSrc(path);
  } catch (e) {
    console.error(`Failed to fetch favicon for ${serviceId}:`, e);
    return null;
  }
}

/**
 * Orchestrate the Ask AI flow: build prompt, open WebView, inject fill+submit script.
 *
 * Best-effort auto-send -- errors are logged but not rethrown so the WebView
 * remains open for manual interaction even if injection fails.
 */
export async function askAi(
  serviceId: string,
  clipboardText: string,
  preset: AskAiPreset,
  customPrompt?: string,
): Promise<void> {
  try {
    // 1. Build the full prompt from template
    const fullPrompt = preset.promptTemplate
      .replace("{content}", clipboardText)
      .replace("{customPrompt}", customPrompt || "");

    // 2. Find the service definition
    const service = AI_WEB_SERVICES.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error(`Unknown AI service: ${serviceId}`);
    }

    // 3. Open or focus the WebView window
    await openAiWebView(service);

    // 4. Wait for the WebView window to be created and start loading.
    //    The injection script itself has its own retry/polling for DOM readiness.
    await new Promise((r) => setTimeout(r, 2000));

    // 5. Build and inject the fill+submit script
    const script = getInjectionScript(serviceId, fullPrompt);
    const label = `ai-webview-${serviceId}`;
    await invoke("eval_webview_js", { label, js: script });
  } catch (e) {
    console.error(`askAi failed for service ${serviceId}:`, e);
  }
}
