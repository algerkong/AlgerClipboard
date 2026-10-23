import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { isMacOS } from "@/services/windowOptions";
import type { AiWebService } from "@/constants/aiServices";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { getPresetPrompt, type AskAiPreset } from "@/constants/askAiPresets";
import { getInjectionScript } from "@/services/injectionScripts";
import i18n from "@/i18n";

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
 * Open (or focus) the standalone window for the given AI service.
 * Every service gets its own native window and its own persistent session:
 * - macOS: `dataStoreIdentifier` (WKWebsiteDataStore)
 * - Windows/Linux: `dataDirectory` (per-service profile folder)
 */
export async function openAiWebView(service: AiWebService): Promise<void> {
  const label = `ai-webview-${service.id}`;

  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.unminimize().catch(() => undefined);
    await existing.setFocus();
    return;
  }

  const sessionOptions = isMacOS()
    ? { dataStoreIdentifier: serviceIdToDataStoreId(service.id) }
    : { dataDirectory: service.id };

  const win = new WebviewWindow(label, {
    url: service.url,
    title: service.name,
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    // External sites have no custom drag region, so use native window chrome.
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

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWebview(label: string, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const exists = await invoke<boolean>("webview_exists", { label });
    if (exists) {
      return;
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for WebView '${label}'`);
}

/**
 * Orchestrate the Ask AI flow: build the prompt, open the service window,
 * then inject the fill+submit script into that window.
 *
 * Best-effort auto-send -- errors are logged but not rethrown so the window
 * remains open for manual interaction even if injection fails.
 */
export async function askAi(
  serviceId: string,
  clipboardText: string,
  preset: AskAiPreset,
  customPrompt?: string,
): Promise<void> {
  try {
    // 1. Build the full prompt from the preset template in the app language.
    const template = getPresetPrompt(preset, i18n.language);
    const fullPrompt = template
      .replace("{content}", clipboardText)
      .replace("{customPrompt}", customPrompt || "");

    // 2. Find the service definition.
    const service = AI_WEB_SERVICES.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error(`Unknown AI service: ${serviceId}`);
    }

    // 3. Open or focus the standalone window for this service.
    await openAiWebView(service);

    // 4. Wait until the window exists, then give the page time to start loading.
    //    The injection script polls the DOM for up to 6 seconds by itself.
    const label = `ai-webview-${serviceId}`;
    await waitForWebview(label);
    await delay(2000);

    // 5. Inject the fill+submit script.
    const script = getInjectionScript(serviceId, fullPrompt);
    await invoke("eval_webview_js", { label, js: script });
  } catch (e) {
    console.error(`askAi failed for service ${serviceId}:`, e);
  }
}
